/**
 * BFS (Breadth-First Search) Generator
 * Generates step-by-step visualization of BFS traversal on a graph
 */
import { BaseGenerator } from '../base-generator.js';
import { registry } from '../../registry.js';

class BFSGenerator extends BaseGenerator {
  constructor() {
    super('bfs', 'graph', 'Breadth-First Search', {
      graph: {
        type: 'graph',
        label: 'Graph',
        description: 'Graph with nodes and edges',
        default: {
          nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
          edges: [
            ['A', 'B'],
            ['A', 'C'],
            ['B', 'D'],
            ['B', 'E'],
            ['C', 'F'],
            ['E', 'F']
          ]
        }
      },
      startNode: {
        type: 'string',
        label: 'Start Node',
        description: 'Node to start BFS from',
        default: 'A'
      }
    });

    this.setDescription('Explores graph level by level using a queue. Visits all neighbors before moving deeper.');
    this.setComplexity('O(V + E)', 'O(V)');
  }

  doGenerate(inputs) {
    const { graph, startNode } = inputs;
    const { nodes, edges } = graph;

    // Build adjacency list
    const adjList = new Map();
    for (const node of nodes) {
      adjList.set(node, []);
    }
    for (const [from, to] of edges) {
      adjList.get(from)?.push(to);
      adjList.get(to)?.push(from); // Undirected graph
    }

    const steps = [];
    let stepNum = 1;

    const visited = new Set();
    const queue = [];
    const traversalOrder = [];

    // Initial state
    const initialState = {
      graph: { nodes: [...nodes], edges: [...edges] },
      queue: [],
      visited: [],
      traversalOrder: [],
      current: null
    };

    steps.push(this.createStep(
      stepNum++,
      initialState,
      { current: null, visited: [], queue: [] },
      'start',
      `Starting BFS from node ${startNode}`
    ));

    // Validate start node exists
    if (!nodes.includes(startNode)) {
      steps.push(this.createStep(
        stepNum++,
        { ...initialState, error: true },
        {},
        'error',
        `Start node "${startNode}" not found in graph`
      ));
      return this.buildIR(inputs, initialState, steps);
    }

    // Initialize BFS
    queue.push(startNode);
    visited.add(startNode);

    steps.push(this.createStep(
      stepNum++,
      {
        graph: { nodes: [...nodes], edges: [...edges] },
        queue: [...queue],
        visited: [...visited],
        traversalOrder: [...traversalOrder],
        current: null
      },
      { queue: [startNode], visited: [startNode] },
      'enqueue',
      `Enqueue start node ${startNode} and mark as visited`
    ));

    // BFS loop
    while (queue.length > 0) {
      const current = queue.shift();
      traversalOrder.push(current);

      steps.push(this.createStep(
        stepNum++,
        {
          graph: { nodes: [...nodes], edges: [...edges] },
          queue: [...queue],
          visited: [...visited],
          traversalOrder: [...traversalOrder],
          current
        },
        { current, visited: [...visited], queue: [...queue], path: [...traversalOrder] },
        'dequeue',
        `Dequeue ${current} - now processing`
      ));

      // Get neighbors
      const neighbors = adjList.get(current) || [];

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);

          steps.push(this.createStep(
            stepNum++,
            {
              graph: { nodes: [...nodes], edges: [...edges] },
              queue: [...queue],
              visited: [...visited],
              traversalOrder: [...traversalOrder],
              current
            },
            {
              current,
              visited: [...visited],
              queue: [...queue],
              exploring: neighbor,
              edge: [current, neighbor]
            },
            'enqueue',
            `Found unvisited neighbor ${neighbor} - enqueue and mark visited`
          ));
        } else {
          steps.push(this.createStep(
            stepNum++,
            {
              graph: { nodes: [...nodes], edges: [...edges] },
              queue: [...queue],
              visited: [...visited],
              traversalOrder: [...traversalOrder],
              current
            },
            {
              current,
              visited: [...visited],
              skipped: neighbor,
              edge: [current, neighbor]
            },
            'skip',
            `Neighbor ${neighbor} already visited - skip`
          ));
        }
      }
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        graph: { nodes: [...nodes], edges: [...edges] },
        queue: [],
        visited: [...visited],
        traversalOrder: [...traversalOrder],
        current: null
      },
      { visited: [...visited], path: [...traversalOrder], complete: true },
      'complete',
      `BFS complete! Traversal order: ${traversalOrder.join(' → ')}`
    ));

    return this.buildIR(inputs, initialState, steps);
  }
}

// Register the generator
registry.register(new BFSGenerator());

export default BFSGenerator;
