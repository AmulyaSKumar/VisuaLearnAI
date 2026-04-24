/**
 * Merge Sort Generator
 * Generates step-by-step simulation of merge sort algorithm
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class MergeSortGenerator extends BaseGenerator {
  constructor() {
    super('merge_sort', 'array', 'Merge Sort', {
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

    this.setDescription('Divide array in half, recursively sort halves, then merge sorted halves.');
    this.setComplexity('O(n log n)', 'O(n)');
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
      { array: [...arr], variables: { comparisons: 0, merges: 0 } },
      { primary: [] },
      'start',
      `Starting Merge Sort with ${n} elements: [${arr.join(', ')}]`
    ));

    let totalComparisons = 0;
    let totalMerges = 0;

    // Merge function
    const merge = (left, mid, right, depth) => {
      const leftArr = arr.slice(left, mid + 1);
      const rightArr = arr.slice(mid + 1, right + 1);

      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { left, mid, right, depth, comparisons: totalComparisons, merges: totalMerges } },
        {
          primary: Array.from({ length: mid - left + 1 }, (_, i) => left + i),
          secondary: Array.from({ length: right - mid }, (_, i) => mid + 1 + i)
        },
        'merge_start',
        `Depth ${depth}: Merging [${leftArr.join(', ')}] and [${rightArr.join(', ')}]`
      ));

      let i = 0, j = 0, k = left;

      while (i < leftArr.length && j < rightArr.length) {
        totalComparisons++;

        if (leftArr[i] <= rightArr[j]) {
          steps.push(this.createStep(
            stepNum++,
            { array: [...arr], variables: { i, j, k, left, right, depth, comparisons: totalComparisons, merges: totalMerges } },
            { compared: [left + i, mid + 1 + j] },
            'compare',
            `Comparing ${leftArr[i]} ≤ ${rightArr[j]} → Taking ${leftArr[i]} from left`
          ));
          arr[k] = leftArr[i];
          i++;
        } else {
          steps.push(this.createStep(
            stepNum++,
            { array: [...arr], variables: { i, j, k, left, right, depth, comparisons: totalComparisons, merges: totalMerges } },
            { compared: [left + i, mid + 1 + j] },
            'compare',
            `Comparing ${leftArr[i]} > ${rightArr[j]} → Taking ${rightArr[j]} from right`
          ));
          arr[k] = rightArr[j];
          j++;
        }

        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, j, k, left, right, depth, comparisons: totalComparisons, merges: totalMerges } },
          { primary: [k] },
          'place',
          `Placed ${arr[k]} at position ${k}`
        ));
        k++;
      }

      // Copy remaining elements from left array
      while (i < leftArr.length) {
        arr[k] = leftArr[i];
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, j, k, left, right, depth, comparisons: totalComparisons, merges: totalMerges } },
          { primary: [k] },
          'copy_left',
          `Copying remaining ${leftArr[i]} from left array to position ${k}`
        ));
        i++;
        k++;
      }

      // Copy remaining elements from right array
      while (j < rightArr.length) {
        arr[k] = rightArr[j];
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { i, j, k, left, right, depth, comparisons: totalComparisons, merges: totalMerges } },
          { primary: [k] },
          'copy_right',
          `Copying remaining ${rightArr[j]} from right array to position ${k}`
        ));
        j++;
        k++;
      }

      totalMerges++;
      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { left, right, depth, comparisons: totalComparisons, merges: totalMerges } },
        { sorted: Array.from({ length: right - left + 1 }, (_, i) => left + i) },
        'merge_complete',
        `Merge complete: [${arr.slice(left, right + 1).join(', ')}]`
      ));
    };

    // MergeSort function
    const mergeSort = (left, right, depth = 0) => {
      if (left < right) {
        const mid = Math.floor((left + right) / 2);

        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { left, mid, right, depth, comparisons: totalComparisons, merges: totalMerges } },
          { secondary: Array.from({ length: right - left + 1 }, (_, i) => left + i) },
          'divide',
          `Depth ${depth}: Dividing [${arr.slice(left, right + 1).join(', ')}] at mid=${mid}`
        ));

        // Recursively sort first and second halves
        mergeSort(left, mid, depth + 1);
        mergeSort(mid + 1, right, depth + 1);

        // Merge the sorted halves
        merge(left, mid, right, depth);
      } else if (left === right) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { left, right, depth, comparisons: totalComparisons, merges: totalMerges } },
          { primary: [left] },
          'single_element',
          `Depth ${depth}: Single element [${arr[left]}] - already sorted`
        ));
      }
    };

    // Execute merge sort
    mergeSort(0, n - 1);

    // Final state
    steps.push(this.createStep(
      stepNum,
      { array: [...arr], variables: { comparisons: totalComparisons, merges: totalMerges } },
      { sorted: arr.map((_, i) => i) },
      'complete',
      `Sorting complete! Total: ${totalComparisons} comparisons, ${totalMerges} merges. Result: [${arr.join(', ')}]`
    ));

    return this.buildIR(inputs, { array: [...inputs.array] }, steps);
  }
}

// Register the generator
registry.register(new MergeSortGenerator());

export default MergeSortGenerator;
