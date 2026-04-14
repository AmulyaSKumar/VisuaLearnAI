/**
 * Day 2 Agent Testing
 * Tests for Planner and Personalization agents
 * Run with: node test_day2_agents.js
 */

import 'dotenv/config';
import { PlannerAgent, PersonalizationAgent } from './src/agents/index.js';
import { logger } from './src/utils/logger.js';

console.log('\n' + '='.repeat(60));
console.log('DAY 2 AGENTS TEST');
console.log('='.repeat(60) + '\n');

// Test 1: Planner Agent
async function testPlannerAgent() {
  console.log('📋 TEST 1: Planner Agent');
  console.log('-'.repeat(60));

  try {
    const planner = new PlannerAgent();

    console.log(`✓ Agent created: ${planner.name}`);
    console.log(`  Description: ${planner.description}`);
    console.log(`  Version: ${planner.version}\n`);

    // Test goal
    const testGoal = 'Learn the basics of Python programming';

    console.log(`Running planner with goal: "${testGoal}"\n`);

    const result = await planner.run(
      {
        goal: testGoal,
        context: 'I am a complete beginner with no programming experience',
        targetLevel: 'beginner',
      },
      {
        userId: 'test-user-1',
        userProfile: {
          primaryStyle: 'visual',
          comprehension: { currentLevel: 'beginner' },
        },
      }
    );

    if (result.success) {
      console.log('✅ Planner executed successfully\n');
      console.log('Plan Details:');
      console.log(`  Title: ${result.result.plan.title}`);
      console.log(`  Duration: ${result.result.plan.estimatedDuration}`);
      console.log(`  Steps: ${result.result.plan.steps.length}`);
      console.log(`  Execution Time: ${result.executionTime}ms\n`);

      // Show first step
      if (result.result.plan.steps.length > 0) {
        const step = result.result.plan.steps[0];
        console.log('First Step:');
        console.log(`  ${step.number}. ${step.title}`);
        console.log(`     Description: ${step.description}`);
        console.log(`     Duration: ${step.duration}\n`);
      }

      // Show stats
      const stats = planner.getStats();
      console.log('Agent Stats:');
      console.log(`  Executions: ${stats.executions}`);
      console.log(`  Avg Time: ${stats.avgTime}`);
      console.log(`  Last Run: ${stats.lastRun}\n`);
    } else {
      console.log('❌ Planner failed:', result.error, '\n');
    }

    return result.success;
  } catch (error) {
    console.error('❌ Test error:', error.message, '\n');
    return false;
  }
}

// Test 2: Personalization Agent
async function testPersonalizationAgent() {
  console.log('\n📊 TEST 2: Personalization Agent');
  console.log('-'.repeat(60));

  try {
    const personalizer = new PersonalizationAgent();

    console.log(`✓ Agent created: ${personalizer.name}`);
    console.log(`  Description: ${personalizer.description}`);
    console.log(`  Version: ${personalizer.version}\n`);

    // Simulate user interactions
    const interactions = [
      { type: 'widget', timestamp: new Date().toISOString() },
      { type: 'visualization', timestamp: new Date().toISOString() },
      { type: 'text', timestamp: new Date().toISOString() },
      { type: 'interactive', timestamp: new Date().toISOString() },
      { type: 'widget', timestamp: new Date().toISOString() },
      { type: 'visualization', timestamp: new Date().toISOString() },
    ];

    console.log(`Running personalization analysis with ${interactions.length} interactions\n`);

    const result = await personalizer.run(
      {
        userId: 'test-user-1',
        interactions,
        topicsOfInterest: ['Python', 'Data Science', 'Visualization'],
        strugglingTopics: ['Advanced Mathematics'],
      },
      {
        userProfile: {
          primaryStyle: 'visual',
          comprehension: { currentLevel: 'intermediate' },
        },
      }
    );

    if (result.success) {
      console.log('✅ Personalization executed successfully\n');
      console.log('Learning Profile:');
      const profile = result.result.profile;
      console.log(`  Primary Style: ${profile.primaryStyle}`);
      console.log(`  Comprehension: ${profile.comprehension.currentLevel}`);
      console.log(`  Topics: ${profile.engagement.topicsOfInterest.join(', ')}`);
      console.log(`  Execution Time: ${result.executionTime}ms\n`);

      console.log('Style Distribution:');
      const scores = result.result.analysisDetails.styleScores;
      Object.entries(scores).forEach(([style, score]) => {
        const bar = '█'.repeat(Math.round(score * 20));
        console.log(`  ${style.padEnd(10)}: ${bar} ${(score * 100).toFixed(0)}%`);
      });

      console.log('\nRecommendations:');
      const rec = result.result.recommendations;
      console.log(`  Content Type: ${rec.contentType}`);
      console.log(`  Pace: ${rec.pace}`);
      console.log(`  Include Examples: ${rec.examples}`);
      console.log(`  Generate Visualizations: ${rec.visualizations}\n`);

      // Show stats
      const stats = personalizer.getStats();
      console.log('Agent Stats:');
      console.log(`  Executions: ${stats.executions}`);
      console.log(`  Avg Time: ${stats.avgTime}`);
      console.log(`  Last Run: ${stats.lastRun}\n`);
    } else {
      console.log('❌ Personalization failed:', result.error, '\n');
    }

    return result.success;
  } catch (error) {
    console.error('❌ Test error:', error.message, '\n');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const results = [];

  try {
    results.push(await testPlannerAgent());
  } catch (error) {
    console.error('Planner test crashed:', error.message);
    results.push(false);
  }

  try {
    results.push(await testPersonalizationAgent());
  } catch (error) {
    console.error('Personalization test crashed:', error.message);
    results.push(false);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}\n`);

  if (passed === total) {
    console.log('✅ All Day 2 agent tests passed!');
    console.log('\nNext steps:');
    console.log('1. Test API endpoints: POST /api/plan, POST /api/user/:id/detect-style');
    console.log('2. Connect to frontend');
    console.log('3. Integrate with memory system');
    console.log('4. Start Day 3 implementation (Visual Intelligence Agent)\n');
  } else {
    console.log('❌ Some tests failed. Check errors above.\n');
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
