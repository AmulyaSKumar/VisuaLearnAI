/**
 * Postorder Traversal Generator
 * Generates step-by-step visualization of postorder tree traversal (Left-Right-Root)
 */
import { BaseGenerator } from '../base-generator.js';
import { registry } from '../../registry.js';

class PostorderTraversalGenerator extends BaseGenerator {
  constructor() {
    super('postorder_traversal', 'tree', 'Postorder Traversal', {
      tree: {
        type: 'tree',
        label: 'Binary Tree',
        description: 'Tree nodes with id, value, left, right',
        default: {
          nodes: [
            { id: '1', value: 4, left: '2', right: '3' },
            { id: '2', value: 2, left: '4', right: '5' },
            { id: '3', value: 6, left: '6', right: '7' },
            { id: '4', value: 1 },
            { id: '5', value: 3 },
            { id: '6', value: 5 },
            { id: '7', value: 7 }
          ]
        }
      }
    });

    this.setDescription('Visits nodes in Left-Right-Root order. Useful for deleting trees or evaluating expressions.');
    this.setComplexity('O(n)', 'O(h)');
  }

  doGenerate(inputs) {
    const { tree } = inputs;
    const nodes = tree.nodes || [];

    // Build node lookup map
    const nodeMap = new Map();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const steps = [];
    let stepNum = 1;

    const traversalOrder = [];
    const visited = new Set();

    // Initial state
    const initialState = {
      tree: { nodes: [...nodes] },
      traversalOrder: [],
      current: null,
      stack: []
    };

    steps.push(this.createStep(
      stepNum++,
      initialState,
      { current: null, visited: [] },
      'start',
      'Starting Postorder Traversal (Left → Right → Root)'
    ));

    // Find root node
    const root = nodeMap.get('1') || nodes[0];
    if (!root) {
      steps.push(this.createStep(
        stepNum++,
        { ...initialState, error: true },
        {},
        'error',
        'No root node found in tree'
      ));
      return this.buildIR(inputs, initialState, steps);
    }

    // Iterative postorder using two stacks approach
    const stack1 = [root];
    const stack2 = [];

    steps.push(this.createStep(
      stepNum++,
      {
        tree: { nodes: [...nodes] },
        traversalOrder: [...traversalOrder],
        current: null,
        stack: [root.id]
      },
      { stack: [root.id] },
      'init',
      `Push root node ${root.value} onto stack`
    ));

    // First pass: build reverse order in stack2
    while (stack1.length > 0) {
      const current = stack1.pop();
      stack2.push(current);

      steps.push(this.createStep(
        stepNum++,
        {
          tree: { nodes: [...nodes] },
          traversalOrder: [...traversalOrder],
          current: current.id,
          stack: stack1.map(n => n.id),
          processingStack: stack2.map(n => n.id)
        },
        {
          current: current.id,
          stack: stack1.map(n => n.id),
          processing: current.id
        },
        'process',
        `Pop ${current.value} and add to processing stack`
      ));

      // Push left child
      const leftNode = current.left ? nodeMap.get(current.left) : null;
      if (leftNode) {
        stack1.push(leftNode);
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            traversalOrder: [...traversalOrder],
            current: current.id,
            stack: stack1.map(n => n.id),
            processingStack: stack2.map(n => n.id)
          },
          {
            current: current.id,
            stack: stack1.map(n => n.id),
            pushing: leftNode.id
          },
          'push_left',
          `Push left child ${leftNode.value}`
        ));
      }

      // Push right child
      const rightNode = current.right ? nodeMap.get(current.right) : null;
      if (rightNode) {
        stack1.push(rightNode);
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            traversalOrder: [...traversalOrder],
            current: current.id,
            stack: stack1.map(n => n.id),
            processingStack: stack2.map(n => n.id)
          },
          {
            current: current.id,
            stack: stack1.map(n => n.id),
            pushing: rightNode.id
          },
          'push_right',
          `Push right child ${rightNode.value}`
        ));
      }
    }

    steps.push(this.createStep(
      stepNum++,
      {
        tree: { nodes: [...nodes] },
        traversalOrder: [...traversalOrder],
        current: null,
        stack: [],
        processingStack: stack2.map(n => n.id)
      },
      { processingStack: stack2.map(n => n.id) },
      'process_complete',
      'First pass complete. Now visiting nodes in postorder...'
    ));

    // Second pass: pop from stack2 to get postorder
    while (stack2.length > 0) {
      const current = stack2.pop();
      visited.add(current.id);
      traversalOrder.push(current.value);

      steps.push(this.createStep(
        stepNum++,
        {
          tree: { nodes: [...nodes] },
          traversalOrder: [...traversalOrder],
          current: current.id,
          stack: [],
          processingStack: stack2.map(n => n.id)
        },
        {
          current: current.id,
          visited: [...visited],
          justVisited: current.id
        },
        'visit',
        `Visit ${current.value} - add to traversal order`
      ));
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        tree: { nodes: [...nodes] },
        traversalOrder: [...traversalOrder],
        current: null,
        stack: []
      },
      { visited: [...visited], complete: true },
      'complete',
      `Postorder traversal complete: ${traversalOrder.join(' → ')}`
    ));

    return this.buildIR(inputs, initialState, steps);
  }
}

// Register the generator
registry.register(new PostorderTraversalGenerator());

export default PostorderTraversalGenerator;
