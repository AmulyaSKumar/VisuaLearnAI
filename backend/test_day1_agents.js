/**
 * Test Day 1: Agent Registry & BaseAgent
 * Verifies agent infrastructure works correctly
 * Run: node backend/test_day1_agents.js
 */

import { BaseAgent } from "./agents/base-agent.js";
import { agentRegistry } from "./agents/index.js";

// Create mock agents for testing
class MockPlannerAgent extends BaseAgent {
  async execute(input) {
    // Simulate planning logic
    return {
      plan: "Sample learning plan",
      steps: ["Step 1", "Step 2", "Step 3"],
    };
  }
}

class MockImageAgent extends BaseAgent {
  async execute(input) {
    // Simulate image generation
    return {
      imageUrl: "https://example.com/image.png",
      prompt: input.prompt,
    };
  }
}

async function testAgentInfrastructure() {
  console.log("\n=== Agent Infrastructure Test ===\n");

  try {
    // Test 1: BaseAgent instantiation
    console.log("Test 1: Creating BaseAgent instances...");
    const planner = new MockPlannerAgent(
      "planner",
      "Generates learning plans",
      "1.0.0"
    );
    const imageGen = new MockImageAgent(
      "image-generator",
      "Generates educational images",
      "1.0.0"
    );
    console.log("✓ Agents created\n");

    // Test 2: Get metadata
    console.log("Test 2: Checking agent metadata...");
    const plannerMeta = planner.getMetadata();
    console.log(`✓ Planner metadata:`);
    console.log(`  - Name: ${plannerMeta.name}`);
    console.log(`  - Description: ${plannerMeta.description}`);
    console.log(`  - Version: ${plannerMeta.version}\n`);

    // Test 3: Register agents
    console.log("Test 3: Registering agents in registry...");
    agentRegistry.registerAgent(planner);
    agentRegistry.registerAgent(imageGen);
    console.log(`✓ ${agentRegistry.agents.size} agents registered\n`);

    // Test 4: List agents
    console.log("Test 4: Listing registered agents...");
    const agentList = agentRegistry.listAgents();
    agentList.forEach((agent) => {
      console.log(`  ✓ ${agent.name} v${agent.version}`);
    });
    console.log();

    // Test 5: Get agent by name
    console.log("Test 5: Retrieving agent by name...");
    const retrievedPlanner = agentRegistry.getAgent("planner");
    console.log(`✓ Retrieved planner agent`);
    console.log(`  - Execution count: ${retrievedPlanner.executionCount}\n`);

    // Test 6: Run agent
    console.log("Test 6: Running planner agent...");
    const result = await agentRegistry.runAgent(
      "planner",
      { topic: "Calculus" },
      {}
    );
    console.log(`✓ Agent execution completed`);
    console.log(`  - Success: ${result.success}`);
    console.log(`  - Execution time: ${result.executionTime}ms`);
    console.log(`  - Result: ${JSON.stringify(result.result)}\n`);

    // Test 7: Run agent with error
    console.log("Test 7: Testing error handling...");
    const errorAgent = new BaseAgent("error-test", "Test error handling");
    agentRegistry.registerAgent(errorAgent);
    const errorResult = await agentRegistry.runAgent("error-test", {}, {});
    console.log(`✓ Error handled gracefully`);
    console.log(`  - Success: ${errorResult.success}`);
    console.log(`  - Error: ${errorResult.error.substring(0, 50)}...\n`);

    // Test 8: Run agents sequentially
    console.log("Test 8: Running agents sequentially...");
    agentRegistry.clear();
    agentRegistry.registerAgent(planner);
    agentRegistry.registerAgent(imageGen);

    const seqResult = await agentRegistry.runSequential(
      ["planner", "image-generator"],
      { topic: "Biology" },
      {}
    );
    console.log(`✓ Sequential execution completed`);
    console.log(`  - Total agents: ${seqResult.agents.length}`);
    console.log(`  - All successful: ${seqResult.success}\n`);

    // Test 9: Get agent stats
    console.log("Test 9: Checking agent execution stats...");
    const stats = agentRegistry.getStats();
    Object.entries(stats).forEach(([name, stat]) => {
      console.log(`  ${name}:`);
      console.log(
        `    - Executions: ${stat.executions}, Avg time: ${stat.avgTime}`
      );
    });

    // Test 10: Registry summary
    console.log("\nTest 10: Registry summary...");
    const summary = agentRegistry.summary();
    console.log(`✓ Total agents: ${summary.totalAgents}`);
    console.log(`✓ Agent list:`);
    summary.agents.forEach((agent) => {
      console.log(`  - ${agent.name}`);
    });

    console.log("\n=== Agent Infrastructure Test Complete ===\n");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAgentInfrastructure();
