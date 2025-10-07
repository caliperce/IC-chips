// ============================================================================
// SIMPLE AGENT TEST FILE
// ============================================================================
// This file tests if your agent is working correctly.
// It will send a simple prompt to the agent and show you the response.

import { run } from "./backend/utils/agent.js";

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

async function testAgent() {
  console.log("🚀 Starting agent test...\n");
  console.log("=" + "=".repeat(70));
  
  try {
    // This is the prompt (question/instruction) we're sending to the agent
    // Let's use a prompt that will definitely trigger tool usage!
    const myPrompt = "identify the brand if exists and verify the chip markings based on that brands data sheet. I have given both front and back of the chip. @image:images/chip-new.png find out the documentation for the chip and give me the link to the documentation";
    
    console.log("📝 Sending prompt:", myPrompt);
    console.log("=" + "=".repeat(70) + "\n");
    
    // Here, instead of starting a new session, we want to continue an existing session.
    // We'll use the session ID from your sessions.json file.
    // The session ID is: 29af84c1-d9af-4195-bf35-ec987f972e4d
    // To continue a session, we pass the session ID using the 'resumeSid' option.

    const result = await run(myPrompt, {
      showThinking: true,        // Show the agent's thinking process
      showToolCalls: true,       // Show when the agent uses tools
      streamAssistantText: true, // Show the response as it's being generated
    //   resumeSid: "29af84c1-d9af-4195-bf35-ec987f972e4d", // <-- Continue the previous session
      maxTurns: 5,               // Maximum number of back-and-forth exchanges
      enableToolStreamLogging: true,  // ← ADD THIS LINE to enable file logging!
      toolStreamLogDir: "./logs",     // ← OPTIONAL: specify where to save logs
    });
    // const result = await run(myPrompt, {
    //   showThinking: true,        // Show the agent's thinking process
    //   showToolCalls: true,        // Show when the agent uses tools
    //   streamAssistantText: true,  // Show the response as it's being generated
    //   newSession: true,           // Start a fresh conversation
    //   maxTurns: 5,                // Maximum number of back-and-forth exchanges
    // });
    
    // Show the results
    console.log("\n" + "=".repeat(70));
    console.log("✅ Test completed successfully!");
    console.log("=".repeat(70));
    console.log("\n📊 RESULTS:");
    console.log("  • Session ID:", result.sessionId);
    console.log("  • Response length:", result.finalResponse.length, "characters");
    console.log("\n");
    
  } catch (error) {
    // If something goes wrong, show the error
    console.error("\n" + "=".repeat(70));
    console.error("❌ Test failed with error:");
    console.error("=".repeat(70));
    console.error(error);
  }
}

// Run the test!
testAgent();
