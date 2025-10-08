/**
 * Enhanced Frontend-Friendly Claude Stream Parser
 * Now properly displays tool usage in the output!
 */

class FrontendStreamParser {
  constructor(callbacks = {}) {
    this.callbacks = {
      onTextUpdate: callbacks.onTextUpdate || (() => {}),
      onThinkingUpdate: callbacks.onThinkingUpdate || (() => {}),
      onToolUse: callbacks.onToolUse || (() => {}),
      onToolCommand: callbacks.onToolCommand || (() => {}),
      onToolComplete: callbacks.onToolComplete || (() => {}),
      onTableDetected: callbacks.onTableDetected || (() => {}),
      onComplete: callbacks.onComplete || (() => {}),
      onError: callbacks.onError || (() => {})
    };
    
    this.state = {
      metadata: {
        sessionId: '',
        messageId: '',
        model: '',
        startTime: ''
      },
      thinking: '',
      assistantText: '',
      toolUses: [],
      toolCommands: [],
      fullToolCommand: '',
      tables: [],
      chronologicalEvents: [],
      webSearchActivity: [],  // Raw web search events
      toolActivity: [],  // All tool activity (WebSearch, WebFetch, etc.)
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      },
      isComplete: false
    };

    this.buffer = '';
    this.jsonBuffer = '';
    this.currentToolInput = '';
    this.currentToolName = '';
    this.currentToolId = '';
    this.isWebSearchActive = false;  // Track if we're in a web search
    this.isToolActive = false;  // Track if any tool is active
  }

  processChunk(chunk) {
    try {
      this.buffer += chunk;
      const events = this.extractEvents();
      events.forEach(event => {
        this.handleEvent(event);
      });
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  extractEvents() {
    const events = [];
    const lines = this.buffer.split('\n');
    
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Look for tool_use_from_stream lines - these are special
      if (trimmed.includes('tool_use_from_stream:')) {
        // Process any buffered JSON first
        if (this.jsonBuffer) {
          try {
            const event = JSON.parse(this.jsonBuffer);
            events.push(event);
          } catch (e) {}
          this.jsonBuffer = '';
        }
        continue;
      }

      // Look for input_json_delta lines
      if (trimmed.includes('input_json_delta:')) {
        // Get the next line which should have the partial data
        continue;
      }
      
      // Skip timestamp lines
      if (trimmed.startsWith('[') && trimmed.includes(']')) {
        if (this.jsonBuffer) {
          try {
            const event = JSON.parse(this.jsonBuffer);
            events.push(event);
          } catch (e) {}
          this.jsonBuffer = '';
        }
        continue;
      }
      
      // Skip event type labels
      if (trimmed.match(/^(session_init|stream_event|tool_use_from_stream):/)) {
        if (this.jsonBuffer) {
          try {
            const event = JSON.parse(this.jsonBuffer);
            events.push(event);
          } catch (e) {}
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
          // Not complete yet
        }
      }
    }
    
    return events;
  }

  handleEvent(event) {
    // Session info
    if (event.session_id) {
      this.state.metadata.sessionId = event.session_id;
      this.state.metadata.model = event.model;
    }

    // Message start
    if (event.type === 'message_start' && event.message) {
      this.state.metadata.messageId = event.message.id;
      if (event.message.usage) {
        this.updateUsage(event.message.usage);
      }
    }

    // Text delta
    if (event.type === 'content_block_delta' && event.delta) {
      if (event.delta.type === 'text_delta') {
        const text = this.unescapeText(event.delta.text);
        this.state.assistantText += text;
        
        this.state.chronologicalEvents.push({
          type: 'text',
          content: text,
          timestamp: new Date().toISOString()
        });
        
        this.detectAndParseTables();
        this.callbacks.onTextUpdate(text, this.state.assistantText);
      }
      
      // Thinking delta
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

        // Track ALL tool activity in toolActivity array
        if (this.isToolActive && this.currentToolName) {
          // Try to extract meaningful parameters
          const queryMatch = this.currentToolInput.match(/"query":\s*"([^"]+)"/);
          const urlMatch = this.currentToolInput.match(/"url":\s*"([^"]+)"/);
          const promptMatch = this.currentToolInput.match(/"prompt":\s*"([^"]+)"/);

          if (queryMatch) {
            const lastActivity = this.state.toolActivity[this.state.toolActivity.length - 1];
            if (!lastActivity || !lastActivity.includes('Query:')) {
              this.state.toolActivity.push(`  → Query: "${queryMatch[1]}"`);
            }
          }

          if (urlMatch) {
            const lastActivity = this.state.toolActivity[this.state.toolActivity.length - 1];
            if (!lastActivity || !lastActivity.includes('URL:')) {
              this.state.toolActivity.push(`  → URL: ${urlMatch[1]}`);
            }
          }

          if (promptMatch) {
            const lastActivity = this.state.toolActivity[this.state.toolActivity.length - 1];
            if (!lastActivity || !lastActivity.includes('Prompt:')) {
              const truncatedPrompt = promptMatch[1].length > 100 ?
                promptMatch[1].substring(0, 100) + '...' : promptMatch[1];
              this.state.toolActivity.push(`  → Prompt: "${truncatedPrompt}"`);
            }
          }
        }

        // If web search, push raw activity (keep original logic for backward compatibility)
        if (this.isWebSearchActive) {
          // Push every chunk as raw activity to show "something happening"
          // Try to extract query/search_term from accumulated input
          const potentialMatch = this.currentToolInput.match(/"(search_term|query)":\s*"([^"]+)"/);
          if (potentialMatch && command.includes('"')) {
            // Only show the search query once when we detect it's complete enough
            const lastActivity = this.state.webSearchActivity[this.state.webSearchActivity.length - 1];
            if (!lastActivity || !lastActivity.includes('Searching for:')) {
              this.state.webSearchActivity.push(`  → Searching for: "${potentialMatch[2]}"`);
            }
          } else {
            // Show raw activity chunks to indicate processing
            const cleanChunk = command.replace(/[\r\n]+/g, ' ').substring(0, 50);
            if (cleanChunk.trim().length > 0) {
              this.state.webSearchActivity.push(`  ⚡ Processing: ${cleanChunk}...`);
            }
          }
        }

        this.state.chronologicalEvents.push({
          type: 'tool_command',
          content: command,
          timestamp: new Date().toISOString()
        });

        this.callbacks.onToolCommand(command, this.state.fullToolCommand);
      }
    }

    // Tool use start
    if (event.type === 'content_block_start' && event.content_block) {
      if (event.content_block.type === 'tool_use') {
        this.currentToolId = event.content_block.id;
        this.currentToolName = event.content_block.name;
        this.currentToolInput = '';

        // Check if this is a web search tool
        this.isWebSearchActive = (this.currentToolName === 'WebSearch' || this.currentToolName === 'web_search');
        this.isToolActive = true;

        const toolInfo = {
          id: this.currentToolId,
          name: this.currentToolName,
          input: null
        };

        this.state.toolUses.push(toolInfo);

        this.state.chronologicalEvents.push({
          type: 'tool_use',
          content: toolInfo,
          timestamp: new Date().toISOString()
        });

        // Add tool start to activity log
        const toolEmoji = this.currentToolName === 'WebSearch' ? '🔍' :
                         this.currentToolName === 'WebFetch' ? '📄' : '🔧';
        this.state.toolActivity.push(`${toolEmoji} Starting ${this.currentToolName}...`);

        // If web search, add to web search specific activity log
        if (this.isWebSearchActive) {
          this.state.webSearchActivity.push(`🔍 Starting web search...`);
        }

        this.callbacks.onToolUse(toolInfo);
      }
    }

    // Tool use complete
    if (event.type === 'content_block_stop') {
      if (this.currentToolInput && this.state.toolUses.length > 0) {
        const lastTool = this.state.toolUses[this.state.toolUses.length - 1];
        try {
          lastTool.input = JSON.parse(this.currentToolInput);
        } catch (e) {
          lastTool.input = this.currentToolInput;
        }

        this.state.chronologicalEvents.push({
          type: 'tool_complete',
          content: lastTool,
          timestamp: new Date().toISOString()
        });

        this.callbacks.onToolComplete(lastTool);

        // Add completion message to tool activity
        if (this.isToolActive) {
          const toolEmoji = this.currentToolName === 'WebSearch' ? '✅' :
                           this.currentToolName === 'WebFetch' ? '✅' : '✅';
          this.state.toolActivity.push(`${toolEmoji} ${this.currentToolName} completed\n`);
        }

        // If web search just completed, add completion message
        if (this.isWebSearchActive) {
          this.state.webSearchActivity.push(`✅ Web search completed`);
          this.isWebSearchActive = false;
        }

        // Reset current tool tracking
        this.currentToolInput = '';
        this.currentToolName = '';
        this.currentToolId = '';
        this.isToolActive = false;
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

  detectAndParseTables() {
    const tableRegex = /(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n?)+)/g;
    const matches = [...this.state.assistantText.matchAll(tableRegex)];
    
    if (matches.length > this.state.tables.length) {
      for (let i = this.state.tables.length; i < matches.length; i++) {
        const rawTable = matches[i][1];
        const parsedTable = this.parseMarkdownTable(rawTable);
        
        if (parsedTable) {
          this.state.tables.push(parsedTable);
          
          this.state.chronologicalEvents.push({
            type: 'table',
            content: parsedTable,
            timestamp: new Date().toISOString()
          });
          
          this.callbacks.onTableDetected(parsedTable, this.state.tables);
        }
      }
    }
  }

  parseMarkdownTable(tableText) {
    try {
      const lines = tableText.trim().split('\n').filter(line => line.trim());
      
      if (lines.length < 3) return null;
      
      const headers = lines[0]
        .split('|')
        .filter(cell => cell.trim())
        .map(cell => cell.trim());
      
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

  updateUsage(usage) {
    this.state.usage = {
      inputTokens: usage.input_tokens || this.state.usage.inputTokens || 0,
      outputTokens: usage.output_tokens || this.state.usage.outputTokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || 0
    };
    
    this.state.usage.totalTokens = 
      this.state.usage.inputTokens + this.state.usage.outputTokens;
  }

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

  getState() {
    return {
      ...this.state,
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
   * Get formatted output with tool usage included
   */
  getFormattedOutput() {
    let output = this.state.assistantText;

    // Add COMPLETE tool activity log (includes ALL tools: WebSearch, WebFetch, etc.)
    if (this.state.toolActivity.length > 0) {
      output += '\n\n---\n### 🔧 Tool Activity Log:\n';
      output += '```\n';
      this.state.toolActivity.forEach((activity) => {
        output += `${activity}\n`;
      });
      output += '```\n';
    }

    // Add web search activity if any (legacy - kept for backward compatibility)
    if (this.state.webSearchActivity.length > 0) {
      output += '\n\n---\n### 🌐 Web Search Activity (Detailed):\n';
      output += '```\n';
      this.state.webSearchActivity.forEach((activity) => {
        output += `${activity}\n`;
      });
      output += '```\n';
    }

    // Add tool usage summary at the end with full details
    if (this.state.toolUses.length > 0) {
      output += '\n\n---\n### 📋 Tools Summary:\n';
      this.state.toolUses.forEach((tool, idx) => {
        output += `\n**${idx + 1}. ${tool.name}** (ID: ${tool.id})\n`;
        if (tool.input) {
          if (tool.input.query) {
            output += `   - Query: "${tool.input.query}"\n`;
          }
          if (tool.input.url) {
            output += `   - URL: ${tool.input.url}\n`;
          }
          if (tool.input.prompt) {
            const truncated = tool.input.prompt.length > 150 ?
              tool.input.prompt.substring(0, 150) + '...' : tool.input.prompt;
            output += `   - Prompt: "${truncated}"\n`;
          }
        }
      });
    }

    return output;
  }

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
      webSearchActivity: [],
      toolActivity: [],
      usage: {},
      isComplete: false
    };
    this.buffer = '';
    this.jsonBuffer = '';
    this.currentToolInput = '';
    this.currentToolName = '';
    this.currentToolId = '';
    this.isWebSearchActive = false;
    this.isToolActive = false;
  }
}

/**
 * Enhanced parseCompleteLog function that properly extracts tool usage
 */
function parseCompleteLog(logText) {
  const parser = new FrontendStreamParser();
  
  // Split the log into chunks and process them
  const chunks = logText.split('\n');
  let currentChunk = '';
  
  for (const line of chunks) {
    currentChunk += line + '\n';
    
    // Process chunks at logical boundaries
    if (line.includes('stream_event') || line.includes('tool_use_from_stream') || line.includes('session_complete')) {
      parser.processChunk(currentChunk);
      currentChunk = '';
    }
  }
  
  // Process any remaining chunk
  if (currentChunk) {
    parser.processChunk(currentChunk);
  }
  
  // Return the parsed state with formatted output
  const state = parser.getState();
  return {
    ...state,
    formattedOutput: parser.getFormattedOutput()
  };
}

/**
 * Format the results in a nice, readable way with tool usage
 */
function formatResults(parsedData) {
  // If we have formattedOutput, just return that
  if (parsedData.formattedOutput) {
    return parsedData.formattedOutput;
  }
  
  // Otherwise format manually
  const lines = [];
  
  // Add the main assistant text
  if (parsedData.assistantText) {
    lines.push(parsedData.assistantText);
  }
  
  // Add tool usage if present
  if (parsedData.toolUses && parsedData.toolUses.length > 0) {
    lines.push('\n\n---\n### 🔧 Tools Used:\n');
    parsedData.toolUses.forEach((tool, idx) => {
      lines.push(`**${idx + 1}. ${tool.name}**`);
      if (tool.input) {
        if (typeof tool.input === 'object') {
          Object.entries(tool.input).forEach(([key, value]) => {
            lines.push(`   - ${key}: ${JSON.stringify(value)}`);
          });
        } else {
          lines.push(`   - Input: ${tool.input}`);
        }
      }
    });
  }
  
  return lines.join('\n');
}

// Export everything
export {
  FrontendStreamParser,
  parseCompleteLog,
  formatResults
};

