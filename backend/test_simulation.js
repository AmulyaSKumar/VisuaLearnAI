/**
 * Simulation API Test Script
 * Tests the /api/simulation endpoint flow
 *
 * Flow:
 * 1. User searches topic (e.g., "bubble sort")
 * 2. Learning content loads in Learn tab (separate API)
 * 3. User clicks Simulation tab → triggers /api/simulation
 * 4. Simulation is generated ON-DEMAND (not with learning content)
 *
 * Run: node test_simulation.js
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function testSimulationAPI() {
  console.log('\n' + '='.repeat(60));
  log(colors.cyan, '🧪 SIMULATION API TEST SCRIPT');
  console.log('='.repeat(60) + '\n');

  const tests = [
    {
      name: 'Array Sort - Bubble Sort',
      payload: {
        topic: 'bubble sort',
        simulationType: 'array_sort',
        difficulty: 'beginner'
      }
    },
    {
      name: 'Graph Traversal - BFS',
      payload: {
        topic: 'breadth first search',
        simulationType: 'graph_traversal',
        difficulty: 'beginner'
      }
    },
    {
      name: 'Tree Traversal - Inorder',
      payload: {
        topic: 'binary tree inorder traversal',
        simulationType: 'tree_traversal',
        difficulty: 'beginner'
      }
    },
    {
      name: 'Cache Test - Same Query',
      payload: {
        topic: 'bubble sort',
        simulationType: 'array_sort',
        difficulty: 'beginner'
      },
      expectCache: true
    },
    {
      name: 'Invalid Type Test',
      payload: {
        topic: 'test',
        simulationType: 'invalid_type',
        difficulty: 'beginner'
      },
      expectError: true
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log('-'.repeat(50));
    log(colors.blue, `📋 Test: ${test.name}`);
    console.log(`   Payload: ${JSON.stringify(test.payload)}`);

    try {
      const startTime = Date.now();

      const response = await fetch(`${API_BASE}/api/simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload)
      });

      const elapsed = Date.now() - startTime;
      const data = await response.json();

      // Check for expected error
      if (test.expectError) {
        if (response.status === 400 || data.error) {
          log(colors.green, `   ✅ PASS - Got expected error: ${data.error}`);
          passed++;
        } else {
          log(colors.red, `   ❌ FAIL - Expected error but got success`);
          failed++;
        }
        continue;
      }

      // Validate response structure
      const validationResults = validateResponse(data, test.payload.simulationType, test.expectCache);

      if (validationResults.valid) {
        log(colors.green, `   ✅ PASS (${elapsed}ms)`);
        console.log(`   Source: ${data.source}`);
        console.log(`   Steps: ${data.simulation?.steps?.length || 0}`);
        console.log(`   Type: ${data.simulation?.type}`);

        // Show first step preview
        if (data.simulation?.steps?.[0]) {
          const step = data.simulation.steps[0];
          console.log(`   Step 1: "${step.description}"`);
        }
        passed++;
      } else {
        log(colors.red, `   ❌ FAIL - ${validationResults.reason}`);
        console.log(`   Response:`, JSON.stringify(data, null, 2).slice(0, 500));
        failed++;
      }

    } catch (error) {
      log(colors.red, `   ❌ FAIL - Network error: ${error.message}`);
      failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  log(colors.cyan, '📊 TEST SUMMARY');
  console.log('='.repeat(60));
  log(colors.green, `   Passed: ${passed}`);
  log(colors.red, `   Failed: ${failed}`);
  console.log(`   Total:  ${tests.length}`);
  console.log('='.repeat(60) + '\n');

  // Flow explanation
  console.log('-'.repeat(60));
  log(colors.yellow, '📝 SIMULATION FLOW EXPLANATION:');
  console.log('-'.repeat(60));
  console.log(`
  1. User enters topic (e.g., "bubble sort")
     ↓
  2. /api/learning-content generates Learn tab content
     (key_ideas, examples, quiz, flashcards)
     ↓
  3. User clicks "Simulation" tab
     ↓
  4. Frontend calls /api/simulation with:
     - topic: "bubble sort"
     - simulationType: "array_sort" (auto-detected)
     - difficulty: "beginner"
     ↓
  5. Backend checks cache
     ↓
  6. CACHE HIT → Return cached simulation (source: "cache")
     CACHE MISS → Generate via Claude API (source: "generated")
     ↓
  7. Frontend renders step-by-step animation

  ⚡ KEY POINT: Simulation is generated ON-DEMAND when tab is clicked,
     NOT bundled with learning content. This keeps initial load fast.
  `);

  return failed === 0;
}

function validateResponse(data, expectedType, expectCache) {
  // Check success flag
  if (!data.success && !data.fallback) {
    return { valid: false, reason: `success=false: ${data.error}` };
  }

  const sim = data.simulation || data.fallback;

  // Check simulation exists
  if (!sim) {
    return { valid: false, reason: 'No simulation in response' };
  }

  // Check type matches
  if (sim.type !== expectedType) {
    return { valid: false, reason: `Type mismatch: expected ${expectedType}, got ${sim.type}` };
  }

  // Check steps array
  if (!Array.isArray(sim.steps) || sim.steps.length === 0) {
    return { valid: false, reason: 'No steps in simulation' };
  }

  // Check source field
  if (!data.source) {
    return { valid: false, reason: 'Missing source field' };
  }

  // If expecting cache, verify
  if (expectCache && data.source !== 'cache') {
    return { valid: false, reason: `Expected cache hit, got source: ${data.source}` };
  }

  // Type-specific validation
  switch (expectedType) {
    case 'array_sort':
      if (!sim.initialArray || !Array.isArray(sim.initialArray)) {
        return { valid: false, reason: 'Missing initialArray for array_sort' };
      }
      const arrayStep = sim.steps[0];
      if (!Array.isArray(arrayStep.array) || !Array.isArray(arrayStep.highlight)) {
        return { valid: false, reason: 'Invalid array_sort step structure' };
      }
      break;

    case 'graph_traversal':
      if (!Array.isArray(sim.nodes) || !Array.isArray(sim.edges)) {
        return { valid: false, reason: 'Missing nodes/edges for graph_traversal' };
      }
      const graphStep = sim.steps[0];
      if (!Array.isArray(graphStep.visited) || !graphStep.current) {
        return { valid: false, reason: 'Invalid graph_traversal step structure' };
      }
      break;

    case 'tree_traversal':
      if (!Array.isArray(sim.nodes)) {
        return { valid: false, reason: 'Missing nodes for tree_traversal' };
      }
      const treeStep = sim.steps[0];
      if (!treeStep.current || !Array.isArray(treeStep.traversalOrder)) {
        return { valid: false, reason: 'Invalid tree_traversal step structure' };
      }
      break;
  }

  return { valid: true };
}

// Run tests
testSimulationAPI()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test script error:', err);
    process.exit(1);
  });
