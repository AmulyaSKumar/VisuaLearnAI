/**
 * Min Heap Operations Generator
 * Generates step-by-step visualization of min heap insert and extract operations
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class MinHeapGenerator extends BaseGenerator {
  constructor() {
    super('min_heap', 'heap', 'Min Heap Operations', {
      operations: {
        type: 'array',
        label: 'Operations',
        description: 'List of operations: insert(value) or extractMin',
        default: [
          { type: 'insert', value: 10 },
          { type: 'insert', value: 5 },
          { type: 'insert', value: 20 },
          { type: 'insert', value: 3 },
          { type: 'insert', value: 8 },
          { type: 'extractMin' },
          { type: 'insert', value: 1 },
          { type: 'extractMin' }
        ]
      }
    });

    this.setDescription('Min Heap: Parent is always smaller than children. Insert bubbles up, ExtractMin bubbles down.');
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
        variables: { size: 0, type: 'Min Heap' }
      },
      { heap: [...heap], isMinHeap: true },
      'start',
      `Min Heap initialized. Property: parent ≤ children`
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
        while (currentIdx > 0 && heap[currentIdx] < heap[parent(currentIdx)]) {
          const parentIdx = parent(currentIdx);

          steps.push(this.createStep(
            stepNum++,
            {
              heap: [...heap],
              variables: {
                comparing: `${heap[currentIdx]} < ${heap[parentIdx]}`,
                current: currentIdx,
                parent: parentIdx
              }
            },
            { heap: [...heap], comparing: [currentIdx, parentIdx], bubbleUp: true },
            'compare',
            `Compare: ${heap[currentIdx]} < ${heap[parentIdx]}? Yes, swap needed (min heap property violated)`
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

        if (currentIdx === 0 || heap[currentIdx] >= heap[parent(currentIdx)]) {
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

      } else if (op.type === 'extractMin') {
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

        const minValue = heap[0];

        steps.push(this.createStep(
          stepNum++,
          {
            heap: [...heap],
            variables: { operation: 'extractMin', minValue }
          },
          { heap: [...heap], extracting: 0 },
          'extract_start',
          `Extract minimum value: ${minValue} (root)`
        ));

        // Move last element to root
        heap[0] = heap[heap.length - 1];
        heap.pop();

        if (heap.length === 0) {
          steps.push(this.createStep(
            stepNum++,
            {
              heap: [...heap],
              extractedValue: minValue,
              variables: { extracted: minValue, size: 0 }
            },
            { heap: [...heap], extracted: minValue },
            'extracted',
            `Extracted ${minValue}. Heap is now empty.`
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
          let smallest = currentIdx;
          const left = leftChild(currentIdx);
          const right = rightChild(currentIdx);

          if (left < heap.length && heap[left] < heap[smallest]) {
            smallest = left;
          }
          if (right < heap.length && heap[right] < heap[smallest]) {
            smallest = right;
          }

          if (smallest === currentIdx) {
            steps.push(this.createStep(
              stepNum++,
              {
                heap: [...heap],
                extractedValue: minValue,
                variables: { heapified: true, finalPosition: currentIdx }
              },
              { heap: [...heap], settled: currentIdx, extracted: minValue },
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
                smallestChild: heap[smallest],
                swapNeeded: true
              }
            },
            { heap: [...heap], comparing: [currentIdx, smallest], bubbleDown: true },
            'compare_children',
            `Compare with children: ${heap[smallest]} < ${heap[currentIdx]}, swap needed`
          ));

          swap(currentIdx, smallest);

          steps.push(this.createStep(
            stepNum++,
            {
              heap: [...heap],
              variables: { swapped: true, newPosition: smallest }
            },
            { heap: [...heap], swapped: [currentIdx, smallest] },
            'swap_down',
            `Swapped! Element moved down to index ${smallest}`
          ));

          currentIdx = smallest;
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
          min: heap.length > 0 ? heap[0] : 'N/A'
        }
      },
      { heap: [...heap], complete: true },
      'complete',
      `Complete! Min Heap: [${heap.join(', ')}]${heap.length > 0 ? `, Min: ${heap[0]}` : ''}`
    ));

    return this.buildIR(inputs, { heap: [] }, steps);
  }
}

// Register the generator
registry.register(new MinHeapGenerator());

export default MinHeapGenerator;
