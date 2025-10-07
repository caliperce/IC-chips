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
      onToolUse: callbacks.onToolUse || (() => {}),            // Tool is being used
      onToolCommand: callbacks.onToolCommand || (() => {}),    // Tool parameters
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
      toolUses: [],          // Which tools Claude used: [{name: 'grep', id: '123'}]
      toolCommands: [],      // Tool parameters in order: ['{"pattern":"test"}', '...']
      fullToolCommand: '',   // All tool commands combined
      
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
          name: event.content_block.name
        };
        
        this.state.toolUses.push(toolInfo);
        
        this.state.chronologicalEvents.push({
          type: 'tool_use',
          content: toolInfo,
          timestamp: new Date().toISOString()
        });
        
        this.callbacks.onToolUse(toolInfo);
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
      chronologicalEvents: [],
      usage: {},
      isComplete: false
    };
    this.buffer = '';
    this.jsonBuffer = '';
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

  // Extract tool uses
  const toolUseRegex = /"type":\s*"tool_use"[^}]*"id":\s*"([^"]+)"[^}]*"name":\s*"([^"]+)"/g;
  
  while ((match = toolUseRegex.exec(logText)) !== null) {
    result.toolUses.push({
      id: match[1],
      name: match[2]
    });
  }

  // Extract tool commands (input_json_delta)
  const inputJsonDeltaRegex = /"type":\s*"input_json_delta"[^}]*"partial_json":\s*"((?:[^"\\]|\\.)*)"/g;
  
  while ((match = inputJsonDeltaRegex.exec(logText)) !== null) {
    const command = unescapeText(match[1]);
    result.toolCommands.push(command);
    result.fullToolCommand += command;
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

