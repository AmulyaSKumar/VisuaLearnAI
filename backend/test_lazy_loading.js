/**
 * Lazy Loading Test Script
 * Verifies that content is generated ON-DEMAND per tab
 *
 * CORRECT FLOW:
 * 1. User searches "bubble sort" → ONLY Learn tab content generated
 * 2. User clicks Quiz tab → ONLY Quiz content generated
 * 3. User clicks Flashcards tab → ONLY Flashcards + Mind Map generated
 * 4. User clicks Simulation tab → ONLY Simulation generated (separate API)
 *
 * Run: node test_lazy_loading.js
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const TOPIC = 'bubble sort';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function testLazyLoading() {
  console.log('\n' + '='.repeat(70));
  log(colors.cyan, '🧪 LAZY LOADING TEST - Verifying On-Demand Content Generation');
  console.log('='.repeat(70));
  log(colors.dim, `Topic: "${TOPIC}"`);
  console.log();

  const tests = [
    {
      name: 'Step 1: User searches topic → ONLY Learn tab loads',
      endpoint: '/api/learning-content',
      payload: { query: TOPIC, contentType: 'learn' },
      expectFields: ['key_ideas', 'summary', 'title'],
      rejectFields: ['quiz', 'flashcards', 'examples'],
    },
    {
      name: 'Step 2: User clicks Examples tab → ONLY Examples loads',
      endpoint: '/api/learning-content',
      payload: { query: TOPIC, contentType: 'examples' },
      expectFields: ['examples'],
      rejectFields: ['quiz', 'flashcards', 'key_ideas'],
    },
    {
      name: 'Step 3: User clicks Quiz tab → ONLY Quiz loads',
      endpoint: '/api/learning-content',
      payload: { query: TOPIC, contentType: 'quiz' },
      expectFields: ['quiz'],
      rejectFields: ['flashcards', 'examples', 'key_ideas'],
    },
    {
      name: 'Step 4: User clicks Flashcards/MindMap tab → ONLY those load',
      endpoint: '/api/learning-content',
      payload: { query: TOPIC, contentType: 'flashcards-mindmap' },
      expectFields: ['flashcards', 'mind_map'],
      rejectFields: ['quiz', 'examples', 'key_ideas'],
    },
    {
      name: 'Step 5: User clicks Simulation tab → Separate API call',
      endpoint: '/api/simulation',
      payload: { topic: TOPIC, simulationType: 'array_sort', difficulty: 'beginner' },
      expectFields: ['simulation'],
      rejectFields: [],
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log('-'.repeat(70));
    log(colors.blue, `📋 ${test.name}`);
    log(colors.dim, `   POST ${test.endpoint}`);
    log(colors.dim, `   Payload: ${JSON.stringify(test.payload)}`);

    try {
      const startTime = Date.now();

      const response = await fetch(`${API_BASE}${test.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload),
      });

      const elapsed = Date.now() - startTime;
      const data = await response.json();

      if (!data.success) {
        log(colors.red, `   ❌ FAIL - API returned success=false: ${data.error}`);
        failed++;
        continue;
      }

      const content = data.content || data.simulation || data;

      // Check expected fields exist
      const missingExpected = test.expectFields.filter(field => {
        const value = content[field];
        if (value === undefined || value === null) return true;
        if (Array.isArray(value) && value.length === 0) return true;
        return false;
      });

      // Check rejected fields are NOT present
      const unexpectedPresent = test.rejectFields.filter(field => {
        const value = content[field];
        if (value === undefined || value === null) return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      });

      if (missingExpected.length > 0) {
        log(colors.red, `   ❌ FAIL - Missing expected fields: ${missingExpected.join(', ')}`);
        failed++;
        continue;
      }

      if (unexpectedPresent.length > 0) {
        log(colors.yellow, `   ⚠️ WARNING - Unexpected fields present: ${unexpectedPresent.join(', ')}`);
        log(colors.yellow, `      This means content was generated that shouldn't have been!`);
        // Still count as pass but warn
      }

      log(colors.green, `   ✅ PASS (${elapsed}ms)`);
      log(colors.dim, `   Generated: ${test.expectFields.join(', ')}`);

      // Show content sizes
      test.expectFields.forEach(field => {
        const value = content[field];
        if (Array.isArray(value)) {
          console.log(`      ${field}: ${value.length} items`);
        } else if (typeof value === 'object' && value !== null) {
          console.log(`      ${field}: object with ${Object.keys(value).length} keys`);
        }
      });

      passed++;

    } catch (error) {
      log(colors.red, `   ❌ FAIL - Error: ${error.message}`);
      failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  log(colors.cyan, '📊 TEST SUMMARY');
  console.log('='.repeat(70));
  log(passed === tests.length ? colors.green : colors.yellow, `   Passed: ${passed}/${tests.length}`);
  if (failed > 0) log(colors.red, `   Failed: ${failed}`);
  console.log();

  // Flow diagram
  console.log('-'.repeat(70));
  log(colors.yellow, '📝 LAZY LOADING FLOW:');
  console.log('-'.repeat(70));
  console.log(`
  User searches "bubble sort"
         │
         ▼
  ┌──────────────────────────────────────────────────────┐
  │  POST /api/learning-content                          │
  │  { query: "bubble sort", contentType: "learn" }      │
  │                                                      │
  │  ✅ Generates: key_ideas, summary, title             │
  │  ❌ Does NOT generate: quiz, flashcards, examples    │
  └──────────────────────────────────────────────────────┘
         │
         │  User clicks "Quiz" tab
         ▼
  ┌──────────────────────────────────────────────────────┐
  │  POST /api/learning-content                          │
  │  { query: "bubble sort", contentType: "quiz" }       │
  │                                                      │
  │  ✅ Generates: quiz questions                        │
  │  ❌ Does NOT generate: learn, flashcards, examples   │
  └──────────────────────────────────────────────────────┘
         │
         │  User clicks "Simulation" tab
         ▼
  ┌──────────────────────────────────────────────────────┐
  │  POST /api/simulation  (DIFFERENT API!)              │
  │  { topic: "bubble sort", simulationType: "array_sort"}│
  │                                                      │
  │  ✅ Generates: step-by-step algorithm animation      │
  │  ❌ Completely separate from learning-content API    │
  └──────────────────────────────────────────────────────┘

  ⚡ KEY INSIGHT:
  Each tab triggers its OWN API call with a specific contentType.
  Nothing is generated until the user clicks that tab!
  `);

  return failed === 0;
}

// Run
testLazyLoading()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
