/**
 * Test all generators
 */
import '../src/simulation/generators/index.js';
import registry from '../src/simulation/registry.js';

console.log('=== REGISTERED GENERATORS ===');
const keys = registry.keys();
console.log('Total generators:', keys.length);
console.log('');

const byType = {};
keys.forEach(key => {
  const gen = registry.get(key);
  const type = gen.type;
  if (!byType[type]) byType[type] = [];
  byType[type].push(key);
});

Object.entries(byType).sort().forEach(([type, gens]) => {
  console.log(`\n[${type.toUpperCase()}] (${gens.length}):`);
  gens.forEach(g => console.log('  -', g));
});

console.log('\n\n=== TEST GENERATION ===');

// Test new generators
const testCases = [
  { key: 'bellman_ford', inputs: {} },
  { key: 'floyd_warshall', inputs: {} },
  { key: 'prims', inputs: {} },
  { key: 'kruskals', inputs: {} },
  { key: 'lcs', inputs: { string1: 'ABCD', string2: 'ACD' } },
  { key: 'lis', inputs: { array: [10, 22, 9, 33, 21, 50] } },
  { key: 'edit_distance', inputs: { string1: 'kitten', string2: 'sitting' } },
  { key: 'priority_scheduling', inputs: {} },
  { key: 'srtf', inputs: {} },
  { key: 'stack_operations', inputs: {} },
  { key: 'linkedlist_insert', inputs: {} },
  { key: 'linkedlist_delete', inputs: {} },
  { key: 'linkedlist_reverse', inputs: {} },
  { key: 'min_heap', inputs: {} },
  { key: 'max_heap', inputs: {} },
  { key: 'turing_machine', inputs: {} }
];

let passed = 0;
let failed = 0;

testCases.forEach(tc => {
  const gen = registry.get(tc.key);
  if (gen) {
    try {
      const result = gen.generate(tc.inputs);
      // Steps are in result.simulation.steps
      const stepCount = result.simulation?.steps?.length || 0;
      if (result.success && stepCount > 0) {
        console.log(`✓ ${tc.key}: ${stepCount} steps`);
        passed++;
      } else {
        console.log(`✗ ${tc.key}: ${result.error || 'No steps generated'}`);
        failed++;
      }
    } catch (err) {
      console.log(`✗ ${tc.key}: ERROR - ${err.message}`);
      failed++;
    }
  } else {
    console.log(`✗ ${tc.key}: NOT FOUND`);
    failed++;
  }
});

console.log(`\n\n=== RESULTS ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
