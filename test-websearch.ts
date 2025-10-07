// ============================================================================
// WEB SEARCH TEST - Tests if WebSearch tool calls are properly logged
// ============================================================================

import { run } from "./backend/utils/agent.js";

async function testWebSearch() {
  console.log("🔍 Starting WebSearch logging test...\n");
  console.log("=" + "=".repeat(70));
  
  try {
    // This prompt REQUIRES a web search because it asks for current information
    const myPrompt = "What are the recent features released by this company?";
    
    console.log("📝 Sending prompt:", myPrompt);
    console.log("=" + "=".repeat(70) + "\n");
    
    const result = await run(myPrompt, {
      showThinking: true,
      showToolCalls: true,
      streamAssistantText: true,
      newSession: true,  // Start fresh
      maxTurns: 5,
      resumeSid: "0725eba7-f9f5-4df8-b677-7ffa6a9137ea",
      enableToolStreamLogging: true,  // Enable file logging
      toolStreamLogDir: "./logs",
      allowedTools: ["WebSearch", "TodoWrite"],  // Only allow WebSearch
    });
    
    console.log("\n" + "=".repeat(70));
    console.log("✅ Test completed!");
    console.log("=".repeat(70));
    console.log("\n📊 RESULTS:");
    console.log("  • Session ID:", result.sessionId);
    console.log("  • Log file: ./logs/tool_stream_" + result.sessionId + ".log");
    console.log("  • Response length:", result.finalResponse.length, "characters");
    console.log("\n💡 Now check the log file to see if WebSearch tool_use and tool_result are captured!");
    console.log("\n");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  }
}

// Run the test!
testWebSearch();




