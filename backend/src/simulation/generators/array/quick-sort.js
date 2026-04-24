/**
 * Quick Sort Generator
 * Generates step-by-step simulation of quick sort algorithm
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class QuickSortGenerator extends BaseGenerator {
  constructor() {
    super('quick_sort', 'array', 'Quick Sort', {
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

    this.setDescription('Divide and conquer: pick a pivot, partition around it, recursively sort partitions.');
    this.setComplexity('O(n log n) average, O(n²) worst', 'O(log n)');
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
      { array: [...arr], variables: { comparisons: 0, swaps: 0 } },
      { primary: [] },
      'start',
      `Starting Quick Sort with ${n} elements: [${arr.join(', ')}]`
    ));

    let totalComparisons = 0;
    let totalSwaps = 0;

    // Partition function
    const partition = (low, high, depth) => {
      const pivot = arr[high];

      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { low, high, pivot, depth, comparisons: totalComparisons, swaps: totalSwaps } },
        { primary: [high], secondary: Array.from({ length: high - low }, (_, i) => low + i) },
        'choose_pivot',
        `Depth ${depth}: Choosing pivot = ${pivot} (last element at index ${high})`
      ));

      let i = low - 1;

      for (let j = low; j < high; j++) {
        totalComparisons++;
        const needsSwap = arr[j] <= pivot;

        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, j, pivot, low, high, depth, comparisons: totalComparisons, swaps: totalSwaps } },
          { compared: [j, high], primary: [high] },
          'compare',
          `Comparing arr[${j}]=${arr[j]} with pivot=${pivot}${needsSwap ? ' → Move to left partition' : ' → Stay in right partition'}`
        ));

        if (needsSwap) {
          i++;
          if (i !== j) {
            [arr[i], arr[j]] = [arr[j], arr[i]];
            totalSwaps++;

            steps.push(this.createStep(
              stepNum++,
              { array: [...arr], variables: { i, j, pivot, low, high, depth, comparisons: totalComparisons, swaps: totalSwaps } },
              { swapped: [i, j], primary: [high] },
              'swap',
              `Swapped arr[${i}]=${arr[j]} and arr[${j}]=${arr[i]}`
            ));
          }
        }
      }

      // Place pivot in correct position
      const pivotPos = i + 1;
      if (pivotPos !== high) {
        [arr[pivotPos], arr[high]] = [arr[high], arr[pivotPos]];
        totalSwaps++;

        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { pivotPos, low, high, depth, comparisons: totalComparisons, swaps: totalSwaps } },
          { swapped: [pivotPos, high], sorted: [pivotPos] },
          'place_pivot',
          `Placed pivot ${pivot} at its final position (index ${pivotPos})`
        ));
      } else {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { pivotPos, low, high, depth, comparisons: totalComparisons, swaps: totalSwaps } },
          { sorted: [pivotPos] },
          'pivot_in_place',
          `Pivot ${pivot} is already at its final position (index ${pivotPos})`
        ));
      }

      return pivotPos;
    };

    // QuickSort function
    const quickSort = (low, high, depth = 0) => {
      if (low < high) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { low, high, depth, comparisons: totalComparisons, swaps: totalSwaps } },
          { secondary: Array.from({ length: high - low + 1 }, (_, i) => low + i) },
          'recursive_call',
          `Depth ${depth}: Sorting subarray from index ${low} to ${high}`
        ));

        const pi = partition(low, high, depth);

        // Recursively sort left and right partitions
        quickSort(low, pi - 1, depth + 1);
        quickSort(pi + 1, high, depth + 1);
      } else if (low === high) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { low, high, depth, comparisons: totalComparisons, swaps: totalSwaps } },
          { sorted: [low] },
          'single_element',
          `Single element at index ${low} is in its final position`
        ));
      }
    };

    // Execute quick sort
    quickSort(0, n - 1);

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
registry.register(new QuickSortGenerator());

export default QuickSortGenerator;
