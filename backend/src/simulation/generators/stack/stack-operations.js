/**
 * Stack Operations Generator
 * Generates step-by-step visualization of stack push/pop operations
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class StackOperationsGenerator extends BaseGenerator {
  constructor() {
    super('stack_operations', 'stack', 'Stack Operations', {
      operations: {
        type: 'array',
        label: 'Operations',
        description: 'List of operations: push(value) or pop',
        default: [
          { type: 'push', value: 10 },
          { type: 'push', value: 20 },
          { type: 'push', value: 30 },
          { type: 'pop' },
          { type: 'push', value: 40 },
          { type: 'pop' },
          { type: 'pop' }
        ]
      },
      maxSize: {
        type: 'number',
        label: 'Max Stack Size',
        description: 'Maximum stack capacity',
        default: 8,
        validation: { min: 3, max: 15 }
      }
    });

    this.setDescription('LIFO (Last In First Out) data structure. Push adds to top, Pop removes from top.');
    this.setComplexity('O(1)', 'O(n)');
  }

  doGenerate(inputs) {
    const { operations, maxSize } = inputs;
    const steps = [];
    let stepNum = 1;

    const stack = [];
    const history = [];

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        stack: [...stack],
        maxSize,
        variables: { size: 0, maxSize, isEmpty: true, isFull: false }
      },
      { stack: [...stack] },
      'start',
      `Stack initialized with capacity ${maxSize}. LIFO: Last In, First Out.`
    ));

    // Process each operation
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];

      if (op.type === 'push') {
        // Show attempting push
        steps.push(this.createStep(
          stepNum++,
          {
            stack: [...stack],
            maxSize,
            pendingValue: op.value,
            variables: { operation: `push(${op.value})`, size: stack.length }
          },
          { stack: [...stack], pending: op.value },
          'push_attempt',
          `Push operation: Adding ${op.value} to stack`
        ));

        if (stack.length >= maxSize) {
          // Stack overflow
          steps.push(this.createStep(
            stepNum++,
            {
              stack: [...stack],
              maxSize,
              error: 'overflow',
              variables: { operation: 'push', error: 'Stack Overflow!', size: stack.length }
            },
            { stack: [...stack], overflow: true },
            'overflow',
            `Stack Overflow! Cannot push ${op.value} - stack is full (${stack.length}/${maxSize})`
          ));
          history.push({ op: 'push', value: op.value, success: false, reason: 'overflow' });
        } else {
          // Successful push
          stack.push(op.value);
          history.push({ op: 'push', value: op.value, success: true });

          steps.push(this.createStep(
            stepNum++,
            {
              stack: [...stack],
              maxSize,
              variables: {
                operation: 'push',
                pushed: op.value,
                size: stack.length,
                top: stack[stack.length - 1]
              }
            },
            { stack: [...stack], justPushed: stack.length - 1, top: stack.length - 1 },
            'push_complete',
            `Pushed ${op.value}. Stack size: ${stack.length}, Top: ${stack[stack.length - 1]}`
          ));
        }
      } else if (op.type === 'pop') {
        // Show attempting pop
        steps.push(this.createStep(
          stepNum++,
          {
            stack: [...stack],
            maxSize,
            variables: { operation: 'pop()', size: stack.length }
          },
          { stack: [...stack], poppingFrom: stack.length > 0 ? stack.length - 1 : null },
          'pop_attempt',
          `Pop operation: Removing element from top of stack`
        ));

        if (stack.length === 0) {
          // Stack underflow
          steps.push(this.createStep(
            stepNum++,
            {
              stack: [...stack],
              maxSize,
              error: 'underflow',
              variables: { operation: 'pop', error: 'Stack Underflow!', size: 0 }
            },
            { stack: [...stack], underflow: true },
            'underflow',
            `Stack Underflow! Cannot pop - stack is empty`
          ));
          history.push({ op: 'pop', success: false, reason: 'underflow' });
        } else {
          // Successful pop
          const poppedValue = stack.pop();
          history.push({ op: 'pop', value: poppedValue, success: true });

          steps.push(this.createStep(
            stepNum++,
            {
              stack: [...stack],
              maxSize,
              poppedValue,
              variables: {
                operation: 'pop',
                popped: poppedValue,
                size: stack.length,
                top: stack.length > 0 ? stack[stack.length - 1] : 'empty'
              }
            },
            {
              stack: [...stack],
              justPopped: poppedValue,
              top: stack.length > 0 ? stack.length - 1 : null
            },
            'pop_complete',
            `Popped ${poppedValue}. Stack size: ${stack.length}${stack.length > 0 ? `, Top: ${stack[stack.length - 1]}` : ' (empty)'}`
          ));
        }
      } else if (op.type === 'peek') {
        const topValue = stack.length > 0 ? stack[stack.length - 1] : null;
        steps.push(this.createStep(
          stepNum++,
          {
            stack: [...stack],
            maxSize,
            variables: {
              operation: 'peek',
              top: topValue !== null ? topValue : 'empty',
              size: stack.length
            }
          },
          { stack: [...stack], peeking: stack.length > 0 ? stack.length - 1 : null },
          'peek',
          topValue !== null ? `Peek: Top element is ${topValue}` : `Peek: Stack is empty`
        ));
        history.push({ op: 'peek', value: topValue, success: topValue !== null });
      }
    }

    // Final state
    const successOps = history.filter(h => h.success).length;
    const failedOps = history.filter(h => !h.success).length;

    steps.push(this.createStep(
      stepNum,
      {
        stack: [...stack],
        maxSize,
        history,
        variables: {
          finalSize: stack.length,
          totalOperations: history.length,
          successful: successOps,
          failed: failedOps,
          top: stack.length > 0 ? stack[stack.length - 1] : 'empty'
        }
      },
      { stack: [...stack], complete: true, top: stack.length > 0 ? stack.length - 1 : null },
      'complete',
      `Complete! Final stack size: ${stack.length}. Operations: ${successOps} successful, ${failedOps} failed.`
    ));

    return this.buildIR(inputs, { stack: [], maxSize }, steps);
  }
}

// Register the generator
registry.register(new StackOperationsGenerator());

export default StackOperationsGenerator;
