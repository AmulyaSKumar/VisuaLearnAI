/**
 * Level Order Traversal Generator
 * Generates step-by-step visualization of level order (BFS) tree traversal
 * Visits nodes level by level from left to right
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class LevelOrderTraversalGenerator extends BaseGenerator {
  constructor() {
    super('levelorder_traversal', 'tree', 'Level Order Traversal', {
      tree: {
        type: 'tree',
        label: 'Binary Tree',
        description: 'Tree nodes with id, value, left, right',
        default: {
          nodes: [
            { id: '1', value: 1, left: '2', right: '3' },
            { id: '2', value: 2, left: '4', right: '5' },
            { id: '3', value: 3, left: '6', right: '7' },
            { id: '4', value: 4 },
            { id: '5', value: 5 },
            { id: '6', value: 6 },
            { id: '7', value: 7 }
          ]
        }
      }
    });

    this.setDescription('Visits nodes level by level using a queue (BFS). Also known as Breadth-First Traversal.');
    this.setComplexity('O(n)', 'O(w)'); // w = max width of tree
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
      queue: [],
      level: 0
    };

    steps.push(this.createStep(
      stepNum++,
      initialState,
      { current: null, visited: [], queue: [] },
      'start',
      'Starting Level Order Traversal (Breadth-First Search)'
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

    // Initialize queue with root
    const queue = [{ node: root, level: 0 }];

    steps.push(this.createStep(
      stepNum++,
      {
        tree: { nodes: [...nodes] },
        traversalOrder: [],
        current: root.id,
        queue: [root.id],
        level: 0
      },
      { current: root.id, queue: [root.id] },
      'init',
      `Initialize queue with root node (${root.value})`
    ));

    let currentLevel = 0;
    let levelNodes = [];

    while (queue.length > 0) {
      const { node: current, level } = queue.shift();

      // Check if we moved to a new level
      if (level > currentLevel) {
        if (levelNodes.length > 0) {
          steps.push(this.createStep(
            stepNum++,
            {
              tree: { nodes: [...nodes] },
              traversalOrder: [...traversalOrder],
              current: null,
              queue: queue.map(q => q.node.id),
              level: currentLevel
            },
            { visited: [...visited], levelComplete: levelNodes },
            'level_complete',
            `Level ${currentLevel} complete: [${levelNodes.join(', ')}]`
          ));
        }
        currentLevel = level;
        levelNodes = [];

        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            traversalOrder: [...traversalOrder],
            current: current.id,
            queue: queue.map(q => q.node.id),
            level: currentLevel
          },
          { current: current.id, visited: [...visited], newLevel: true },
          'new_level',
          `Starting Level ${currentLevel}`
        ));
      }

      // Visit current node
      visited.add(current.id);
      traversalOrder.push(current.value);
      levelNodes.push(current.value);

      steps.push(this.createStep(
        stepNum++,
        {
          tree: { nodes: [...nodes] },
          traversalOrder: [...traversalOrder],
          current: current.id,
          queue: queue.map(q => q.node.id),
          level: currentLevel
        },
        {
          current: current.id,
          visited: [...visited],
          queue: queue.map(q => q.node.id),
          justVisited: current.id
        },
        'visit',
        `Visit node ${current.value} at level ${currentLevel}`
      ));

      // Get children
      const leftNode = current.left ? nodeMap.get(current.left) : null;
      const rightNode = current.right ? nodeMap.get(current.right) : null;

      // Add left child to queue
      if (leftNode) {
        queue.push({ node: leftNode, level: level + 1 });

        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            traversalOrder: [...traversalOrder],
            current: current.id,
            queue: queue.map(q => q.node.id),
            level: currentLevel
          },
          {
            current: current.id,
            visited: [...visited],
            queue: queue.map(q => q.node.id),
            enqueued: leftNode.id
          },
          'enqueue_left',
          `Enqueue left child ${leftNode.value} (will be visited in level ${level + 1})`
        ));
      }

      // Add right child to queue
      if (rightNode) {
        queue.push({ node: rightNode, level: level + 1 });

        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            traversalOrder: [...traversalOrder],
            current: current.id,
            queue: queue.map(q => q.node.id),
            level: currentLevel
          },
          {
            current: current.id,
            visited: [...visited],
            queue: queue.map(q => q.node.id),
            enqueued: rightNode.id
          },
          'enqueue_right',
          `Enqueue right child ${rightNode.value} (will be visited in level ${level + 1})`
        ));
      }

      // Show when node processing is complete
      if (!leftNode && !rightNode) {
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            traversalOrder: [...traversalOrder],
            current: current.id,
            queue: queue.map(q => q.node.id),
            level: currentLevel
          },
          {
            current: current.id,
            visited: [...visited],
            queue: queue.map(q => q.node.id),
            isLeaf: true
          },
          'leaf',
          `Node ${current.value} is a leaf (no children to enqueue)`
        ));
      }
    }

    // Final level complete
    if (levelNodes.length > 0) {
      steps.push(this.createStep(
        stepNum++,
        {
          tree: { nodes: [...nodes] },
          traversalOrder: [...traversalOrder],
          current: null,
          queue: [],
          level: currentLevel
        },
        { visited: [...visited], levelComplete: levelNodes },
        'level_complete',
        `Level ${currentLevel} complete: [${levelNodes.join(', ')}]`
      ));
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        tree: { nodes: [...nodes] },
        traversalOrder: [...traversalOrder],
        current: null,
        queue: []
      },
      { visited: [...visited], complete: true },
      'complete',
      `Level Order traversal complete: ${traversalOrder.join(' → ')}`
    ));

    return this.buildIR(inputs, initialState, steps);
  }
}

// Register the generator
registry.register(new LevelOrderTraversalGenerator());

export default LevelOrderTraversalGenerator;
