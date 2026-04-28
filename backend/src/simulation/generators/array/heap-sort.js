/**
 * Heap Sort Generator
 * Generates step-by-step simulation of heap sort algorithm
 * Uses max-heap to sort array in ascending order
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class HeapSortGenerator extends BaseGenerator {
  constructor() {
    super('heap_sort', 'array', 'Heap Sort', {
      array: {
        type: 'array',
        label: 'Array to sort',
        description: 'Enter numbers to sort (e.g., 5, 3, 8, 2)',
        default: [4, 10, 3, 5, 1, 8, 7, 2, 9, 6],
        validation: {
          minLength: 2,
          maxLength: 20
        }
      }
    });

    this.setDescription('Build a max-heap, then repeatedly extract maximum to sort. Efficient in-place sorting.');
    this.setComplexity('O(n log n)', 'O(1)');
  }

  doGenerate(inputs) {
    const { array } = inputs;
    const arr = [...array];
    const n = arr.length;
    const steps = [];
    let stepNum = 1;

    // Helper to get parent and child indices
    const parent = (i) => Math.floor((i - 1) / 2);
    const leftChild = (i) => 2 * i + 1;
    const rightChild = (i) => 2 * i + 2;

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      { array: [...arr], variables: { phase: 'init', heapSize: n } },
      { primary: [] },
      'start',
      `Starting Heap Sort with ${n} elements: [${arr.join(', ')}]`
    ));

    // Heapify function - sift down
    const heapify = (arr, heapSize, rootIdx, phase) => {
      let largest = rootIdx;
      const left = leftChild(rootIdx);
      const right = rightChild(rootIdx);

      // Compare with left child
      if (left < heapSize) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { phase, heapSize, root: rootIdx, left, right: right < heapSize ? right : null } },
          { compared: [rootIdx, left] },
          'compare',
          `Compare root arr[${rootIdx}]=${arr[rootIdx]} with left child arr[${left}]=${arr[left]}`
        ));

        if (arr[left] > arr[largest]) {
          largest = left;
        }
      }

      // Compare with right child
      if (right < heapSize) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { phase, heapSize, root: rootIdx, left, right } },
          { compared: [largest, right] },
          'compare',
          `Compare largest arr[${largest}]=${arr[largest]} with right child arr[${right}]=${arr[right]}`
        ));

        if (arr[right] > arr[largest]) {
          largest = right;
        }
      }

      // Swap if needed
      if (largest !== rootIdx) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { phase, heapSize, swapping: [rootIdx, largest] } },
          { swapped: [rootIdx, largest] },
          'swap',
          `Swap arr[${rootIdx}]=${arr[rootIdx]} with arr[${largest}]=${arr[largest]} to maintain heap property`
        ));

        [arr[rootIdx], arr[largest]] = [arr[largest], arr[rootIdx]];

        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { phase, heapSize } },
          { primary: [largest] },
          'after_swap',
          `After swap: Continue heapifying at index ${largest}`
        ));

        // Recursively heapify the affected subtree
        heapify(arr, heapSize, largest, phase);
      }
    };

    // Phase 1: Build max-heap
    steps.push(this.createStep(
      stepNum++,
      { array: [...arr], variables: { phase: 'build_heap', heapSize: n } },
      { primary: [] },
      'phase_start',
      'Phase 1: Build max-heap from bottom-up (start from last non-leaf node)'
    ));

    // Start from last non-leaf node
    const startIdx = Math.floor(n / 2) - 1;
    for (let i = startIdx; i >= 0; i--) {
      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { phase: 'build_heap', heapSize: n, currentNode: i } },
        { current: i },
        'heapify_start',
        `Heapify subtree rooted at index ${i} (value: ${arr[i]})`
      ));

      heapify(arr, n, i, 'build_heap');
    }

    steps.push(this.createStep(
      stepNum++,
      { array: [...arr], variables: { phase: 'heap_built', heapSize: n } },
      { primary: [0] },
      'heap_complete',
      `Max-heap built! Root (${arr[0]}) is the maximum element.`
    ));

    // Phase 2: Extract elements from heap
    steps.push(this.createStep(
      stepNum++,
      { array: [...arr], variables: { phase: 'extract', heapSize: n } },
      { primary: [] },
      'phase_start',
      'Phase 2: Repeatedly extract maximum and rebuild heap'
    ));

    let sortedCount = 0;
    for (let i = n - 1; i > 0; i--) {
      // Move current root (max) to end
      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { phase: 'extract', heapSize: i + 1, extracting: arr[0] } },
        { compared: [0, i], sorted: Array.from({ length: sortedCount }, (_, k) => n - 1 - k) },
        'extract_max',
        `Extract max (${arr[0]}) - swap with last unsorted element (${arr[i]})`
      ));

      [arr[0], arr[i]] = [arr[i], arr[0]];
      sortedCount++;

      steps.push(this.createStep(
        stepNum++,
        { array: [...arr], variables: { phase: 'extract', heapSize: i } },
        { swapped: [0, i], sorted: Array.from({ length: sortedCount }, (_, k) => n - 1 - k) },
        'after_extract',
        `${arr[i]} is now in its final sorted position. Heap size reduced to ${i}.`
      ));

      // Heapify the reduced heap
      if (i > 1) {
        steps.push(this.createStep(
          stepNum++,
          { array: [...arr], variables: { phase: 'restore_heap', heapSize: i } },
          { current: 0, sorted: Array.from({ length: sortedCount }, (_, k) => n - 1 - k) },
          'restore_start',
          `Restore heap property by heapifying root`
        ));

        heapify(arr, i, 0, 'restore_heap');
      }
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      { array: [...arr], variables: { phase: 'complete' } },
      { sorted: arr.map((_, i) => i) },
      'complete',
      `Heap Sort complete! Sorted array: [${arr.join(', ')}]`
    ));

    return this.buildIR(inputs, { array: [...inputs.array] }, steps);
  }
}

// Register the generator
registry.register(new HeapSortGenerator());

export default HeapSortGenerator;
