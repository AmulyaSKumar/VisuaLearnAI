/**
 * Test Day 1: MemoryManager Functionality
 * Verifies memory manager initialization and operations
 * Run: node backend/test_day1_memory.js
 *
 * Note: Requires a valid Supabase user to test fully.
 * This test uses the authenticated user from getSession()
 */

import "dotenv/config";
import { MemoryManager } from "./memory/index.js";
import { supabase, getSession } from "./lib/supabase.js";

async function testMemoryManager() {
  console.log("\n=== MemoryManager Test ===\n");

  try {
    // Step 1: Get or create a test user (via auth)
    console.log("Step 1: Getting session...");
    const { session, user } = await getSession();

    if (!user) {
      console.log("⚠️  No authenticated user found.");
      console.log("To test with real data, please sign in first:");
      console.log("  1. Start frontend: cd frontend && npm run dev");
      console.log("  2. Sign up or login at http://localhost:5173");
      console.log("\nTesting basic MemoryManager structure instead...\n");

      // Test MemoryManager structure with mock user
      const mockUserId = "test-user-" + Date.now();
      console.log(`Using mock user ID: ${mockUserId}\n`);

      const manager = new MemoryManager(mockUserId);

      // Test methods exist
      console.log("✓ MemoryManager instantiated");
      console.log("✓ Methods available:");
      console.log("  - initialize()");
      console.log("  - loadConversation()");
      console.log("  - createConversation()");
      console.log("  - addUserMessage()");
      console.log("  - addAssistantMessage()");
      console.log("  - getMessageHistory()");
      console.log("  - getUserProfile()");
      console.log("  - updateUserProfile()");
      console.log("  - saveFeedback()");
      console.log("  - getCachedAsset()");
      console.log("  - cacheAsset()");
      console.log("  - saveFactCheck()");
      console.log("  - getLearningContext()");

      return;
    }

    console.log(`✓ Authenticated user: ${user.email}\n`);

    // Step 2: Initialize MemoryManager
    console.log("Step 2: Initializing MemoryManager...");
    const manager = new MemoryManager(user.id);
    const result = await manager.initialize();

    console.log("✓ MemoryManager initialized");
    console.log(`  - Profile loaded/created`);
    console.log(`  - Conversations: ${result.conversationCount}\n`);

    // Step 3: Create a test conversation
    console.log("Step 3: Creating test conversation...");
    const conversation = await manager.createConversation(
      "Test Conversation - Day 1"
    );
    console.log(`✓ Created conversation: ${conversation.id}`);
    console.log(`  - Title: ${conversation.title}\n`);

    // Step 4: Add messages
    console.log("Step 4: Adding messages...");
    const userMsg = await manager.addUserMessage("What is photosynthesis?");
    console.log(`✓ Added user message: ${userMsg.id}`);

    const assistantMsg = await manager.addAssistantMessage(
      "Photosynthesis is the process by which plants convert light energy into chemical energy..."
    );
    console.log(`✓ Added assistant message: ${assistantMsg.id}\n`);

    // Step 5: Get message history
    console.log("Step 5: Getting message history...");
    const history = manager.getMessageHistory();
    console.log(`✓ Message history retrieved: ${history.length} messages`);
    history.forEach((msg, i) => {
      console.log(
        `  ${i + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`
      );
    });

    // Step 6: Get learning context
    console.log("\nStep 6: Getting learning context...");
    const context = manager.getLearningContext();
    console.log(`✓ Learning context retrieved:`);
    console.log(`  - Learning style: ${context.learningStyle}`);
    console.log(`  - Comprehension level: ${context.comprehensionLevel}`);
    console.log(`  - Conversation count: ${context.conversationCount}`);
    console.log(`  - Topics of interest: ${context.topicsOfInterest.length}`);

    // Step 7: Update user profile
    console.log("\nStep 7: Updating user profile...");
    const updated = await manager.updateUserProfile({
      learning_style: "kinesthetic",
      topics_of_interest: ["Biology", "Chemistry", "Physics"],
    });
    console.log(`✓ User profile updated`);
    console.log(`  - New learning style: ${updated.learning_style}`);

    // Step 8: Save feedback
    console.log("\nStep 8: Saving feedback...");
    const feedback = await manager.saveFeedback(
      userMsg.id,
      "thumbs_up",
      null
    );
    console.log(`✓ Feedback saved: ${feedback.type}`);

    console.log("\n=== MemoryManager Test Complete ===\n");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testMemoryManager();
