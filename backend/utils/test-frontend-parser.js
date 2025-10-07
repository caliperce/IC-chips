/**
 * QUICK TEST - Run this to see the parser in action!
 * 
 * Usage:
 *   cd backend/utils
 *   node test-frontend-parser.js
 */

import fs from 'fs';
import { parseCompleteLog, formatResults } from '../../client/utils/frontend-stream-parser.js';

console.log('\n');
console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║  Testing Frontend Stream Parser with Your Log File               ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log('\n');

try {
  // Read your log file
  const logPath = '../../logs/tool_stream_ff503f99-05a8-4202-8b58-0203c9d2d23d.log';
  console.log(`📂 Reading log file: ${logPath}`);
  const logContent = fs.readFileSync(logPath, 'utf-8');
  console.log(`✅ File loaded: ${logContent.length} characters\n`);
  
  // Parse it
  console.log('⚙️  Parsing...\n');
  const results = parseCompleteLog(logContent);
  
  // Display formatted results
  console.log(formatResults(results));
  
  // Show some extra details
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  Detailed Breakdown                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  console.log('🔍 What Claude said:');
  console.log('   ' + (results.assistantText || '(nothing yet)'));
  console.log('\n');
  
  console.log('🔍 Tools Claude called:');
  if (results.toolUses.length > 0) {
    results.toolUses.forEach((tool, idx) => {
      console.log(`   ${idx + 1}. ${tool.name} (${tool.id})`);
    });
  } else {
    console.log('   (no tools called)');
  }
  console.log('\n');
  
  console.log('🔍 Tool commands (parameters):');
  if (results.fullToolCommand) {
    // Try to format as JSON if possible
    try {
      const parsed = JSON.parse(results.fullToolCommand);
      console.log(JSON.stringify(parsed, null, 2).split('\n').map(line => '   ' + line).join('\n'));
    } catch {
      console.log('   ' + results.fullToolCommand);
    }
  } else {
    console.log('   (no commands)');
  }
  console.log('\n');
  
  console.log('✅ Parsing complete!');
  console.log('\n');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('\nMake sure you run this from the backend/utils directory!');
  console.error('Or adjust the logPath variable to match your file location.');
}

