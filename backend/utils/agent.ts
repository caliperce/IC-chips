import { query } from "@anthropic-ai/claude-agent-sdk";
import * as fs from "node:fs/promises";
import {
  loadSession,
  saveSession,
  parseSessionDirectives,
  autoNameFromPrompt,
  printTodos,
  formatToolInput,
  makeUserMessage,
} from "./helper";

// ============================================================================
// MAIN RUN FUNCTION
// ============================================================================

export async function run(
  msg: string,
  {
    showThinking = true,
    showTodos = true,
    showToolCalls = true,
    streamAssistantText = true,
    newSession = false,
    resumeSid: resumeSidFromOptions,
    onStreamUpdate,
    onToolStreamUpdate,
    isResume = false,
    maxThinkingTokens = 4096,
    maxTurns = 30,
    allowedTools = ["TodoWrite", "Bash", "Read", "Write", "Glob", "Grep", "WebFetch", "WebSearch"],
    appendSystemPrompt = "",
    canUseTool,
    enableToolStreamLogging = false,
    toolStreamLogDir,
    images = [],
  }: {
    showThinking?: boolean;
    showTodos?: boolean;
    showToolCalls?: boolean;
    streamAssistantText?: boolean;
    newSession?: boolean;
    resumeSid?: string;
    onStreamUpdate?: (assistantStream: string) => void;
    onToolStreamUpdate?: (toolStreamLog: string) => void;
    isResume?: boolean;
    maxThinkingTokens?: number;
    maxTurns?: number;
    allowedTools?: string[];
    appendSystemPrompt?: string;
    canUseTool?: (toolName: string, input: any, options: { signal: AbortSignal; suggestions?: any[] }) => Promise<
      | { behavior: "allow"; updatedInput: any; updatedPermissions?: any[] }
      | { behavior: "deny"; message: string; interrupt?: boolean }
    >;
    enableToolStreamLogging?: boolean;
    toolStreamLogDir?: string;
    images?: any[];
  } = {}
): Promise<{ sessionId: string | null; assistantStream: string; finalResponse: string; toolStreamLog: string }> {

  // Parse session directives
  const { name: nameFromPrompt, forceNew: forceNewFromPrompt, cleaned } = parseSessionDirectives(msg);

  // Determine session handling
  const forceNew = newSession || forceNewFromPrompt;
  let sessionName: string | null = nameFromPrompt ?? null;

  // Load existing session if resuming
  let resumeSid: string | null = resumeSidFromOptions ?? null;
  if (!resumeSid && !forceNew && sessionName) {
    resumeSid = await loadSession(sessionName);
  }

  // Auto-generate session name if starting new without explicit name
  if (forceNew && !sessionName) {
    sessionName = autoNameFromPrompt(cleaned);
  }

  // Default tool permission handler
  const defaultCanUseTool = async (toolName: string, input: any) => {
    if (toolName === "Bash") {
      const cmd = (input as any)?.command ?? "";

      // Block dangerous commands
      if (/\brm\s+-rf\b/.test(cmd) || /\bshutdown\b/.test(cmd) || /\bmkfs\b/.test(cmd)) {
        return { behavior: "deny" as const, message: "Blocked unsafe shell command." };
      }

      // Make file removal commands safer
      if (/\brm\b/.test(cmd) && !cmd.includes('|| true') && !cmd.includes('2>/dev/null')) {
        const safeCmd = cmd.includes('&&')
          ? cmd.replace(/&&\s*rm\s+[^&]+/, '&& (rm $& 2>/dev/null || true)')
          : cmd + ' 2>/dev/null || true';

        console.log(`🛡️ Made rm command safer: ${safeCmd}`);
        return { behavior: "allow" as const, updatedInput: { ...input, command: safeCmd } };
      }
    }
    return { behavior: "allow" as const, updatedInput: input };
  };

  // Build the query stream
  const stream = query({
    prompt: (async function* () {
      yield await makeUserMessage(cleaned, images);
    })(),
    options: {
      ...(resumeSid ? { resume: resumeSid } : {}),
      includePartialMessages: true,
      maxThinkingTokens,
      maxTurns,
      allowedTools,
      permissionMode: "bypassPermissions",
      ...(appendSystemPrompt ? { systemPrompt: appendSystemPrompt } : {}),
   
      canUseTool: canUseTool || defaultCanUseTool,
      hooks: showToolCalls ? {
        PreToolUse: [{ hooks: [async (input) => {
          const name = (input as any).tool_name;
          const toolInput = (input as any).tool_input;
          console.log(`\n🛠️  Planning to call tool: ${name}`);
          if (toolInput) {
            console.log("   with input:", JSON.stringify(toolInput, null, 2));
          }

          // Stream tool usage updates
          if (onStreamUpdate) {
            const update = `🛠️ Using ${name} tool${toolInput ? ` with: ${JSON.stringify(toolInput).slice(0, 200)}...` : ''}`;
            streamingText += update + "\n";
            onStreamUpdate(assistantStreamLog);
          }

          return { continue: true, hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" } };
        }]}],
        PostToolUse: [{ hooks: [async (input) => {
          const name = (input as any).tool_name;
          const toolResp = (input as any).tool_response;

          console.log(`✅ Tool finished: ${name}`);
          if (toolResp) {
            console.log("   response preview:", JSON.stringify(toolResp).slice(0, 500) + "...");

            if (JSON.stringify(toolResp).length < 1000) {
              console.log("   full response:", JSON.stringify(toolResp, null, 2));
            }
          }

          // Stream tool completion updates
          if (onStreamUpdate) {
            const update = `✅ Completed ${name} tool`;
            streamingText += update + "\n";
            onStreamUpdate(assistantStreamLog);
          }

          return { continue: true };
        }]}],
        Notification: [{ hooks: [async (input) => {
          const n = (input as any).message;
          if (n) console.log(`🔔 ${n}`);
          return { continue: true };
        }]}],
      } : {},
    },
  });

  // Stream processing state
  let printedThinkingHeader = false;
  let printedTextHeader = false;
  let inThinkingBlock = false;

  // Diagnostics
  let sawAnyPartials = false;
  let sawAnyThinking = false;
  let sawAnyToolUse = false;

  // Session tracking
  let actualSessionId: string | null = null;

  // Content tracking
  let streamingText = "";
  let assistantStreamLog = "";
  let finalResponse = "";

  // Tool stream logging
  let toolStreamLog = "";
  let toolStreamLogPath: string | null = null;

  // Helper function to append to tool stream log
  const appendToolStreamLog = async (label: string, payload: any) => {
    try {
      const safeStringify = (obj: any) => {
        const seen = new Set<any>();
        return JSON.stringify(
          obj,
          (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) return '[Circular]';
              seen.add(value);
            }
            if (typeof value === 'string' && value.length > 20000) {
              return value.slice(0, 20000) + '...<truncated>';
            }
            return value;
          },
          2
        );
      };

      const logEntry = `\n[${new Date().toISOString()}] ${label}:\n${safeStringify(payload)}\n`;
      toolStreamLog += logEntry;

      // Write to file if logging is enabled and path is set
      if (enableToolStreamLogging && toolStreamLogPath) {
        await fs.appendFile(toolStreamLogPath, logEntry, 'utf8');
      }

      // Stream update callback for real-time Firebase updates
      if (onToolStreamUpdate) {
        onToolStreamUpdate(toolStreamLog);
      }
    } catch (e: any) {
      console.log(`⚠️ Failed to append tool stream log: ${e?.message || e}`);
    }
  };

  // Process stream
  for await (const m of stream) {
    if (m.type === "system" && m.subtype === "init") {
      console.log("▶ model:", m.model, "| permissionMode: execute");

      actualSessionId = m.session_id;

      // Initialize tool stream log file if enabled
      if (enableToolStreamLogging && actualSessionId) {
        try {
          const logsDir = toolStreamLogDir || './logs';
          await fs.mkdir(logsDir, { recursive: true });
          toolStreamLogPath = `${logsDir}/tool_stream_${actualSessionId}.log`;
          const initialLog = `Tool Stream Log for session ${actualSessionId} (started ${new Date().toISOString()})\n`;
          await fs.writeFile(toolStreamLogPath, initialLog, 'utf8');
          toolStreamLog = initialLog;
          console.log(`🗂️ Tool stream log initialized at: ${toolStreamLogPath}`);
          
          // Log session initialization
          await appendToolStreamLog('session_init', {
            session_id: m.session_id,
            model: m.model,
            permission_mode: "execute"
          });
        } catch (e: any) {
          console.log(`⚠️ Could not initialize tool stream log: ${e?.message || e}`);
        }
      }

      // Save session mapping
      if (sessionName) await saveSession(sessionName, m.session_id);

      continue;
    }

    if ((m as any).type === "tool_use") {
      sawAnyToolUse = true;
      const name = (m as any).name;
      console.log(`🧩 TOOL_USE seen: ${name}`);
      
      // Log tool use to file
      await appendToolStreamLog('tool_use', {
        tool_name: name,
        tool_input: (m as any).input,
        tool_use_id: (m as any).id
      });
      
      if (showTodos && name === "TodoWrite") {
        const todos = (m as any).input?.todos ?? [];
        printTodos(todos);
        continue;
      }
    }

    if ((m as any).type === "tool_result") {
      const toolResult = m as any;
      console.log(`✅ TOOL_RESULT received for tool_use_id: ${toolResult.tool_use_id}`);
      
      // Log tool result to file
      await appendToolStreamLog('tool_result', {
        tool_use_id: toolResult.tool_use_id,
        content: toolResult.content,
        is_error: toolResult.is_error
      });
    }

    if (m.type === "stream_event") {
      sawAnyPartials = true;
      const ev: any = m.event;

      // Add event to assistant stream log
      const eventLogEntry = JSON.stringify(ev) + "\n";
      assistantStreamLog += eventLogEntry;

      // Write ALL stream events to the tool stream log file
      await appendToolStreamLog('stream_event', ev);

      // Update stream callback
      if (onStreamUpdate && assistantStreamLog) {
        onStreamUpdate(assistantStreamLog);
      }

      // Handle tool use that appears in content_block_start events
      if (ev?.type === "content_block_start" && ev?.content_block?.type === "tool_use") {
        const toolUse = ev.content_block;
        console.log(`🔧 Tool use detected in stream: ${toolUse.name}`);
        sawAnyToolUse = true;
        
        // Log this tool use
        await appendToolStreamLog('tool_use_from_stream', {
          tool_name: toolUse.name,
          tool_use_id: toolUse.id,
          tool_input: toolUse.input
        });
      }

      // Handle tool input streaming
      if (ev?.delta?.type === "input_json_delta" && ev?.delta?.partial_json) {
        const partialJson = ev.delta.partial_json;

        // Log tool input to tool stream
        await appendToolStreamLog('input_json_delta', { partial: partialJson });

        if (onStreamUpdate) {
          const formattedContent = formatToolInput(partialJson);
          if (formattedContent) {
            streamingText += formattedContent + "\n";
            onStreamUpdate(assistantStreamLog);
          }
        }
      }

      // Handle thinking events - multiple patterns for different API versions
      if (showThinking && ev?.type === "message.delta" && ev?.delta?.thinking) {
        if (!printedThinkingHeader) { console.log("\n🧠 thinking:"); printedThinkingHeader = true; }
        sawAnyThinking = true;
        process.stdout.write(ev.delta.thinking);

        if (onStreamUpdate) {
          streamingText += ev.delta.thinking;
          onStreamUpdate(assistantStreamLog);
        }

        continue;
      }

      // Handle thinking content block start
      if (showThinking && ev?.type === "content_block_start" && ev?.content_block?.type === "thinking") {
        inThinkingBlock = true;
        if (!printedThinkingHeader) { console.log("\n🧠 thinking:"); printedThinkingHeader = true; }
        const initial = ev?.content_block?.text ?? "";
        if (initial) {
          sawAnyThinking = true;
          process.stdout.write(initial);

          if (onStreamUpdate) {
            streamingText += initial;
            onStreamUpdate(assistantStreamLog);
          }
        }
        continue;
      }

      // Handle thinking_delta events
      if (showThinking && ev?.type === "content_block_delta" && ev?.delta?.type === "thinking_delta") {
        if (!printedThinkingHeader) {
          console.log("\n🧠 thinking:");
          printedThinkingHeader = true;
        }
        sawAnyThinking = true;
        process.stdout.write(ev.delta.thinking);

        if (onStreamUpdate) {
          streamingText += ev.delta.thinking;
          onStreamUpdate(assistantStreamLog);
        }

        continue;
      }

      // Handle other thinking content block deltas
      if (showThinking && inThinkingBlock && ev?.type === "content_block_delta") {
        const d = ev?.delta;
        const chunk =
          d?.type === "thinking_delta" ? (d?.thinking ?? d?.text ?? "") :
          d?.type === "text_delta"      ? (d?.text ?? "") : "";
        if (chunk) {
          sawAnyThinking = true;
          process.stdout.write(chunk);

          if (onStreamUpdate) {
            streamingText += chunk;
            onStreamUpdate(assistantStreamLog);
          }
        }
        continue;
      }

      // Handle thinking content block stop
      if (showThinking && ev?.type === "content_block_stop" && inThinkingBlock) {
        inThinkingBlock = false;
        continue;
      }

      // Handle assistant text streaming
      if (ev?.type === "content_block_delta" && ev?.delta?.type === "text_delta" && !inThinkingBlock) {
        if (!printedTextHeader) {
          console.log("\n📝 assistant (streaming):");
          printedTextHeader = true;
        }

        if (streamAssistantText) {
          process.stdout.write(ev.delta.text);
        }

        streamingText += ev.delta.text;

        if (onStreamUpdate) {
          onStreamUpdate(assistantStreamLog);
        }

        continue;
      }
    }

    if (m.type === "result" && m.subtype === "success") {
      if (printedThinkingHeader || printedTextHeader) console.log("\n");

      finalResponse = m.result;
      console.log("✅ Response received (length:", (finalResponse || '').length, ")");

      console.log("\n💬 response:\n" + finalResponse + "\n");

      // Log final result
      await appendToolStreamLog('session_complete', {
        final_response_length: (finalResponse || '').length,
        diagnostics: {
          partials_received: sawAnyPartials,
          thinking_streamed: sawAnyThinking,
          tool_calls_seen: sawAnyToolUse
        }
      });

      console.log("=== Diagnostics ===");
      console.log("Partials received :", sawAnyPartials ? "✅ yes" : "❌ no");
      console.log("Thinking streamed :", sawAnyThinking ? "🧠 yes" : "— none —");
      console.log("Tool calls seen   :", sawAnyToolUse ? "🛠️ yes" : "— none —");
      console.log("===================\n");

      return {
        sessionId: actualSessionId,
        assistantStream: assistantStreamLog || streamingText,
        finalResponse,
        toolStreamLog
      };
    }
  }

  // Fallback if stream ends unexpectedly
  return {
    sessionId: actualSessionId,
    assistantStream: assistantStreamLog || streamingText,
    finalResponse,
    toolStreamLog
  };
}


