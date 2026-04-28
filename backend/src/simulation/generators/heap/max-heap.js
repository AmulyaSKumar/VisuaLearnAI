/**
 * Max Heap Operations Generator
 * Generates step-by-step visualization of max heap insert and extract operations
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class MaxHeapGenerator extends BaseGenerator {
  constructor() {
    super('max_heap', 'heap', 'Max Heap Operations', {
      operations: {
        type: 'array',
        label: 'Operations',
        description: 'List of operations: insert(value) or extractMax',
        default: [
          { type: 'insert', value: 10 },
          { type: 'insert', value: 20 },
          { type: 'insert', value: 5 },
          { type: 'insert', value: 30 },
          { type: 'insert', value: 15 },
          { type: 'extractMax' },
          { type: 'insert', value: 25 },
          { type: 'extractMax' }
        ]
      }
    });

    this.setDescription('Max Heap: Parent is always larger than children. Insert bubbles up, ExtractMax bubbles down.');
    this.setComplexity('O(log n)', 'O(n)');
  }

  doGenerate(inputs) {
    const { operations } = inputs;
    const steps = [];
    let stepNum = 1;

    const heap = [];

    // Helper functions
    const parent = (i) => Math.floor((i - 1) / 2);
    const leftChild = (i) => 2 * i + 1;
    const rightChild = (i) => 2 * i + 2;

    const swap = (i, j) => {
      [heap[i], heap[j]] = [heap[j], heap[i]];
    };

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        heap: [...heap],
        variables: { size: 0, type: 'Max Heap' }
      },
      { heap: [...heap], isMaxHeap: true },
      'start',
      `Max Heap initialized. Property: parent ≥ children`
    ));

    // Process each operation
    for (const op of operations) {
      if (op.type === 'insert') {
        // Insert at end
        heap.push(op.value);
        let currentIdx = heap.length - 1;

        steps.push(this.createStep(
          stepNum++,
          {
            heap: [...heap],
            variables: { operation: `insert(${op.value})`, insertedAt: currentIdx }
          },
          { heap: [...heap], inserted: currentIdx },
          'insert',
          `Insert ${op.value} at index ${currentIdx} (end of heap)`
        ));

        // Bubble up
        while (currentIdx > 0 && heap[currentIdx] > heap[parent(currentIdx)]) {
          const parentIdx = parent(currentIdx);

          steps.push(this.createStep(
            stepNum++,
            {
              heap: [...heap],
              variables: {
                comparing: `${heap[currentIdx]} > ${heap[parentIdx]}`,
                current: currentIdx,
                parent: parentIdx
              }
            },
            { heap: [...heap], comparing: [currentIdx, parentIdx], bubbleUp: true },
            'compare',
            `Compare: ${heap[currentIdx]} > ${heap[parentIdx]}? Yes, swap needed (max heap property violated)`
          ));

          swap(currentIdx, parentIdx);

          steps.push(this.createStep(
            stepNum++,
            {
              heap: [...heap],
              variables: { swapped: true, newPosition: parentIdx }
            },
            { heap: [...heap], swapped: [currentIdx, parentIdx], movedTo: parentIdx },
            'swap',
            `Swapped! ${op.value} moved up to index ${parentIdx}`
          ));

          currentIdx = parentIdx;
        }

        if (currentIdx === 0 || heap[currentIdx] <= heap[parent(currentIdx)]) {
          steps.push(this.createStep(
            stepNum++,
            {
              heap: [...heap],
              variables: { heapified: true, finalPosition: currentIdx }
            },
            { heap: [...heap], settled: currentIdx },
            'settled',
            `${op.value} settled at index ${currentIdx}. Heap property satisfied.`
          ));
        }

      } else if (op.type === 'extractMax') {
        if (heap.length === 0) {
          steps.push(this.createStep(
            stepNum++,
            {
              heap: [...heap],
              variables: { error: 'Heap is empty' }
            },
            { heap: [...heap], error: true },
            'empty',
            `Cannot extract from empty heap!`
          ));
          continue;
        }

        const maxValue = heap[0];

        steps.push(this.createStep(
          stepNum++,
          {
            heap: [...heap],
            variables: { operation: 'extractMax', maxValue }
          },
          { heap: [...heap], extracting: 0 },
          'extract_start',
          `Extract maximum value: ${maxValue} (root)`
        ));

        // Move last element to root
        heap[0] = heap[heap.length - 1];
        heap.pop();

        if (heap.length === 0) {
          steps.push(this.createStep(
            stepNum++,
            {
              heap: [...heap],
              extractedValue: maxValue,
              variables: { extracted: maxValue, size: 0 }
            },
            { heap: [...heap], extracted: maxValue },
            'extracted',
            `Extracted ${maxValue}. Heap is now empty.`
          ));
          continue;
        }

        steps.push(this.createStep(
          stepNum++,
          {
            heap: [...heap],
            variables: { movedToRoot: heap[0], size: heap.length }
          },
          { heap: [...heap], movedToRoot: 0 },
          'move_to_root',
          `Moved last element (${heap[0]}) to root position`
        ));

        // Bubble down
        let currentIdx = 0;
        while (true) {
          let largest = currentIdx;
          const left = leftChild(currentIdx);
          const right = rightChild(currentIdx);

          if (left < heap.length && heap[left] > heap[largest]) {
            largest = left;
          }
          if (right < heap.length && heap[right] > heap[largest]) {
            largest = right;
          }

          if (largest === currentIdx) {
            steps.push(this.createStep(
              stepNum++,
              {
                heap: [...heap],
                extractedValue: maxValue,
                variables: { heapified: true, finalPosition: currentIdx }
              },
              { heap: [...heap], settled: currentIdx, extracted: maxValue },
              'settled',
              `${heap[currentIdx]} settled at index ${currentIdx}. Heap property restored.`
            ));
            break;
          }

          steps.push(this.createStep(
            stepNum++,
            {
              heap: [...heap],
              variables: {
                current: heap[currentIdx],
                largestChild: heap[largest],
                swapNeeded: true
              }
            },
            { heap: [...heap], comparing: [currentIdx, largest], bubbleDown: true },
            'compare_children',
            `Compare with children: ${heap[largest]} > ${heap[currentIdx]}, swap needed`
          ));

          swap(currentIdx, largest);

          steps.push(this.createStep(
            stepNum++,
            {
              heap: [...heap],
              variables: { swapped: true, newPosition: largest }
            },
            { heap: [...heap], swapped: [currentIdx, largest] },
            'swap_down',
            `Swapped! Element moved down to index ${largest}`
          ));

          currentIdx = largest;
        }
      }
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        heap: [...heap],
        variables: {
          finalSize: heap.length,
          heapArray: heap.join(', '),
          max: heap.length > 0 ? heap[0] : 'N/A'
        }
      },
      { heap: [...heap], complete: true },
      'complete',
      `Complete! Max Heap: [${heap.join(', ')}]${heap.length > 0 ? `, Max: ${heap[0]}` : ''}`
    ));

    return this.buildIR(inputs, { heap: [] }, steps);
  }
}

// Register the generator
registry.register(new MaxHeapGenerator());

export default MaxHeapGenerator;
