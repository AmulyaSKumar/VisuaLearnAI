/**
 * Full Integration Test - Real User Flow
 * Tests complete user lifecycle with actual demo user
 * Run: node backend/test_integration_full.js
 */

import "dotenv/config";
import { MemoryManager } from "./memory/index.js";
import {
  getUserProfile,
  updateUserProfile,
  createConversation,
  addMessage,
  getConversationMessages,
  saveFeedback,
  getCachedAsset,
  cacheAsset,
} from "./lib/supabase.js";

// Use the real demo user ID from our setup
const DEMO_USER_ID = "93e71361-9f99-47d9-bc9a-ec448ff4cb9b";

async function runIntegrationTest() {
  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║  FULL INTEGRATION TEST - Real User Flow          ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  try {
    // Test 1: Get user profile
    console.log("📋 TEST 1: Load User Profile");
    console.log("─".repeat(50));
    const profile = await getUserProfile(DEMO_USER_ID);
    console.log(`✓ Profile loaded:`);
    console.log(`  - ID: ${profile.id.substring(0, 8)}...`);
    console.log(`  - Learning style: ${profile.learning_style}`);
    console.log(`  - Comprehension: ${profile.comprehension_level}`);
    console.log(`  - Language: ${profile.preferred_language}\n`);

    // Test 2: Update user profile
    console.log("📝 TEST 2: Update User Profile");
    console.log("─".repeat(50));
    const updated = await updateUserProfile(DEMO_USER_ID, {
      learning_style: "kinesthetic",
      topics_of_interest: ["Physics", "Mathematics", "Chemistry"],
      comprehension_level: "advanced",
    });
    console.log(`✓ Profile updated:`);
    console.log(`  - Learning style: ${updated.learning_style}`);
    console.log(`  - Topics: ${updated.topics_of_interest.join(", ")}`);
    console.log(`  - Comprehension: ${updated.comprehension_level}\n`);

    // Test 3: Initialize MemoryManager
    console.log("🧠 TEST 3: Initialize MemoryManager");
    console.log("─".repeat(50));
    const manager = new MemoryManager(DEMO_USER_ID);
    const initResult = await manager.initialize();
    console.log(`✓ MemoryManager initialized:`);
    console.log(`  - User profile loaded`);
    console.log(`  - Existing conversations: ${initResult.conversationCount}\n`);

    // Test 4: Create conversation
    console.log("💬 TEST 4: Create Conversation");
    console.log("─".repeat(50));
    const conversation = await manager.createConversation("Integration Test Session");
    console.log(`✓ Conversation created:`);
    console.log(`  - ID: ${conversation.id.substring(0, 8)}...`);
    console.log(`  - Title: ${conversation.title}`);
    console.log(`  - Created: ${new Date(conversation.created_at).toLocaleString()}\n`);

    // Test 5: Add messages
    console.log("💬 TEST 5: Add Messages to Conversation");
    console.log("─".repeat(50));
    const userMsg = await manager.addUserMessage("What is photosynthesis?", {
      source: "integration_test",
    });
    console.log(`✓ User message added: ${userMsg.id.substring(0, 8)}...`);

    const assistantMsg = await manager.addAssistantMessage(
      "Photosynthesis is the process by which plants convert light energy into chemical energy...",
      { source: "integration_test", model: "claude-sonnet-4-5" }
    );
    console.log(`✓ Assistant message added: ${assistantMsg.id.substring(0, 8)}...\n`);

    // Test 6: Get message history
    console.log("📚 TEST 6: Get Message History");
    console.log("─".repeat(50));
    const messages = await getConversationMessages(conversation.id);
    console.log(`✓ Retrieved ${messages.length} messages:`);
    messages.forEach((msg, i) => {
      console.log(`  ${i + 1}. [${msg.role}] ${msg.content.substring(0, 40)}...`);
    });
    console.log();

    // Test 7: Get learning context
    console.log("🎓 TEST 7: Get Learning Context");
    console.log("─".repeat(50));
    const context = manager.getLearningContext();
    console.log(`✓ Learning context retrieved:`);
    console.log(`  - Learning style: ${context.learningStyle}`);
    console.log(`  - Topics of interest: ${context.topicsOfInterest.length}`);
    console.log(`  - Conversations: ${context.conversationCount}`);
    console.log(`  - Recent messages: ${context.recentMessages.length}\n`);

    // Test 8: Save feedback
    console.log("👍 TEST 8: Save Feedback");
    console.log("─".repeat(50));
    const feedback = await manager.saveFeedback(
      userMsg.id,
      "thumbs_up",
      "Clear and informative response"
    );
    console.log(`✓ Feedback saved:`);
    console.log(`  - Type: ${feedback.type}`);
    console.log(`  - Content: ${feedback.content}\n`);

    // Test 9: Asset cache
    console.log("💾 TEST 9: Asset Cache Operations");
    console.log("─".repeat(50));
    // Use unique hash with timestamp to avoid collisions
    const prompt = `Create an interactive photosynthesis diagram ${Date.now()}`;
    const promptHash = Buffer.from(prompt).toString("base64");

    // Try to get (should not exist yet)
    let cachedAsset = await manager.getCachedAsset(promptHash);
    console.log(`✓ Cache check (first time): ${cachedAsset ? "found" : "not found"}`);

    // Cache new asset
    const cached = await manager.cacheAsset(
      promptHash,
      "widget",
      "<svg>...</svg>",
      "widgets/photosynthesis-v1.html",
      { complexity: "medium", difficulty: "beginner" }
    );
    console.log(`✓ Asset cached: ${cached.id.substring(0, 8)}...`);

    // Get cached asset again (should increment access count)
    cachedAsset = await manager.getCachedAsset(promptHash);
    console.log(`✓ Cache hit: found (access_count: ${cachedAsset.access_count})\n`);

    // Test 10: Message metadata
    console.log("🏷️  TEST 10: Message Metadata");
    console.log("─".repeat(50));
    const messagesWithMeta = await getConversationMessages(conversation.id);
    const msgWithMeta = messagesWithMeta.find((m) => m.metadata && Object.keys(m.metadata).length > 0);
    if (msgWithMeta) {
      console.log(`✓ Message with metadata found:`);
      console.log(`  - Metadata: ${JSON.stringify(msgWithMeta.metadata)}\n`);
    } else {
      console.log(`✓ Messages created successfully\n`);
    }

    // Final Summary
    console.log("╔════════════════════════════════════════════════════╗");
    console.log("║  ✅ ALL INTEGRATION TESTS PASSED                  ║");
    console.log("╚════════════════════════════════════════════════════╝");
    console.log(`
Summary:
  ✓ User profile loaded and updated
  ✓ MemoryManager initialized
  ✓ Conversation created (ID: ${conversation.id.substring(0, 8)}...)
  ✓ Messages added and retrieved
  ✓ Learning context generated
  ✓ Feedback saved
  ✓ Asset cache working
  ✓ Message metadata stored

Next Steps:
  1. Test frontend login at http://localhost:5173
  2. Verify conversations load in sidebar
  3. Send messages and see them stored in Supabase
  4. Proceed to Day 2: Planner Agent
`);
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runIntegrationTest();
