/**
 * Preorder Traversal Generator
 * Generates step-by-step visualization of preorder tree traversal (Root-Left-Right)
 */
import { BaseGenerator } from '../base-generator.js';
import { registry } from '../../registry.js';

class PreorderTraversalGenerator extends BaseGenerator {
  constructor() {
    super('preorder_traversal', 'tree', 'Preorder Traversal', {
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

    this.setDescription('Visits nodes in Root-Left-Right order. Useful for copying/serializing trees.');
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
      'Starting Preorder Traversal (Root → Left → Right)'
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

    // Iterative preorder traversal using stack
    const stack = [root];

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

    while (stack.length > 0) {
      // Pop and visit current node
      const current = stack.pop();
      visited.add(current.id);
      traversalOrder.push(current.value);

      steps.push(this.createStep(
        stepNum++,
        {
          tree: { nodes: [...nodes] },
          traversalOrder: [...traversalOrder],
          current: current.id,
          stack: stack.map(n => n.id)
        },
        {
          current: current.id,
          visited: [...visited],
          stack: stack.map(n => n.id),
          justVisited: current.id
        },
        'visit',
        `Pop and visit ${current.value} - add to traversal order`
      ));

      // Push right child first (so left is processed first)
      const rightNode = current.right ? nodeMap.get(current.right) : null;
      const leftNode = current.left ? nodeMap.get(current.left) : null;

      if (rightNode) {
        stack.push(rightNode);
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            traversalOrder: [...traversalOrder],
            current: current.id,
            stack: stack.map(n => n.id)
          },
          {
            current: current.id,
            visited: [...visited],
            stack: stack.map(n => n.id),
            pushing: rightNode.id
          },
          'push_right',
          `Push right child ${rightNode.value} onto stack`
        ));
      }

      if (leftNode) {
        stack.push(leftNode);
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            traversalOrder: [...traversalOrder],
            current: current.id,
            stack: stack.map(n => n.id)
          },
          {
            current: current.id,
            visited: [...visited],
            stack: stack.map(n => n.id),
            pushing: leftNode.id
          },
          'push_left',
          `Push left child ${leftNode.value} onto stack`
        ));
      }
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
      `Preorder traversal complete: ${traversalOrder.join(' → ')}`
    ));

    return this.buildIR(inputs, initialState, steps);
  }
}

// Register the generator
registry.register(new PreorderTraversalGenerator());

export default PreorderTraversalGenerator;
