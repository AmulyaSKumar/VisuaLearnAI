/**
 * Selection Sort Generator
 * Generates step-by-step simulation of selection sort algorithm
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class SelectionSortGenerator extends BaseGenerator {
  constructor() {
    super('selection_sort', 'array', 'Selection Sort', {
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

    this.setDescription('Find minimum element from unsorted portion and swap it with the first unsorted element.');
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
      { array: [...arr], variables: { comparisons: 0, swaps: 0 } },
      { primary: [] },
      'start',
      `Starting Selection Sort with ${n} elements: [${arr.join(', ')}]`
    ));

    let totalComparisons = 0;
    let totalSwaps = 0;

    // Selection sort algorithm
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;

      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { pass: i + 1, i, minIdx, comparisons: totalComparisons, swaps: totalSwaps } },
        {
          primary: [i],
          sorted: Array.from({ length: i }, (_, k) => k),
          secondary: Array.from({ length: n - i }, (_, k) => i + k)
        },
        'pass_start',
        `Pass ${i + 1}: Finding minimum in unsorted portion [${arr.slice(i).join(', ')}]. Current minimum: ${arr[minIdx]} at index ${minIdx}`
      ));

      // Find minimum element in unsorted portion
      for (let j = i + 1; j < n; j++) {
        totalComparisons++;
        const isNewMin = arr[j] < arr[minIdx];

        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, j, minIdx, minValue: arr[minIdx], comparisons: totalComparisons, swaps: totalSwaps } },
          {
            compared: [j, minIdx],
            primary: [minIdx],
            sorted: Array.from({ length: i }, (_, k) => k)
          },
          'compare',
          `Comparing arr[${j}]=${arr[j]} with current min=${arr[minIdx]}${isNewMin ? ' → New minimum found!' : ' → Keep current minimum'}`
        ));

        if (isNewMin) {
          minIdx = j;
          steps.push(this.createStep(
            stepNum++,
            { array: [...arr], variables: { i, j, minIdx, minValue: arr[minIdx], comparisons: totalComparisons, swaps: totalSwaps } },
            {
              primary: [minIdx],
              sorted: Array.from({ length: i }, (_, k) => k)
            },
            'new_min',
            `New minimum: ${arr[minIdx]} at index ${minIdx}`
          ));
        }
      }

      // Swap minimum with first unsorted element
      if (minIdx !== i) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, minIdx, comparisons: totalComparisons, swaps: totalSwaps } },
          {
            compared: [i, minIdx],
            sorted: Array.from({ length: i }, (_, k) => k)
          },
          'swap_pending',
          `Swapping minimum ${arr[minIdx]} at index ${minIdx} with ${arr[i]} at index ${i}`
        ));

        [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
        totalSwaps++;

        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, minIdx, comparisons: totalComparisons, swaps: totalSwaps } },
          {
            swapped: [i, minIdx],
            sorted: Array.from({ length: i + 1 }, (_, k) => k)
          },
          'swap',
          `Swapped: ${arr[i]} is now in its final position at index ${i}`
        ));
      } else {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, minIdx, comparisons: totalComparisons, swaps: totalSwaps } },
          {
            primary: [i],
            sorted: Array.from({ length: i + 1 }, (_, k) => k)
          },
          'no_swap',
          `No swap needed: ${arr[i]} is already the minimum and in its final position`
        ));
      }

      // Pass complete
      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { pass: i + 1, comparisons: totalComparisons, swaps: totalSwaps } },
        { sorted: Array.from({ length: i + 1 }, (_, k) => k) },
        'pass_complete',
        `Pass ${i + 1} complete. Sorted portion: [${arr.slice(0, i + 1).join(', ')}]`
      ));
    }

    // Last element is automatically sorted
    steps.push(this.createStep(
      stepNum++,
      { array: [...arr], variables: { comparisons: totalComparisons, swaps: totalSwaps } },
      { sorted: arr.map((_, i) => i) },
      'last_element',
      `Last element ${arr[n - 1]} is automatically in its final position`
    ));

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
registry.register(new SelectionSortGenerator());

export default SelectionSortGenerator;
