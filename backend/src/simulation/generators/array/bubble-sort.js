/**
 * Bubble Sort Generator
 * Generates step-by-step simulation of bubble sort algorithm
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class BubbleSortGenerator extends BaseGenerator {
  constructor() {
    super('bubble_sort', 'array', 'Bubble Sort', {
      array: {
        type: 'array',
        label: 'Array to sort',
        description: 'Enter numbers to sort (e.g., 5, 3, 8, 2)',
        default: [64, 34, 25, 12, 22, 11, 90],
        validation: {
          minLength: 2,
          maxLength: 20
        }
      }
    });

    this.setDescription('Compare adjacent elements and swap if out of order. Larger elements "bubble" to the end.');
    this.setComplexity('O(n²)', 'O(1)');
  }

  doGenerate(inputs) {
    const { array } = inputs;
    const arr = [...array];
    const n = arr.length;
    const steps = [];
    let stepNum = 1;

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      { array: [...arr], variables: { pass: 0, comparisons: 0, swaps: 0 } },
      { primary: [] },
      'start',
      `Starting Bubble Sort with ${n} elements: [${arr.join(', ')}]`
    ));

    let totalComparisons = 0;
    let totalSwaps = 0;

    // Bubble sort algorithm
    for (let i = 0; i < n - 1; i++) {
      let swapped = false;

      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { pass: i + 1, comparisons: totalComparisons, swaps: totalSwaps } },
        { primary: [] },
        'pass_start',
        `Pass ${i + 1}: Will compare elements from index 0 to ${n - i - 2}`
      ));

      for (let j = 0; j < n - i - 1; j++) {
        totalComparisons++;

        // Compare step
        const needsSwap = arr[j] > arr[j + 1];
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, j, pass: i + 1, comparisons: totalComparisons, swaps: totalSwaps } },
          { compared: [j, j + 1] },
          'compare',
          `Comparing arr[${j}]=${arr[j]} and arr[${j + 1}]=${arr[j + 1]}${needsSwap ? ' → Need to swap!' : ' → Already in order'}`
        ));

        if (needsSwap) {
          // Swap
          [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
          totalSwaps++;
          swapped = true;

          steps.push(this.createStep(
            stepNum++,
            { array: [...arr], variables: { i, j, pass: i + 1, comparisons: totalComparisons, swaps: totalSwaps } },
            { swapped: [j, j + 1] },
            'swap',
            `Swapped: ${arr[j + 1]} ↔ ${arr[j]}`
          ));
        }
      }

      // Mark the sorted element
      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { pass: i + 1, comparisons: totalComparisons, swaps: totalSwaps } },
        { sorted: Array.from({ length: i + 1 }, (_, k) => n - 1 - k) },
        'pass_end',
        `Pass ${i + 1} complete. Element ${arr[n - 1 - i]} is now in its final position.`
      ));

      // Early termination if no swaps
      if (!swapped) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { pass: i + 1, comparisons: totalComparisons, swaps: totalSwaps } },
          { primary: [] },
          'early_exit',
          `No swaps in this pass - array is already sorted!`
        ));
        break;
      }
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      { array: [...arr], variables: { comparisons: totalComparisons, swaps: totalSwaps } },
      { sorted: arr.map((_, i) => i) },
      'complete',
      `Sorting complete! Total: ${totalComparisons} comparisons, ${totalSwaps} swaps. Result: [${arr.join(', ')}]`
    ));

    return this.buildIR(inputs, { array: [...inputs.array] }, steps);
  }
}

// Register the generator
registry.register(new BubbleSortGenerator());

export default BubbleSortGenerator;
