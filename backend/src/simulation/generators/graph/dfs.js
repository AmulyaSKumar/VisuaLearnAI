/**
 * DFS (Depth-First Search) Generator
 * Generates step-by-step visualization of DFS traversal on a graph
 */
import { BaseGenerator } from '../base-generator.js';
import { registry } from '../../registry.js';

class DFSGenerator extends BaseGenerator {
  constructor() {
    super('dfs', 'graph', 'Depth-First Search', {
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
        description: 'Node to start DFS from',
        default: 'A'
      }
    });

    this.setDescription('Explores as far as possible along each branch before backtracking. Uses a stack (or recursion).');
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
    const stack = [];
    const traversalOrder = [];

    // Initial state
    const initialState = {
      graph: { nodes: [...nodes], edges: [...edges] },
      stack: [],
      visited: [],
      traversalOrder: [],
      current: null
    };

    steps.push(this.createStep(
      stepNum++,
      initialState,
      { current: null, visited: [], stack: [] },
      'start',
      `Starting DFS from node ${startNode}`
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

    // Initialize DFS with stack
    stack.push(startNode);

    steps.push(this.createStep(
      stepNum++,
      {
        graph: { nodes: [...nodes], edges: [...edges] },
        stack: [...stack],
        visited: [...visited],
        traversalOrder: [...traversalOrder],
        current: null
      },
      { stack: [...stack] },
      'push',
      `Push start node ${startNode} onto stack`
    ));

    // DFS loop
    while (stack.length > 0) {
      const current = stack.pop();

      // Skip if already visited (can happen with cycles)
      if (visited.has(current)) {
        steps.push(this.createStep(
          stepNum++,
          {
            graph: { nodes: [...nodes], edges: [...edges] },
            stack: [...stack],
            visited: [...visited],
            traversalOrder: [...traversalOrder],
            current: null
          },
          { stack: [...stack], skipped: current, visited: [...visited] },
          'skip',
          `Pop ${current} - already visited, skip`
        ));
        continue;
      }

      visited.add(current);
      traversalOrder.push(current);

      steps.push(this.createStep(
        stepNum++,
        {
          graph: { nodes: [...nodes], edges: [...edges] },
          stack: [...stack],
          visited: [...visited],
          traversalOrder: [...traversalOrder],
          current
        },
        { current, visited: [...visited], stack: [...stack], path: [...traversalOrder] },
        'pop',
        `Pop ${current} - mark visited and process`
      ));

      // Get neighbors (reverse to maintain expected order)
      const neighbors = (adjList.get(current) || []).slice().reverse();

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);

          steps.push(this.createStep(
            stepNum++,
            {
              graph: { nodes: [...nodes], edges: [...edges] },
              stack: [...stack],
              visited: [...visited],
              traversalOrder: [...traversalOrder],
              current
            },
            {
              current,
              visited: [...visited],
              stack: [...stack],
              exploring: neighbor,
              edge: [current, neighbor]
            },
            'push',
            `Push unvisited neighbor ${neighbor} onto stack`
          ));
        }
      }
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        graph: { nodes: [...nodes], edges: [...edges] },
        stack: [],
        visited: [...visited],
        traversalOrder: [...traversalOrder],
        current: null
      },
      { visited: [...visited], path: [...traversalOrder], complete: true },
      'complete',
      `DFS complete! Traversal order: ${traversalOrder.join(' → ')}`
    ));

    return this.buildIR(inputs, initialState, steps);
  }
}

// Register the generator
registry.register(new DFSGenerator());

export default DFSGenerator;
