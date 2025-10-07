/**
 * Claude Stream Parser - Handles both real-time streaming and post-processing
 */

import fs from 'fs';

/**
 * Real-time Stream Handler with Structured Output
 * Processes events as they arrive during streaming
 */
class ClaudeStreamHandler {
  constructor(callbacks = {}) {
    this.callbacks = {
      onMetadata: callbacks.onMetadata || (() => {}),
      onThinking: callbacks.onThinking || (() => {}),
      onTextDelta: callbacks.onTextDelta || (() => {}),
      onComplete: callbacks.onComplete || (() => {}),
      onError: callbacks.onError || (() => {})
    };
    
    this.state = {
      metadata: {},
      thinking: '',
      response: '',
      usage: {},
      links: [],
      fragments: [],
      isComplete: false
    };
    
    this.buffer = '';
    this.jsonBuffer = '';
  }

  /**
   * Process incoming stream chunk (real-time)
   */
  processChunk(chunk) {
    try {
      this.buffer += chunk;
      
      // Try to extract complete JSON events from buffer
      const events = this.extractEvents();
      
      events.forEach(event => {
        this.handleEvent(event);
      });
      
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  /**
   * Extract complete JSON events from buffer
   */
  extractEvents() {
    const events = [];
    const lines = this.buffer.split('\n');
    
    // Keep the last line in buffer if it's incomplete
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Handle multi-line JSON objects
      if (trimmed.startsWith('[') && trimmed.includes(']')) {
        // Start of a new event - process any buffered JSON
        if (this.jsonBuffer) {
          try {
            const event = JSON.parse(this.jsonBuffer);
            events.push(event);
          } catch (e) {
            // Incomplete JSON, continue buffering
          }
          this.jsonBuffer = '';
        }
        continue; // Skip timestamp lines
      }
      
      // Check if line contains event type (session_init, stream_event, etc)
      if (trimmed.match(/^(session_init|stream_event|session_complete):/)) {
        // Process previous JSON if exists
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
      
      // Try to parse if we have complete JSON
      if (trimmed.endsWith('}') || trimmed.endsWith('},')) {
        try {
          const cleanJson = this.jsonBuffer.replace(/,$/, ''); // Remove trailing comma
          const event = JSON.parse(cleanJson);
          events.push(event);
          this.jsonBuffer = '';
        } catch (e) {
          // Continue buffering, JSON might not be complete
        }
      }
    }
    
    return events;
  }

  /**
   * Handle individual stream event
   */
  handleEvent(event) {
    // Session initialization
    if (event.session_id) {
      this.state.metadata.sessionId = event.session_id;
      this.state.metadata.model = event.model;
      this.callbacks.onMetadata(this.state.metadata);
    }

    // Message start
    if (event.type === 'message_start' && event.message) {
      this.state.metadata.messageId = event.message.id;
      this.state.metadata.model = event.message.model;
      
      if (event.message.usage) {
        this.updateUsage(event.message.usage);
      }
      
      this.callbacks.onMetadata(this.state.metadata);
    }

    // Content block start
    if (event.type === 'content_block_start' && event.content_block) {
      if (event.content_block.type === 'thinking') {
        // Extended thinking started
      }
    }

    // Content block delta (text or thinking)
    if (event.type === 'content_block_delta' && event.delta) {
      if (event.delta.type === 'text_delta') {
        const text = this.unescapeText(event.delta.text);
        this.state.response += text;
        this.state.fragments.push(text);
        
        // Extract links from this fragment
        this.extractLinksFromText(text);
        
        this.callbacks.onTextDelta(text, this.state.response);
      } else if (event.delta.type === 'thinking_delta') {
        const thinking = this.unescapeText(event.delta.thinking);
        this.state.thinking += thinking;
        this.callbacks.onThinking(thinking, this.state.thinking);
      }
    }

    // Message delta (stop reason, usage update)
    if (event.type === 'message_delta') {
      if (event.delta && event.delta.stop_reason) {
        this.state.metadata.stopReason = event.delta.stop_reason;
      }
      
      if (event.usage) {
        this.updateUsage(event.usage);
      }
    }

    // Message stop (completion)
    if (event.type === 'message_stop') {
      this.state.isComplete = true;
      this.callbacks.onComplete(this.state);
    }
  }

  /**
   * Update usage statistics
   */
  updateUsage(usage) {
    this.state.usage = {
      inputTokens: usage.input_tokens || this.state.usage.inputTokens || 0,
      outputTokens: usage.output_tokens || this.state.usage.outputTokens || 0,
      cacheCreationTokens: usage.cache_creation_input_tokens || this.state.usage.cacheCreationTokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || this.state.usage.cacheReadTokens || 0
    };
    
    this.state.usage.totalTokens = 
      this.state.usage.inputTokens + this.state.usage.outputTokens;
  }

  /**
   * Extract links from text fragment
   */
  extractLinksFromText(text) {
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
    let match;
    
    while ((match = urlRegex.exec(text)) !== null) {
      this.state.links.push(match[1]);
    }
  }

  /**
   * Unescape JSON text
   */
  unescapeText(text) {
    if (!text) return '';
    
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\\//g, '/')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\\/g, '\\');
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Reset handler
   */
  reset() {
    this.state = {
      metadata: {},
      thinking: '',
      response: '',
      usage: {},
      links: [],
      fragments: [],
      isComplete: false
    };
    this.buffer = '';
    this.jsonBuffer = '';
  }
}

/**
 * Post-processing Parser (for complete logs)
 * Processes entire log after streaming is finished
 */
class ClaudeStreamParser {
  constructor(logText) {
    this.logText = logText;
    this.parsed = {
      metadata: {},
      thinking: [],
      response: '',
      fragments: [],
      usage: {},
      links: [],
      timestamps: []
    };
  }

  parse() {
    this.extractMetadata();
    this.extractThinking();
    this.extractResponse();
    this.extractUsage();
    this.extractTimestamps();
    return this.parsed;
  }

  extractMetadata() {
    const sessionMatch = this.logText.match(/"session_id":\s*"([^"]+)"/);
    if (sessionMatch) this.parsed.metadata.sessionId = sessionMatch[1];

    const modelMatch = this.logText.match(/"model":\s*"([^"]+)"/);
    if (modelMatch) this.parsed.metadata.model = modelMatch[1];

    const startTimeMatch = this.logText.match(/started\s+([\d-T:.Z]+)\)/);
    if (startTimeMatch) this.parsed.metadata.startTime = startTimeMatch[1];

    const messageIdMatch = this.logText.match(/"id":\s*"(msg_[^"]+)"/);
    if (messageIdMatch) this.parsed.metadata.messageId = messageIdMatch[1];

    const stopReasonMatch = this.logText.match(/"stop_reason":\s*"([^"]+)"/);
    if (stopReasonMatch) this.parsed.metadata.stopReason = stopReasonMatch[1];

    const permissionMatch = this.logText.match(/"permission_mode":\s*"([^"]+)"/);
    if (permissionMatch) this.parsed.metadata.permissionMode = permissionMatch[1];
  }

  extractThinking() {
    const thinkingBlockRegex = /"type":\s*"thinking"[\s\S]*?"text":\s*"((?:[^"\\]|\\.)*)"/g;
    let match;
    
    while ((match = thinkingBlockRegex.exec(this.logText)) !== null) {
      this.parsed.thinking.push(this.unescapeText(match[1]));
    }

    const thinkingDeltaRegex = /"type":\s*"thinking_delta"[\s\S]*?"thinking":\s*"((?:[^"\\]|\\.)*)"/g;
    
    while ((match = thinkingDeltaRegex.exec(this.logText)) !== null) {
      this.parsed.thinking.push(this.unescapeText(match[1]));
    }
  }

  extractResponse() {
    const textDeltaRegex = /"type":\s*"text_delta"[^}]*"text":\s*"((?:[^"\\]|\\.)*)"/g;
    let match;
    let fullText = '';
    
    while ((match = textDeltaRegex.exec(this.logText)) !== null) {
      const fragment = this.unescapeText(match[1]);
      fullText += fragment;
      this.parsed.fragments.push({
        text: fragment,
        raw: match[1]
      });
    }
    
    this.parsed.response = fullText;
    this.extractLinks();
  }

  extractLinks() {
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
    let match;
    
    while ((match = urlRegex.exec(this.parsed.response)) !== null) {
      this.parsed.links.push({
        url: match[1],
        position: match.index
      });
    }
  }

  extractUsage() {
    const usageBlocks = [];
    const usageRegex = /"usage":\s*\{([^}]+)\}/g;
    let match;
    
    while ((match = usageRegex.exec(this.logText)) !== null) {
      usageBlocks.push(match[1]);
    }
    
    if (usageBlocks.length > 0) {
      const lastUsage = usageBlocks[usageBlocks.length - 1];
      
      const inputMatch = lastUsage.match(/"input_tokens":\s*(\d+)/);
      if (inputMatch) this.parsed.usage.inputTokens = parseInt(inputMatch[1]);
      
      const outputMatch = lastUsage.match(/"output_tokens":\s*(\d+)/);
      if (outputMatch) this.parsed.usage.outputTokens = parseInt(outputMatch[1]);
      
      const cacheCreationMatch = lastUsage.match(/"cache_creation_input_tokens":\s*(\d+)/);
      if (cacheCreationMatch) this.parsed.usage.cacheCreationTokens = parseInt(cacheCreationMatch[1]);
      
      const cacheReadMatch = lastUsage.match(/"cache_read_input_tokens":\s*(\d+)/);
      if (cacheReadMatch) this.parsed.usage.cacheReadTokens = parseInt(cacheReadMatch[1]);
      
      this.parsed.usage.totalTokens = 
        (this.parsed.usage.inputTokens || 0) + 
        (this.parsed.usage.outputTokens || 0);
    }
  }

  extractTimestamps() {
    const timestampRegex = /\[([\d-T:.Z]+)\]\s+(\w+):/g;
    let match;
    
    while ((match = timestampRegex.exec(this.logText)) !== null) {
      this.parsed.timestamps.push({
        time: match[1],
        event: match[2]
      });
    }
  }

  unescapeText(text) {
    if (!text) return '';
    
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\\//g, '/')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\\/g, '\\');
  }

  formatOutput() {
    let output = '';
    
    output += '='.repeat(80) + '\n';
    output += 'CLAUDE STREAM LOG ANALYSIS\n';
    output += '='.repeat(80) + '\n\n';
    
    output += '📋 METADATA:\n' + '-'.repeat(80) + '\n';
    for (const [key, value] of Object.entries(this.parsed.metadata)) {
      output += `${key}: ${value}\n`;
    }
    output += '\n';
    
    if (Object.keys(this.parsed.usage).length > 0) {
      output += '📊 TOKEN USAGE:\n' + '-'.repeat(80) + '\n';
      for (const [key, value] of Object.entries(this.parsed.usage)) {
        output += `${key}: ${value}\n`;
      }
      output += '\n';
    }
    
    if (this.parsed.thinking.length > 0) {
      output += '🤔 THINKING PROCESS:\n' + '-'.repeat(80) + '\n';
      this.parsed.thinking.forEach((thought, idx) => {
        output += `[Thinking Block ${idx + 1}]\n${thought}\n\n`;
      });
    }
    
    output += '💬 ASSISTANT RESPONSE:\n' + '-'.repeat(80) + '\n';
    output += this.parsed.response + '\n\n';
    
    if (this.parsed.links.length > 0) {
      output += '🔗 LINKS FOUND:\n' + '-'.repeat(80) + '\n';
      this.parsed.links.forEach((link, idx) => {
        output += `[${idx + 1}] ${link.url}\n`;
      });
      output += '\n';
    }
    
    output += '📈 STATISTICS:\n' + '-'.repeat(80) + '\n';
    output += `Response Length: ${this.parsed.response.length} characters\n`;
    output += `Word Count: ${this.parsed.response.split(/\s+/).filter(w => w).length}\n`;
    output += `Stream Fragments: ${this.parsed.fragments.length}\n`;
    output += `Links Found: ${this.parsed.links.length}\n`;
    output += `Events: ${this.parsed.timestamps.length}\n`;
    
    output += '\n' + '='.repeat(80) + '\n';
    
    return output;
  }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

// Example 1: Real-time streaming
function exampleRealTimeStream() {
  console.log('\n🔄 REAL-TIME STREAMING EXAMPLE\n');
  
  const handler = new ClaudeStreamHandler({
    onMetadata: (metadata) => {
      console.log('📋 Metadata received:', metadata);
    },
    onThinking: (thinkingDelta, fullThinking) => {
      console.log('🤔 Thinking delta:', thinkingDelta);
    },
    onTextDelta: (textDelta, fullResponse) => {
      console.log('💬 Text delta:', textDelta);
    },
    onComplete: (finalState) => {
      console.log('\n✅ Stream Complete!');
      console.log('Final response:', finalState.response);
      console.log('Links found:', finalState.links);
      console.log('Usage:', finalState.usage);
    },
    onError: (error) => {
      console.error('❌ Error:', error);
    }
  });

  // Read test file
  try {
    const logContent = fs.readFileSync('logs/tool_stream_79719d0b-f975-4f22-9c3d-c715811d8bc5.log', 'utf-8');
    handler.processChunk(logContent);
  } catch (error) {
    console.error('Error reading file:', error.message);
    
    // Fallback to example data
    const streamChunks = [
      '[2025-10-03T18:20:53.747Z] session_init:\n',
      '{\n',
      '  "session_id": "test-123",\n',
      '  "model": "claude-sonnet-4-5-20250929"\n',
      '}\n',
      '\n',
      '[2025-10-03T18:20:57.434Z] stream_event:\n',
      '{\n',
      '  "type": "content_block_delta",\n',
      '  "delta": {\n',
      '    "type": "text_delta",\n',
      '    "text": "Hello "\n',
      '  }\n',
      '}\n',
      '\n',
      '[2025-10-03T18:20:57.500Z] stream_event:\n',
      '{\n',
      '  "type": "content_block_delta",\n',
      '  "delta": {\n',
      '    "type": "text_delta",\n',
      '    "text": "world!"\n',
      '  }\n',
      '}\n'
    ];
    
    streamChunks.forEach(chunk => handler.processChunk(chunk));
  }
}

// Example 2: Post-processing complete log
function examplePostProcessing(logText) {
  console.log('\n📊 POST-PROCESSING EXAMPLE\n');
  
  const parser = new ClaudeStreamParser(logText);
  const result = parser.parse();
  
  console.log(parser.formatOutput());
  
  return result;
}

// Example 3: Load and process file
function processLogFile(filename) {
  try {
    const logContent = fs.readFileSync(filename, 'utf-8');
    return examplePostProcessing(logContent);
  } catch (error) {
    console.error('Error reading file:', error.message);
    return null;
  }
}

// Run examples
console.log('═'.repeat(80));
console.log('CLAUDE STREAM PARSER DEMO');
console.log('═'.repeat(80));

// Test with real-time handler
exampleRealTimeStream();

// Test with post-processor if file exists
try {
  if (fs.existsSync('logs/tool_stream_79719d0b-f975-4f22-9c3d-c715811d8bc5.log')) {
    console.log('\n\n');
    processLogFile('logs/tool_stream_79719d0b-f975-4f22-9c3d-c715811d8bc5.log');
  }
} catch (e) {
  // File doesn't exist, skip
}

// Export
export {
  ClaudeStreamHandler,
  ClaudeStreamParser,
  exampleRealTimeStream,
  examplePostProcessing,
  processLogFile
};