/**
 * Inorder Traversal Generator
 * Generates step-by-step visualization of inorder tree traversal (Left-Root-Right)
 */
import { BaseGenerator } from '../base-generator.js';
import { registry } from '../../registry.js';

class InorderTraversalGenerator extends BaseGenerator {
  constructor() {
    super('inorder_traversal', 'tree', 'Inorder Traversal', {
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

    this.setDescription('Visits nodes in Left-Root-Right order. For BST, produces sorted output.');
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
      'Starting Inorder Traversal (Left → Root → Right)'
    ));

    // Find root node (id '1' or first node)
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

    // Iterative inorder traversal using stack
    const stack = [];
    let current = root;

    steps.push(this.createStep(
      stepNum++,
      {
        tree: { nodes: [...nodes] },
        traversalOrder: [...traversalOrder],
        current: root.id,
        stack: []
      },
      { current: root.id, visited: [] },
      'init',
      `Start at root node ${root.value}`
    ));

    while (current || stack.length > 0) {
      // Go to the leftmost node
      while (current) {
        stack.push(current);

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
            stack: stack.map(n => n.id)
          },
          'push',
          `Push ${current.value} onto stack, go left`
        ));

        const leftId = current.left;
        current = leftId ? nodeMap.get(leftId) : null;
      }

      // Pop from stack and visit
      current = stack.pop();
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
        `Visit ${current.value} - add to traversal order`
      ));

      // Move to right subtree
      const rightId = current.right;
      const rightNode = rightId ? nodeMap.get(rightId) : null;

      if (rightNode) {
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            traversalOrder: [...traversalOrder],
            current: rightNode.id,
            stack: stack.map(n => n.id)
          },
          {
            current: rightNode.id,
            visited: [...visited],
            stack: stack.map(n => n.id),
            movingTo: 'right'
          },
          'right',
          `Move to right child ${rightNode.value}`
        ));
      }

      current = rightNode;
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
      `Inorder traversal complete: ${traversalOrder.join(' → ')}`
    ));

    return this.buildIR(inputs, initialState, steps);
  }
}

// Register the generator
registry.register(new InorderTraversalGenerator());

export default InorderTraversalGenerator;
