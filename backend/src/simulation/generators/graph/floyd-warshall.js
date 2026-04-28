/**
 * Floyd-Warshall Algorithm Generator
 * Generates step-by-step visualization of all-pairs shortest paths
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class FloydWarshallGenerator extends BaseGenerator {
  constructor() {
    super('floyd_warshall', 'graph', 'Floyd-Warshall Algorithm', {
      graph: {
        type: 'graph',
        label: 'Graph',
        description: 'Weighted directed graph',
        default: {
          nodes: ['A', 'B', 'C', 'D'],
          edges: [
            { from: 'A', to: 'B', weight: 3 },
            { from: 'A', to: 'C', weight: 6 },
            { from: 'B', to: 'C', weight: 2 },
            { from: 'B', to: 'D', weight: 4 },
            { from: 'C', to: 'D', weight: 1 },
            { from: 'D', to: 'A', weight: 2 }
          ]
        }
      }
    });

    this.setDescription('Find shortest paths between all pairs of vertices using dynamic programming.');
    this.setComplexity('O(V³)', 'O(V²)');
  }

  doGenerate(inputs) {
    const { graph } = inputs;
    const { nodes, edges } = graph;
    const n = nodes.length;
    const steps = [];
    let stepNum = 1;

    // Create node index mapping
    const nodeIndex = {};
    nodes.forEach((node, i) => {
      nodeIndex[node] = i;
    });

    // Initialize distance matrix
    const dist = Array(n).fill(null).map(() => Array(n).fill(Infinity));
    const next = Array(n).fill(null).map(() => Array(n).fill(null));

    // Set diagonal to 0
    for (let i = 0; i < n; i++) {
      dist[i][i] = 0;
    }

    // Set direct edges
    for (const edge of edges) {
      const i = nodeIndex[edge.from];
      const j = nodeIndex[edge.to];
      dist[i][j] = edge.weight;
      next[i][j] = j;
    }

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        graph,
        matrix: dist.map(row => [...row]),
        nodes,
        variables: { phase: 'initialization', vertices: n }
      },
      { matrix: dist.map(row => [...row]), nodes },
      'start',
      `Floyd-Warshall: Find all-pairs shortest paths for ${n} vertices`
    ));

    steps.push(this.createStep(
      stepNum++,
      {
        graph,
        matrix: dist.map(row => [...row]),
        nodes,
        variables: { phase: 'Initial matrix from direct edges' }
      },
      { matrix: dist.map(row => [...row]), nodes, initialized: true },
      'init_matrix',
      `Initial distance matrix created from direct edges`
    ));

    // Main algorithm: consider each vertex as intermediate
    for (let k = 0; k < n; k++) {
      const intermediateNode = nodes[k];

      steps.push(this.createStep(
        stepNum++,
        {
          graph,
          matrix: dist.map(row => [...row]),
          nodes,
          variables: { k: k + 1, intermediate: intermediateNode }
        },
        {
          matrix: dist.map(row => [...row]),
          nodes,
          intermediate: k
        },
        'intermediate_start',
        `Using ${intermediateNode} as intermediate vertex (k=${k + 1}/${n})`
      ));

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i !== j && i !== k && j !== k) {
            const throughK = dist[i][k] + dist[k][j];
            const direct = dist[i][j];

            if (dist[i][k] !== Infinity && dist[k][j] !== Infinity && throughK < direct) {
              steps.push(this.createStep(
                stepNum++,
                {
                  graph,
                  matrix: dist.map(row => [...row]),
                  nodes,
                  variables: {
                    from: nodes[i],
                    to: nodes[j],
                    via: intermediateNode,
                    oldDist: direct === Infinity ? '∞' : direct,
                    newDist: throughK,
                    calculation: `${dist[i][k]} + ${dist[k][j]} = ${throughK}`
                  }
                },
                {
                  matrix: dist.map(row => [...row]),
                  nodes,
                  updating: { i, j, k },
                  path: [i, k, j]
                },
                'update',
                `${nodes[i]}→${nodes[j]}: ${direct === Infinity ? '∞' : direct} > ${throughK} via ${intermediateNode}. Update!`
              ));

              dist[i][j] = throughK;
              next[i][j] = next[i][k];

              steps.push(this.createStep(
                stepNum++,
                {
                  graph,
                  matrix: dist.map(row => [...row]),
                  nodes,
                  variables: {
                    updated: `dist[${nodes[i]}][${nodes[j]}] = ${throughK}`
                  }
                },
                {
                  matrix: dist.map(row => [...row]),
                  nodes,
                  updated: { i, j }
                },
                'updated',
                `Updated dist[${nodes[i]}][${nodes[j]}] = ${throughK}`
              ));
            }
          }
        }
      }
    }

    // Check for negative cycles (negative diagonal)
    let hasNegativeCycle = false;
    for (let i = 0; i < n; i++) {
      if (dist[i][i] < 0) {
        hasNegativeCycle = true;
        break;
      }
    }

    if (hasNegativeCycle) {
      steps.push(this.createStep(
        stepNum++,
        {
          graph,
          matrix: dist.map(row => [...row]),
          nodes,
          variables: { negativeCycle: true }
        },
        { matrix: dist.map(row => [...row]), nodes, negativeCycle: true },
        'negative_cycle',
        `Warning: Negative cycle detected! (negative diagonal value)`
      ));
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        graph,
        matrix: dist.map(row => [...row]),
        next: next.map(row => [...row]),
        nodes,
        variables: {
          complete: true,
          hasNegativeCycle
        }
      },
      {
        matrix: dist.map(row => [...row]),
        nodes,
        complete: true
      },
      'complete',
      `Complete! All-pairs shortest paths computed.`
    ));

    return this.buildIR(inputs, { graph, matrix: [], nodes }, steps);
  }
}

// Register the generator
registry.register(new FloydWarshallGenerator());

export default FloydWarshallGenerator;
