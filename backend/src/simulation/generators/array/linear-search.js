/**
 * Linear Search Generator
 * Generates step-by-step simulation of linear search algorithm
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class LinearSearchGenerator extends BaseGenerator {
  constructor() {
    super('linear_search', 'array', 'Linear Search', {
      array: {
        type: 'array',
        label: 'Array to search',
        description: 'Enter numbers to search through (e.g., 5, 3, 8, 2)',
        default: [64, 34, 25, 12, 22, 11, 90],
        validation: {
          minLength: 1,
          maxLength: 30
        }
      },
      target: {
        type: 'number',
        label: 'Target value',
        description: 'Value to search for',
        default: 22,
        validation: {
          min: -10000,
          max: 10000
        }
      }
    });

    this.setDescription('Search through array one element at a time from beginning to end.');
    this.setComplexity('O(n)', 'O(1)');
  }

  doGenerate(inputs) {
    const { array, target } = inputs;
    const arr = [...array];
    const n = arr.length;
    const steps = [];
    let stepNum = 1;

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      { array: [...arr], variables: { target, comparisons: 0 } },
      { primary: [] },
      'start',
      `Starting Linear Search for target=${target} in array [${arr.join(', ')}]`
    ));

    let found = false;
    let foundIndex = -1;
    let totalComparisons = 0;

    // Linear search algorithm
    for (let i = 0; i < n; i++) {
      totalComparisons++;

      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { i, target, comparisons: totalComparisons } },
        { current: i, visited: Array.from({ length: i }, (_, k) => k) },
        'check',
        `Checking index ${i}: arr[${i}] = ${arr[i]}`
      ));

      if (arr[i] === target) {
        found = true;
        foundIndex = i;

        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, target, foundIndex, comparisons: totalComparisons } },
          { primary: [i], visited: Array.from({ length: i }, (_, k) => k) },
          'found',
          `Found! arr[${i}] = ${arr[i]} equals target ${target}`
        ));
        break;
      } else {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, target, comparisons: totalComparisons } },
          { compared: [i], visited: Array.from({ length: i + 1 }, (_, k) => k) },
          'not_match',
          `arr[${i}] = ${arr[i]} ≠ target ${target} → Continue to next element`
        ));
      }
    }

    // Final state
    if (found) {
      steps.push(this.createStep(
        stepNum,
        { array: [...arr], variables: { target, foundIndex, comparisons: totalComparisons } },
        { primary: [foundIndex] },
        'complete',
        `Search complete! Found ${target} at index ${foundIndex} in ${totalComparisons} comparisons.`
      ));
    } else {
      steps.push(this.createStep(
        stepNum,
        { array: [...arr], variables: { target, comparisons: totalComparisons } },
        { visited: Array.from({ length: n }, (_, k) => k) },
        'not_found',
        `Search complete! Target ${target} not found in the array. Checked all ${n} elements (${totalComparisons} comparisons).`
      ));
    }

    return this.buildIR(inputs, { array: [...inputs.array], target }, steps);
  }
}

// Register the generator
registry.register(new LinearSearchGenerator());

export default LinearSearchGenerator;
