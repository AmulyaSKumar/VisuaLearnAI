/**
 * Bellman-Ford Algorithm Generator
 * Generates step-by-step visualization of Bellman-Ford shortest path algorithm
 * Handles negative edge weights and detects negative cycles
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class BellmanFordGenerator extends BaseGenerator {
  constructor() {
    super('bellman_ford', 'graph', 'Bellman-Ford Algorithm', {
      graph: {
        type: 'graph',
        label: 'Graph',
        description: 'Weighted directed graph (can have negative weights)',
        default: {
          nodes: ['A', 'B', 'C', 'D', 'E'],
          edges: [
            { from: 'A', to: 'B', weight: 4 },
            { from: 'A', to: 'C', weight: 2 },
            { from: 'B', to: 'C', weight: 3 },
            { from: 'B', to: 'D', weight: 2 },
            { from: 'B', to: 'E', weight: 3 },
            { from: 'C', to: 'B', weight: 1 },
            { from: 'C', to: 'D', weight: 4 },
            { from: 'C', to: 'E', weight: 5 },
            { from: 'E', to: 'D', weight: -5 }
          ]
        }
      },
      startNode: {
        type: 'string',
        label: 'Start Node',
        description: 'Source node for shortest paths',
        default: 'A'
      }
    });

    this.setDescription('Find shortest paths from source to all vertices. Handles negative weights and detects negative cycles.');
    this.setComplexity('O(V×E)', 'O(V)');
  }

  doGenerate(inputs) {
    const { graph, startNode } = inputs;
    const { nodes, edges } = graph;
    const steps = [];
    let stepNum = 1;

    // Initialize distances
    const dist = {};
    const prev = {};
    nodes.forEach(node => {
      dist[node] = node === startNode ? 0 : Infinity;
      prev[node] = null;
    });

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        graph,
        distances: { ...dist },
        predecessors: { ...prev },
        variables: { source: startNode, iterations: nodes.length - 1 }
      },
      { current: startNode, distances: { ...dist } },
      'start',
      `Bellman-Ford from ${startNode}. Will relax all edges ${nodes.length - 1} times.`
    ));

    // Relax all edges V-1 times
    for (let i = 1; i < nodes.length; i++) {
      let updated = false;

      steps.push(this.createStep(
        stepNum++,
        {
          graph,
          distances: { ...dist },
          predecessors: { ...prev },
          variables: { iteration: i, totalIterations: nodes.length - 1 }
        },
        { distances: { ...dist }, iteration: i },
        'iteration_start',
        `Iteration ${i}/${nodes.length - 1}: Relaxing all edges`
      ));

      for (const edge of edges) {
        const { from, to, weight } = edge;

        if (dist[from] !== Infinity) {
          const newDist = dist[from] + weight;

          steps.push(this.createStep(
            stepNum++,
            {
              graph,
              distances: { ...dist },
              predecessors: { ...prev },
              variables: {
                edge: `${from}→${to}`,
                weight,
                currentDist: dist[to] === Infinity ? '∞' : dist[to],
                newDist: newDist
              }
            },
            {
              edge: { from, to },
              checking: true,
              distances: { ...dist }
            },
            'check_edge',
            `Check edge ${from}→${to} (w=${weight}): ${dist[from]} + ${weight} = ${newDist} ${newDist < dist[to] ? '< ' + (dist[to] === Infinity ? '∞' : dist[to]) + ' ✓' : '>= ' + dist[to]}`
          ));

          if (newDist < dist[to]) {
            dist[to] = newDist;
            prev[to] = from;
            updated = true;

            steps.push(this.createStep(
              stepNum++,
              {
                graph,
                distances: { ...dist },
                predecessors: { ...prev },
                variables: {
                  updated: to,
                  newDistance: newDist,
                  via: from
                }
              },
              {
                updated: to,
                edge: { from, to },
                distances: { ...dist }
              },
              'relax',
              `Relaxed! dist[${to}] = ${newDist} via ${from}`
            ));
          }
        }
      }

      if (!updated) {
        steps.push(this.createStep(
          stepNum++,
          {
            graph,
            distances: { ...dist },
            predecessors: { ...prev },
            variables: { earlyTermination: true, iteration: i }
          },
          { distances: { ...dist }, converged: true },
          'early_termination',
          `No updates in iteration ${i}. Algorithm converged early!`
        ));
        break;
      }
    }

    // Check for negative cycles
    let hasNegativeCycle = false;
    let negativeCycleEdge = null;

    steps.push(this.createStep(
      stepNum++,
      {
        graph,
        distances: { ...dist },
        predecessors: { ...prev },
        variables: { phase: 'Checking for negative cycles' }
      },
      { distances: { ...dist }, checkingCycles: true },
      'check_cycles_start',
      `Checking for negative cycles (one more pass through all edges)`
    ));

    for (const edge of edges) {
      const { from, to, weight } = edge;
      if (dist[from] !== Infinity && dist[from] + weight < dist[to]) {
        hasNegativeCycle = true;
        negativeCycleEdge = edge;

        steps.push(this.createStep(
          stepNum++,
          {
            graph,
            distances: { ...dist },
            predecessors: { ...prev },
            variables: {
              negativeCycle: true,
              edge: `${from}→${to}`,
              proof: `${dist[from]} + ${weight} < ${dist[to]}`
            }
          },
          {
            negativeCycle: true,
            cycleEdge: { from, to },
            distances: { ...dist }
          },
          'negative_cycle',
          `Negative cycle detected! Edge ${from}→${to} can still be relaxed.`
        ));
        break;
      }
    }

    if (!hasNegativeCycle) {
      steps.push(this.createStep(
        stepNum++,
        {
          graph,
          distances: { ...dist },
          predecessors: { ...prev },
          variables: { negativeCycle: false }
        },
        { distances: { ...dist }, noCycle: true },
        'no_cycle',
        `No negative cycles found. Shortest paths are valid.`
      ));
    }

    // Final state
    const pathsStr = nodes
      .filter(n => n !== startNode)
      .map(n => `${n}: ${dist[n] === Infinity ? '∞' : dist[n]}`)
      .join(', ');

    steps.push(this.createStep(
      stepNum,
      {
        graph,
        distances: { ...dist },
        predecessors: { ...prev },
        variables: {
          complete: true,
          hasNegativeCycle,
          shortestPaths: pathsStr
        }
      },
      {
        distances: { ...dist },
        predecessors: { ...prev },
        complete: true,
        hasNegativeCycle
      },
      'complete',
      hasNegativeCycle
        ? `Complete with negative cycle detected! Shortest paths may be undefined.`
        : `Complete! Shortest distances from ${startNode}: ${pathsStr}`
    ));

    return this.buildIR(inputs, { graph, distances: {}, predecessors: {} }, steps);
  }
}

// Register the generator
registry.register(new BellmanFordGenerator());

export default BellmanFordGenerator;
