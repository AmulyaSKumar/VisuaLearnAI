/**
 * Day 3 Asset Generation Testing
 * Tests for Visual Intelligence Agent and Asset Pipeline
 * Run with: node test_day3_assets.js
 */

import 'dotenv/config';
import { VisualIntelligenceAgent } from './src/agents/visual-intelligence.js';
import { AssetPipeline } from './src/pipeline/asset-pipeline.js';
import { logger } from './src/utils/logger.js';

console.log('\n' + '='.repeat(60));
console.log('DAY 3 ASSETS TEST');
console.log('='.repeat(60) + '\n');

// Create a sample learning plan (from Day 2)
function createSamplePlan() {
  return {
    title: 'Introduction to Data Visualization',
    overview: 'Learn the fundamentals of data visualization',
    estimatedDuration: '2-3 hours',
    steps: [
      {
        number: 1,
        title: 'Charts and Graphs',
        description: 'Understand different types of charts',
        duration: '45 mins',
        resources: [
          {
            type: 'visualization',
            description: 'Interactive bar chart showing data comparison',
          },
          {
            type: 'visualization',
            description: 'Line chart demonstrating trends over time',
          },
        ],
      },
      {
        number: 2,
        title: 'Interactive Visualizations',
        description: 'Create interactive charts with user controls',
        duration: '60 mins',
        resources: [
          {
            type: 'visualization',
            description: 'Interactive slider for real-time data filtering',
          },
        ],
      },
    ],
  };
}

// Test 1: Visual Intelligence Agent
async function testVisualIntelligenceAgent() {
  console.log('🎨 TEST 1: Visual Intelligence Agent');
  console.log('-'.repeat(60));

  try {
    const agent = new VisualIntelligenceAgent();

    console.log(`✓ Agent created: ${agent.name}`);
    console.log(`  Description: ${agent.description}`);
    console.log(`  Version: ${agent.version}\n`);

    const plan = createSamplePlan();

    console.log(`Running widget generation for plan: "${plan.title}"\n`);

    const result = await agent.run(
      {
        plan,
        learningStyle: 'visual',
        topicsOfInterest: ['Data Science', 'Visualization'],
      },
      {
        userId: 'test-user-1',
        userProfile: {
          primaryStyle: 'visual',
        },
      }
    );

    if (result.success) {
      console.log('✅ Visual Intelligence Agent executed successfully\n');
      console.log('Widget Generation Results:');
      console.log(`  Plan: ${result.result.plan.title}`);
      console.log(`  Learning Style: ${result.result.learningStyle}`);
      console.log(`  Widgets Generated: ${result.result.widgets.length}`);
      console.log(`  Execution Time: ${result.executionTime}ms\n`);

      // Show widget details
      result.result.widgets.forEach((widget, idx) => {
        console.log(`Widget ${idx + 1}:`);
        console.log(`  ID: ${widget.id}`);
        console.log(`  Type: ${widget.type}`);
        console.log(`  Title: ${widget.title}`);
        console.log(`  Step: ${widget.step}`);
        console.log(`  Code Length: ${widget.code.length} bytes`);
        console.log(`  Is Fallback: ${widget.isFallback ? 'Yes' : 'No'}`);
        console.log('');
      });

      // Show stats
      const stats = agent.getStats();
      console.log('Agent Stats:');
      console.log(`  Executions: ${stats.executions}`);
      console.log(`  Avg Time: ${stats.avgTime}`);
      console.log(`  Last Run: ${stats.lastRun}\n`);

      return true;
    } else {
      console.log('❌ Visual Intelligence failed:', result.error, '\n');
      return false;
    }
  } catch (error) {
    console.error('❌ Test error:', error.message, '\n');
    return false;
  }
}

// Test 2: Asset Pipeline
async function testAssetPipeline() {
  console.log('\n📦 TEST 2: Asset Pipeline');
  console.log('-'.repeat(60));

  try {
    const pipeline = new AssetPipeline();

    console.log('✓ Asset Pipeline created\n');

    const plan = createSamplePlan();
    let assetCount = 0;
    let errorCount = 0;

    console.log(`Running asset pipeline for: "${plan.title}"\n`);

    const result = await pipeline.generateAssets(
      {
        plan,
        learningStyle: 'visual',
        userId: 'test-user-1',
      },
      {},
      {
        onAsset: (assetData) => {
          assetCount++;
          console.log(`  ✓ Asset generated: ${assetData.asset.id}`);
          console.log(`    Type: ${assetData.asset.type}`);
          console.log(`    Progress: ${assetData.progress}`);
        },
        onError: (errorData) => {
          errorCount++;
          console.log(`  ❌ Error: ${errorData.error}`);
        },
        onComplete: (stats) => {
          console.log(`\n✅ Pipeline complete!`);
          console.log(`  Total Assets: ${stats.totalAssets}`);
          console.log(`  Duration: ${stats.duration}ms\n`);
        },
      }
    );

    console.log('Pipeline Results:');
    console.log(`  Total Assets: ${result.totalAssets}`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Success: ${result.success}\n`);

    return result.totalAssets > 0;
  } catch (error) {
    console.error('❌ Test error:', error.message, '\n');
    return false;
  }
}

// Test 3: Widget type determination
async function testWidgetTypeDetermination() {
  console.log('\n🔍 TEST 3: Widget Type Determination');
  console.log('-'.repeat(60));

  try {
    const agent = new VisualIntelligenceAgent();

    const testCases = [
      {
        description: 'Interactive bar chart showing data comparison',
        expected: 'bar-chart',
      },
      {
        description: 'Line chart demonstrating trends over time',
        expected: 'line-chart',
      },
      {
        description: 'Pie chart of market share distribution',
        expected: 'pie-chart',
      },
      {
        description: 'Interactive slider for real-time data filtering',
        expected: 'interactive-slider',
      },
      {
        description: '3D visualization of molecular structure',
        expected: '3d-visualization',
      },
      {
        description: 'Network diagram showing relationships',
        expected: 'network-diagram',
      },
      {
        description: 'Physics simulation of gravity and motion',
        expected: 'physics-simulation',
      },
    ];

    console.log('Testing widget type determination:\n');

    let passed = 0;
    testCases.forEach(({ description, expected }) => {
      const result = agent._determineVisualizationType(description, 'test', 'visual');
      const status = result === expected ? '✓' : '✗';
      console.log(`${status} "${description}"`);
      console.log(`  Got: ${result}, Expected: ${expected}`);
      if (result === expected) passed++;
    });

    console.log(`\n✓ Passed: ${passed}/${testCases.length}\n`);
    return passed === testCases.length;
  } catch (error) {
    console.error('❌ Test error:', error.message, '\n');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const results = [];

  try {
    results.push(await testVisualIntelligenceAgent());
  } catch (error) {
    console.error('Visual Intelligence test crashed:', error.message);
    results.push(false);
  }

  try {
    results.push(await testAssetPipeline());
  } catch (error) {
    console.error('Asset Pipeline test crashed:', error.message);
    results.push(false);
  }

  try {
    results.push(await testWidgetTypeDetermination());
  } catch (error) {
    console.error('Widget type test crashed:', error.message);
    results.push(false);
  }

  // Summary
  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}\n`);

  if (passed === total) {
    console.log('✅ All Day 3 tests passed!');
    console.log('\nNext steps:');
    console.log('1. Test API endpoints: POST /api/generate-assets');
    console.log('2. Connect to frontend for SSE streaming');
    console.log('3. Integrate widget rendering in WidgetFrame');
    console.log('4. Start Day 4 implementation (Image Generation)\n');
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
