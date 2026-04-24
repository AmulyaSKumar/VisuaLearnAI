/**
 * Dijkstra's Algorithm Generator
 * Generates step-by-step visualization of shortest path finding
 */
import { BaseGenerator } from '../base-generator.js';
import { registry } from '../../registry.js';

class DijkstraGenerator extends BaseGenerator {
  constructor() {
    super('dijkstra', 'graph', "Dijkstra's Shortest Path", {
      graph: {
        type: 'graph',
        label: 'Weighted Graph',
        description: 'Graph with weighted edges',
        default: {
          nodes: ['A', 'B', 'C', 'D', 'E'],
          edges: [
            ['A', 'B', 4],
            ['A', 'C', 2],
            ['B', 'C', 1],
            ['B', 'D', 5],
            ['C', 'D', 8],
            ['C', 'E', 10],
            ['D', 'E', 2]
          ]
        }
      },
      startNode: {
        type: 'string',
        label: 'Start Node',
        description: 'Source node for shortest paths',
        default: 'A'
      },
      endNode: {
        type: 'string',
        label: 'End Node (optional)',
        description: 'Target node (leave empty for all nodes)',
        default: 'E'
      }
    });

    this.setDescription('Finds shortest paths from source to all other nodes using a greedy approach with a priority queue.');
    this.setComplexity('O((V + E) log V)', 'O(V)');
  }

  doGenerate(inputs) {
    const { graph, startNode, endNode } = inputs;
    const { nodes, edges } = graph;

    // Build adjacency list with weights
    const adjList = new Map();
    for (const node of nodes) {
      adjList.set(node, []);
    }
    for (const edge of edges) {
      const [from, to, weight = 1] = edge;
      adjList.get(from)?.push({ node: to, weight });
      adjList.get(to)?.push({ node: from, weight }); // Undirected
    }

    const steps = [];
    let stepNum = 1;

    // Initialize distances
    const distances = new Map();
    const previous = new Map();
    const visited = new Set();
    const unvisited = new Set(nodes);

    for (const node of nodes) {
      distances.set(node, node === startNode ? 0 : Infinity);
      previous.set(node, null);
    }

    // Helper to get distances object for state
    const getDistancesObj = () => {
      const obj = {};
      for (const [k, v] of distances) {
        obj[k] = v === Infinity ? '∞' : v;
      }
      return obj;
    };

    // Initial state
    const initialState = {
      graph: { nodes: [...nodes], edges: [...edges] },
      distances: getDistancesObj(),
      visited: [],
      current: null,
      previous: Object.fromEntries(previous)
    };

    steps.push(this.createStep(
      stepNum++,
      initialState,
      { current: null, visited: [] },
      'start',
      `Initialize distances: ${startNode}=0, all others=∞`
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

    // Main Dijkstra loop
    while (unvisited.size > 0) {
      // Find unvisited node with minimum distance
      let current = null;
      let minDist = Infinity;

      for (const node of unvisited) {
        const dist = distances.get(node);
        if (dist < minDist) {
          minDist = dist;
          current = node;
        }
      }

      // No reachable nodes left
      if (current === null || minDist === Infinity) {
        break;
      }

      // Visit current node
      unvisited.delete(current);
      visited.add(current);

      steps.push(this.createStep(
        stepNum++,
        {
          graph: { nodes: [...nodes], edges: [...edges] },
          distances: getDistancesObj(),
          visited: [...visited],
          current,
          previous: Object.fromEntries(previous)
        },
        {
          current,
          visited: [...visited],
          minDistance: minDist
        },
        'visit',
        `Select ${current} with distance ${minDist} (smallest unvisited)`
      ));

      // If we reached the target, we can stop
      if (endNode && current === endNode) {
        // Build path
        const path = [];
        let node = endNode;
        while (node) {
          path.unshift(node);
          node = previous.get(node);
        }

        steps.push(this.createStep(
          stepNum++,
          {
            graph: { nodes: [...nodes], edges: [...edges] },
            distances: getDistancesObj(),
            visited: [...visited],
            current,
            previous: Object.fromEntries(previous),
            shortestPath: path
          },
          {
            current,
            visited: [...visited],
            path,
            complete: true
          },
          'found',
          `Found shortest path to ${endNode}: ${path.join(' → ')} (distance: ${distances.get(endNode)})`
        ));
        return this.buildIR(inputs, initialState, steps);
      }

      // Update distances to neighbors
      const neighbors = adjList.get(current) || [];

      for (const { node: neighbor, weight } of neighbors) {
        if (visited.has(neighbor)) continue;

        const newDist = distances.get(current) + weight;
        const oldDist = distances.get(neighbor);

        if (newDist < oldDist) {
          distances.set(neighbor, newDist);
          previous.set(neighbor, current);

          steps.push(this.createStep(
            stepNum++,
            {
              graph: { nodes: [...nodes], edges: [...edges] },
              distances: getDistancesObj(),
              visited: [...visited],
              current,
              previous: Object.fromEntries(previous)
            },
            {
              current,
              visited: [...visited],
              updating: neighbor,
              edge: [current, neighbor],
              oldDistance: oldDist === Infinity ? '∞' : oldDist,
              newDistance: newDist
            },
            'relax',
            `Update ${neighbor}: ${oldDist === Infinity ? '∞' : oldDist} → ${newDist} (via ${current}, edge weight ${weight})`
          ));
        } else {
          steps.push(this.createStep(
            stepNum++,
            {
              graph: { nodes: [...nodes], edges: [...edges] },
              distances: getDistancesObj(),
              visited: [...visited],
              current,
              previous: Object.fromEntries(previous)
            },
            {
              current,
              visited: [...visited],
              checking: neighbor,
              edge: [current, neighbor],
              noImprovement: true
            },
            'check',
            `Check ${neighbor}: ${newDist} ≥ ${oldDist === Infinity ? '∞' : oldDist}, no improvement`
          ));
        }
      }
    }

    // Build final paths for display
    const shortestPaths = {};
    for (const node of nodes) {
      if (node === startNode) continue;
      const path = [];
      let curr = node;
      while (curr) {
        path.unshift(curr);
        curr = previous.get(curr);
      }
      if (path[0] === startNode) {
        shortestPaths[node] = { path, distance: distances.get(node) };
      }
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        graph: { nodes: [...nodes], edges: [...edges] },
        distances: getDistancesObj(),
        visited: [...visited],
        current: null,
        previous: Object.fromEntries(previous),
        shortestPaths
      },
      { visited: [...visited], complete: true },
      'complete',
      `Dijkstra complete! Shortest distances from ${startNode}: ${[...distances].map(([k, v]) => `${k}=${v === Infinity ? '∞' : v}`).join(', ')}`
    ));

    return this.buildIR(inputs, initialState, steps);
  }
}

// Register the generator
registry.register(new DijkstraGenerator());

export default DijkstraGenerator;
