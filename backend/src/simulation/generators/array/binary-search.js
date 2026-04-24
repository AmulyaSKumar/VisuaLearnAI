/**
 * Binary Search Generator
 * Generates step-by-step simulation of binary search algorithm
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class BinarySearchGenerator extends BaseGenerator {
  constructor() {
    super('binary_search', 'array', 'Binary Search', {
      array: {
        type: 'array',
        label: 'Sorted array to search',
        description: 'Enter a sorted array (e.g., 1, 3, 5, 7, 9)',
        default: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91],
        validation: {
          minLength: 2,
          maxLength: 30
        }
      },
      target: {
        type: 'number',
        label: 'Target value',
        description: 'Value to search for',
        default: 23,
        validation: {
          min: -10000,
          max: 10000
        }
      }
    });

    this.setDescription('Efficiently search a sorted array by repeatedly dividing the search interval in half.');
    this.setComplexity('O(log n)', 'O(1)');
  }

  doGenerate(inputs) {
    const { array, target } = inputs;
    const arr = [...array].sort((a, b) => a - b); // Ensure sorted
    const n = arr.length;
    const steps = [];
    let stepNum = 1;

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      { array: [...arr], variables: { target, comparisons: 0 } },
      { primary: [] },
      'start',
      `Starting Binary Search for target=${target} in sorted array [${arr.join(', ')}]`
    ));

    let left = 0;
    let right = n - 1;
    let totalComparisons = 0;
    let found = false;
    let foundIndex = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);

      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { left, right, mid, target, comparisons: totalComparisons } },
        {
          secondary: Array.from({ length: right - left + 1 }, (_, i) => left + i),
          current: mid
        },
        'calculate_mid',
        `Search range: [${left}, ${right}]. Mid index = floor((${left} + ${right}) / 2) = ${mid}. Checking arr[${mid}] = ${arr[mid]}`
      ));

      totalComparisons++;

      if (arr[mid] === target) {
        found = true;
        foundIndex = mid;

        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { left, right, mid, target, comparisons: totalComparisons, foundIndex } },
          { primary: [mid] },
          'found',
          `Found! arr[${mid}] = ${arr[mid]} equals target ${target}`
        ));
        break;

      } else if (arr[mid] < target) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { left, right, mid, target, comparisons: totalComparisons } },
          {
            compared: [mid],
            secondary: Array.from({ length: mid - left }, (_, i) => left + i)
          },
          'go_right',
          `arr[${mid}] = ${arr[mid]} < target ${target} → Search right half. Eliminating indices [${left}, ${mid}]`
        ));
        left = mid + 1;

      } else {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { left, right, mid, target, comparisons: totalComparisons } },
          {
            compared: [mid],
            secondary: Array.from({ length: right - mid }, (_, i) => mid + 1 + i)
          },
          'go_left',
          `arr[${mid}] = ${arr[mid]} > target ${target} → Search left half. Eliminating indices [${mid}, ${right}]`
        ));
        right = mid - 1;
      }

      // Show updated search range
      if (left <= right) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { left, right, target, comparisons: totalComparisons } },
          { secondary: Array.from({ length: right - left + 1 }, (_, i) => left + i) },
          'update_range',
          `New search range: [${left}, ${right}] = [${arr.slice(left, right + 1).join(', ')}]`
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
        { primary: [] },
        'not_found',
        `Search complete! Target ${target} not found in the array. Total comparisons: ${totalComparisons}`
      ));
    }

    return this.buildIR(inputs, { array: [...inputs.array], target }, steps);
  }
}

// Register the generator
registry.register(new BinarySearchGenerator());

export default BinarySearchGenerator;
