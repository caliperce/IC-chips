/**
 * Frontend-Friendly Claude Stream Parser
 * 
 * This parser takes Claude's tool stream logs and extracts:
 * - Assistant text (what Claude is saying)
 * - Tool uses (what tools Claude is calling)
 * - Tool commands (the parameters Claude is passing to tools)
 * - Thinking process (Claude's internal reasoning)
 * 
 * Perfect for displaying in your React/Next.js frontend!
 * 
 * USAGE EXAMPLE:
 * 
 * const parser = new FrontendStreamParser({
 *   onTextUpdate: (newText, fullText) => {
 *     console.log('Claude said:', newText);
 *   },
 *   onThinkingUpdate: (newThinking, fullThinking) => {
 *     console.log('Claude is thinking:', newThinking);
 *   },
 *   onToolUse: (toolInfo) => {
 *     console.log('Claude started using tool:', toolInfo.name);
 *   },
 *   onToolCommand: (commandChunk, fullCommand) => {
 *     console.log('Tool parameters streaming in:', commandChunk);
 *   },
 *   onToolComplete: (completedTool) => {
 *     console.log('Tool ready with params:', completedTool.name, completedTool.input);
 *     // For WebSearch: completedTool.input.query
 *     // For WebFetch: completedTool.input.url
 *   },
 *   onTableDetected: (table, allTables) => {
 *     console.log('Table found!', table.headers, table.rows);
 *     // Render beautiful table with: table.headers, table.rows
 *   },
 *   onComplete: (finalState) => {
 *     console.log('Stream finished!', finalState);
 *   },
 *   onError: (error) => {
 *     console.error('Error:', error);
 *   }
 * });
 * 
 * // Then feed chunks to it:
 * parser.processChunk(streamChunk);
 */

/**
 * Real-Time Frontend Stream Parser
 * Use this when you're receiving the stream in real-time
 */
class FrontendStreamParser {
  constructor(callbacks = {}) {
    // These callbacks let your frontend know when something updates!
    this.callbacks = {
      onTextUpdate: callbacks.onTextUpdate || (() => {}),      // New text arrives
      onThinkingUpdate: callbacks.onThinkingUpdate || (() => {}), // New thinking text
      onToolUse: callbacks.onToolUse || (() => {}),            // Tool is being used (when it starts)
      onToolCommand: callbacks.onToolCommand || (() => {}),    // Tool parameters (streaming in)
      onToolComplete: callbacks.onToolComplete || (() => {}),  // Tool is complete with all params
      onTableDetected: callbacks.onTableDetected || (() => {}), // Markdown table found and parsed
      onComplete: callbacks.onComplete || (() => {}),          // Stream finished
      onError: callbacks.onError || (() => {})                 // Something went wrong
    };
    
    // This stores all the parsed data
    this.state = {
      // Basic info about the session
      metadata: {
        sessionId: '',
        messageId: '',
        model: '',
        startTime: ''
      },

      // The actual content
      thinking: '',           // Claude's thinking process
      assistantText: '',      // What Claude is saying to the user

      // Tool-related data
      toolUses: [],          // Which tools Claude used: [{name: 'grep', id: '123', input: {...}}]
      toolCommands: [],      // Tool parameters in order: ['{"pattern":"test"}', '...']
      fullToolCommand: '',   // All tool commands combined

      // Table data
      tables: [],            // Parsed markdown tables: [{headers: [...], rows: [[...]], rawText: '...'}]

      // Events in the order they happened
      chronologicalEvents: [],

      // Token usage stats
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      },

      isComplete: false
    };

    // Internal buffers for processing the stream
    this.buffer = '';           // Holds incomplete lines
    this.jsonBuffer = '';       // Holds incomplete JSON objects
    this.currentToolInput = ''; // Accumulates input for current tool
  }

  /**
   * Main function: Feed chunks of the log to this function
   * 
   * Example:
   *   parser.processChunk('Line 1 from log\nLine 2 from log\n...')
   */
  processChunk(chunk) {
    try {
      this.buffer += chunk;
      
      // Extract complete events from the buffer
      const events = this.extractEvents();
      
      // Process each event
      events.forEach(event => {
        this.handleEvent(event);
      });
      
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  /**
   * Extract complete JSON events from the buffer
   * This handles the tricky part of splitting incomplete JSON
   */
  extractEvents() {
    const events = [];
    const lines = this.buffer.split('\n');
    
    // Keep the last line in buffer if it might be incomplete
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Skip timestamp lines like [2025-10-03T16:27:26.729Z]
      if (trimmed.startsWith('[') && trimmed.includes(']')) {
        if (this.jsonBuffer) {
          try {
            const event = JSON.parse(this.jsonBuffer);
            events.push(event);
          } catch (e) {
            // Incomplete JSON, keep buffering
          }
          this.jsonBuffer = '';
        }
        continue;
      }
      
      // Skip event type labels like "stream_event:"
      if (trimmed.match(/^(session_init|stream_event|tool_use_from_stream):/)) {
        if (this.jsonBuffer) {
          try {
            const event = JSON.parse(this.jsonBuffer);
            events.push(event);
          } catch (e) {
            // Skip malformed JSON
          }
        }
        this.jsonBuffer = '';
        continue;
      }
      
      // Accumulate JSON lines
      this.jsonBuffer += trimmed;
      
      // Try to parse when we might have complete JSON
      if (trimmed.endsWith('}') || trimmed.endsWith('},')) {
        try {
          const cleanJson = this.jsonBuffer.replace(/,$/, '');
          const event = JSON.parse(cleanJson);
          events.push(event);
          this.jsonBuffer = '';
        } catch (e) {
          // Not complete yet, keep buffering
        }
      }
    }
    
    return events;
  }

  /**
   * Handle a single event from the stream
   */
  handleEvent(event) {
    // Session info
    if (event.session_id) {
      this.state.metadata.sessionId = event.session_id;
      this.state.metadata.model = event.model;
    }

    // Message start - get message ID
    if (event.type === 'message_start' && event.message) {
      this.state.metadata.messageId = event.message.id;
      if (event.message.usage) {
        this.updateUsage(event.message.usage);
      }
    }

    // Text delta - Claude is saying something
    if (event.type === 'content_block_delta' && event.delta) {
      if (event.delta.type === 'text_delta') {
        const text = this.unescapeText(event.delta.text);
        this.state.assistantText += text;
        
        // Add to chronological events
        this.state.chronologicalEvents.push({
          type: 'text',
          content: text,
          timestamp: new Date().toISOString()
        });
        
        // Check for markdown tables in the text
        this.detectAndParseTables();
        
        // Notify frontend
        this.callbacks.onTextUpdate(text, this.state.assistantText);
      }
      
      // Thinking delta - Claude's internal reasoning
      if (event.delta.type === 'thinking_delta') {
        const thinking = this.unescapeText(event.delta.thinking);
        this.state.thinking += thinking;
        
        this.state.chronologicalEvents.push({
          type: 'thinking',
          content: thinking,
          timestamp: new Date().toISOString()
        });
        
        this.callbacks.onThinkingUpdate(thinking, this.state.thinking);
      }
      
      // Input JSON delta - Tool parameters being built
      if (event.delta.type === 'input_json_delta') {
        const command = this.unescapeText(event.delta.partial_json);
        this.currentToolInput += command;
        this.state.toolCommands.push(command);
        this.state.fullToolCommand += command;

        this.state.chronologicalEvents.push({
          type: 'tool_command',
          content: command,
          timestamp: new Date().toISOString()
        });

        this.callbacks.onToolCommand(command, this.state.fullToolCommand);
      }
    }

    // Tool use - Claude is calling a tool
    if (event.type === 'content_block_start' && event.content_block) {
      if (event.content_block.type === 'tool_use') {
        const toolInfo = {
          id: event.content_block.id,
          name: event.content_block.name,
          input: null  // Will be populated when complete
        };

        // Reset the input buffer for this new tool
        this.currentToolInput = '';

        this.state.toolUses.push(toolInfo);

        this.state.chronologicalEvents.push({
          type: 'tool_use',
          content: toolInfo,
          timestamp: new Date().toISOString()
        });

        this.callbacks.onToolUse(toolInfo);
      }
    }

    // Tool use complete - parse the accumulated input
    if (event.type === 'content_block_stop') {
      if (this.currentToolInput && this.state.toolUses.length > 0) {
        const lastTool = this.state.toolUses[this.state.toolUses.length - 1];
        try {
          lastTool.input = JSON.parse(this.currentToolInput);
        } catch (e) {
          // If parsing fails, store as raw string
          lastTool.input = this.currentToolInput;
        }
        
        // Add to chronological events
        this.state.chronologicalEvents.push({
          type: 'tool_complete',
          content: lastTool,
          timestamp: new Date().toISOString()
        });
        
        // Notify frontend that this tool is complete with all its parameters!
        this.callbacks.onToolComplete(lastTool);
        
        this.currentToolInput = '';
      }
    }

    // Usage updates
    if (event.type === 'message_delta' && event.usage) {
      this.updateUsage(event.usage);
    }

    // Stream complete
    if (event.type === 'message_stop') {
      this.state.isComplete = true;
      this.callbacks.onComplete(this.getState());
    }
  }

  /**
   * Detect and parse markdown tables in the assistant text
   */
  detectAndParseTables() {
    // Regex to find markdown tables (must have header, separator, and at least one row)
    const tableRegex = /(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n?)+)/g;
    
    const matches = [...this.state.assistantText.matchAll(tableRegex)];
    
    // Only process if we found more tables than we've already stored
    if (matches.length > this.state.tables.length) {
      // Parse the new tables
      for (let i = this.state.tables.length; i < matches.length; i++) {
        const rawTable = matches[i][1];
        const parsedTable = this.parseMarkdownTable(rawTable);
        
        if (parsedTable) {
          this.state.tables.push(parsedTable);
          
          // Add to chronological events
          this.state.chronologicalEvents.push({
            type: 'table',
            content: parsedTable,
            timestamp: new Date().toISOString()
          });
          
          // Notify frontend
          this.callbacks.onTableDetected(parsedTable, this.state.tables);
        }
      }
    }
  }

  /**
   * Parse a markdown table string into structured data
   */
  parseMarkdownTable(tableText) {
    try {
      const lines = tableText.trim().split('\n').filter(line => line.trim());
      
      if (lines.length < 3) return null; // Need header, separator, and at least one row
      
      // Parse header
      const headerLine = lines[0];
      const headers = headerLine
        .split('|')
        .filter(cell => cell.trim())
        .map(cell => cell.trim());
      
      // Skip separator line (lines[1])
      
      // Parse data rows
      const rows = [];
      for (let i = 2; i < lines.length; i++) {
        const row = lines[i]
          .split('|')
          .filter(cell => cell.trim())
          .map(cell => cell.trim());
        
        if (row.length > 0) {
          rows.push(row);
        }
      }
      
      return {
        headers,
        rows,
        rowCount: rows.length,
        columnCount: headers.length,
        rawText: tableText
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Update token usage statistics
   */
  updateUsage(usage) {
    this.state.usage = {
      inputTokens: usage.input_tokens || this.state.usage.inputTokens || 0,
      outputTokens: usage.output_tokens || this.state.usage.outputTokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || 0
    };
    
    this.state.usage.totalTokens = 
      this.state.usage.inputTokens + this.state.usage.outputTokens;
  }

  /**
   * Unescape JSON strings
   * Converts things like \\n to actual newlines
   */
  unescapeText(text) {
    if (!text) return '';
    
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\\//g, '/')
      .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => 
        String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\\/g, '\\');
  }

  /**
   * Get the current state (for your frontend to display)
   */
  getState() {
    return {
      ...this.state,
      // Add some helpful computed properties
      stats: {
        textLength: this.state.assistantText.length,
        thinkingLength: this.state.thinking.length,
        wordCount: this.state.assistantText.split(/\s+/).filter(w => w).length,
        toolCount: this.state.toolUses.length,
        commandParts: this.state.toolCommands.length,
        totalEvents: this.state.chronologicalEvents.length
      }
    };
  }

  /**
   * Reset the parser (if you want to parse a new stream)
   */
  reset() {
    this.state = {
      metadata: {},
      thinking: '',
      assistantText: '',
      toolUses: [],
      toolCommands: [],
      fullToolCommand: '',
      tables: [],
      chronologicalEvents: [],
      usage: {},
      isComplete: false
    };
    this.buffer = '';
    this.jsonBuffer = '';
    this.currentToolInput = '';
  }
}

/**
 * Simple Complete Log Parser
 * Use this when you already have the complete log and just want to analyze it
 */
function parseCompleteLog(logText) {
  const result = {
    assistantText: '',
    thinking: '',
    toolUses: [],
    toolCommands: [],
    fullToolCommand: '',
    metadata: {},
    usage: {},
    stats: {}
  };

  // Extract all text_delta events (what Claude says)
  const textDeltaRegex = /"type":\s*"text_delta"[^}]*"text":\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  
  while ((match = textDeltaRegex.exec(logText)) !== null) {
    const text = unescapeText(match[1]);
    result.assistantText += text;
  }

  // Extract thinking
  const thinkingDeltaRegex = /"type":\s*"thinking_delta"[^}]*"thinking":\s*"((?:[^"\\]|\\.)*)"/g;
  
  while ((match = thinkingDeltaRegex.exec(logText)) !== null) {
    const thinking = unescapeText(match[1]);
    result.thinking += thinking;
  }

  // Extract tool uses with their inputs
  const lines = logText.split('\n');
  let currentToolId = null;
  let currentToolName = null;
  let currentToolInput = '';

  for (const line of lines) {
    // Check for tool_use start
    const toolUseMatch = line.match(/"type":\s*"tool_use"[^}]*"id":\s*"([^"]+)"[^}]*"name":\s*"([^"]+)"/);
    if (toolUseMatch) {
      // Save previous tool if exists
      if (currentToolId) {
        let parsedInput = null;
        try {
          parsedInput = currentToolInput ? JSON.parse(currentToolInput) : null;
        } catch (e) {
          parsedInput = currentToolInput;
        }
        result.toolUses.push({
          id: currentToolId,
          name: currentToolName,
          input: parsedInput
        });
      }

      // Start new tool
      currentToolId = toolUseMatch[1];
      currentToolName = toolUseMatch[2];
      currentToolInput = '';
    }

    // Check for input_json_delta
    const inputJsonMatch = line.match(/"type":\s*"input_json_delta"[^}]*"partial_json":\s*"((?:[^"\\]|\\.)*)"/);
    if (inputJsonMatch && currentToolId) {
      const command = unescapeText(inputJsonMatch[1]);
      currentToolInput += command;
      result.toolCommands.push(command);
      result.fullToolCommand += command;
    }

    // Check for content_block_stop
    if (line.match(/"type":\s*"content_block_stop"/) && currentToolId) {
      let parsedInput = null;
      try {
        parsedInput = currentToolInput ? JSON.parse(currentToolInput) : null;
      } catch (e) {
        parsedInput = currentToolInput;
      }
      result.toolUses.push({
        id: currentToolId,
        name: currentToolName,
        input: parsedInput
      });
      currentToolId = null;
      currentToolName = null;
      currentToolInput = '';
    }
  }

  // Handle last tool if stream ended without content_block_stop
  if (currentToolId) {
    let parsedInput = null;
    try {
      parsedInput = currentToolInput ? JSON.parse(currentToolInput) : null;
    } catch (e) {
      parsedInput = currentToolInput;
    }
    result.toolUses.push({
      id: currentToolId,
      name: currentToolName,
      input: parsedInput
    });
  }

  // Extract metadata
  const sessionMatch = logText.match(/"session_id":\s*"([^"]+)"/);
  if (sessionMatch) result.metadata.sessionId = sessionMatch[1];

  const modelMatch = logText.match(/"model":\s*"([^"]+)"/);
  if (modelMatch) result.metadata.model = modelMatch[1];

  const messageIdMatch = logText.match(/"id":\s*"(msg_[^"]+)"/);
  if (messageIdMatch) result.metadata.messageId = messageIdMatch[1];

  // Calculate stats
  result.stats = {
    textLength: result.assistantText.length,
    thinkingLength: result.thinking.length,
    wordCount: result.assistantText.split(/\s+/).filter(w => w).length,
    toolCount: result.toolUses.length,
    commandParts: result.toolCommands.length
  };

  return result;
}

/**
 * Helper function to unescape text
 */
function unescapeText(text) {
  if (!text) return '';
  
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\//g, '/')
    .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => 
      String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\\/g, '\\');
}

/**
 * Format the results in a nice, readable way
 * Perfect for displaying in your UI!
 */
function formatResults(parsedData) {
  const lines = [];
  
  lines.push('=== Claude Tool Stream Analysis ===');
  lines.push('');
  
  // 1. Metadata
  if (parsedData.metadata && Object.keys(parsedData.metadata).length > 0) {
    lines.push('📋 METADATA:');
    if (parsedData.metadata.sessionId) {
      lines.push(`   Session: ${parsedData.metadata.sessionId}`);
    }
    if (parsedData.metadata.model) {
      lines.push(`   Model: ${parsedData.metadata.model}`);
    }
    lines.push('');
  }
  
  // 2. Assistant text
  lines.push('💬 ASSISTANT TEXT:');
  if (parsedData.assistantText) {
    lines.push(`   "${parsedData.assistantText}"`);
  } else {
    lines.push('   (No text yet)');
  }
  lines.push('');
  
  // 3. Thinking process (if any)
  if (parsedData.thinking) {
    lines.push('🤔 THINKING PROCESS:');
    lines.push(`   "${parsedData.thinking}"`);
    lines.push('');
  }
  
  // 4. Tools used
  lines.push('🔧 TOOLS USED:');
  if (parsedData.toolUses && parsedData.toolUses.length > 0) {
    parsedData.toolUses.forEach((tool, idx) => {
      lines.push(`   ${idx + 1}. ${tool.name} (ID: ${tool.id})`);
      if (tool.input) {
        const inputStr = typeof tool.input === 'object'
          ? JSON.stringify(tool.input, null, 2).split('\n').map(line => `      ${line}`).join('\n')
          : `      ${tool.input}`;
        lines.push(`      Input: ${inputStr}`);
      }
    });
  } else {
    lines.push('   (No tools used yet)');
  }
  lines.push('');
  
  // 5. Tool commands
  lines.push('⚙️ TOOL COMMANDS:');
  if (parsedData.fullToolCommand) {
    lines.push(`   ${parsedData.fullToolCommand}`);
  } else {
    lines.push('   (No commands yet)');
  }
  lines.push('');
  
  // 6. Stats
  if (parsedData.stats) {
    lines.push('📊 STATISTICS:');
    lines.push(`   Text length: ${parsedData.stats.textLength} characters`);
    lines.push(`   Word count: ${parsedData.stats.wordCount}`);
    lines.push(`   Tools used: ${parsedData.stats.toolCount}`);
    lines.push(`   Command parts: ${parsedData.stats.commandParts}`);
    if (parsedData.stats.totalEvents) {
      lines.push(`   Total events: ${parsedData.stats.totalEvents}`);
    }
  }
  
  return lines.join('\n');
}

// Export everything for use in other files
export {
  FrontendStreamParser,
  parseCompleteLog,
  formatResults
};

