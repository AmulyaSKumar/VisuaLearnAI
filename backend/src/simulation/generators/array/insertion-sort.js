/**
 * Insertion Sort Generator
 * Generates step-by-step simulation of insertion sort algorithm
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class InsertionSortGenerator extends BaseGenerator {
  constructor() {
    super('insertion_sort', 'array', 'Insertion Sort', {
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

    this.setDescription('Build sorted array one element at a time by inserting each element in its correct position.');
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
      { array: [...arr], variables: { comparisons: 0, shifts: 0 } },
      { sorted: [0] },
      'start',
      `Starting Insertion Sort with ${n} elements: [${arr.join(', ')}]. First element [${arr[0]}] is already sorted.`
    ));

    let totalComparisons = 0;
    let totalShifts = 0;

    // Insertion sort algorithm
    for (let i = 1; i < n; i++) {
      const key = arr[i];
      let j = i - 1;

      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { i, key, comparisons: totalComparisons, shifts: totalShifts } },
        { primary: [i], sorted: Array.from({ length: i }, (_, k) => k) },
        'pick_key',
        `Picking key = ${key} at index ${i}. Need to insert it in the sorted portion [${arr.slice(0, i).join(', ')}]`
      ));

      // Find correct position and shift elements
      let shifted = false;
      while (j >= 0 && arr[j] > key) {
        totalComparisons++;

        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, j, key, comparisons: totalComparisons, shifts: totalShifts } },
          { compared: [j], primary: [i] },
          'compare',
          `Comparing arr[${j}]=${arr[j]} > key=${key} → Need to shift ${arr[j]} right`
        ));

        // Shift element to the right
        arr[j + 1] = arr[j];
        totalShifts++;
        shifted = true;

        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, j, key, comparisons: totalComparisons, shifts: totalShifts } },
          { swapped: [j, j + 1] },
          'shift',
          `Shifted ${arr[j]} from index ${j} to ${j + 1}`
        ));

        j--;
      }

      // Final comparison (if we stopped because arr[j] <= key)
      if (j >= 0) {
        totalComparisons++;
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, j, key, comparisons: totalComparisons, shifts: totalShifts } },
          { compared: [j], primary: [j + 1] },
          'compare_stop',
          `Comparing arr[${j}]=${arr[j]} ≤ key=${key} → Found insertion position at index ${j + 1}`
        ));
      }

      // Insert key at correct position
      arr[j + 1] = key;

      if (shifted || j + 1 !== i) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, insertPos: j + 1, key, comparisons: totalComparisons, shifts: totalShifts } },
          { primary: [j + 1], sorted: Array.from({ length: i + 1 }, (_, k) => k) },
          'insert',
          `Inserted key=${key} at index ${j + 1}`
        ));
      } else {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, key, comparisons: totalComparisons, shifts: totalShifts } },
          { primary: [i], sorted: Array.from({ length: i + 1 }, (_, k) => k) },
          'already_in_place',
          `Key=${key} is already in correct position at index ${i}`
        ));
      }

      // Show sorted portion progress
      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { pass: i, comparisons: totalComparisons, shifts: totalShifts } },
        { sorted: Array.from({ length: i + 1 }, (_, k) => k) },
        'pass_complete',
        `Pass ${i} complete. Sorted portion: [${arr.slice(0, i + 1).join(', ')}]`
      ));
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      { array: [...arr], variables: { comparisons: totalComparisons, shifts: totalShifts } },
      { sorted: arr.map((_, i) => i) },
      'complete',
      `Sorting complete! Total: ${totalComparisons} comparisons, ${totalShifts} shifts. Result: [${arr.join(', ')}]`
    ));

    return this.buildIR(inputs, { array: [...inputs.array] }, steps);
  }
}

// Register the generator
registry.register(new InsertionSortGenerator());

export default InsertionSortGenerator;
