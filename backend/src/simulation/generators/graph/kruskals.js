/**
 * Kruskal's Algorithm Generator
 * Generates step-by-step visualization of Kruskal's MST algorithm
 * Uses Union-Find data structure
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class KruskalsGenerator extends BaseGenerator {
  constructor() {
    super('kruskals', 'graph', "Kruskal's Algorithm (MST)", {
      graph: {
        type: 'graph',
        label: 'Graph',
        description: 'Weighted undirected graph',
        default: {
          nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
          edges: [
            { from: 'A', to: 'B', weight: 4 },
            { from: 'A', to: 'C', weight: 2 },
            { from: 'B', to: 'C', weight: 1 },
            { from: 'B', to: 'D', weight: 5 },
            { from: 'C', to: 'D', weight: 8 },
            { from: 'C', to: 'E', weight: 10 },
            { from: 'D', to: 'E', weight: 2 },
            { from: 'D', to: 'F', weight: 6 },
            { from: 'E', to: 'F', weight: 3 }
          ]
        }
      }
    });

    this.setDescription("Build Minimum Spanning Tree by sorting edges and adding smallest that doesn't create a cycle.");
    this.setComplexity('O(E log E)', 'O(V)');
  }

  doGenerate(inputs) {
    const { graph } = inputs;
    const { nodes, edges } = graph;
    const steps = [];
    let stepNum = 1;

    // Union-Find data structure
    const parent = {};
    const rank = {};

    const makeSet = (x) => {
      parent[x] = x;
      rank[x] = 0;
    };

    const find = (x) => {
      if (parent[x] !== x) {
        parent[x] = find(parent[x]); // Path compression
      }
      return parent[x];
    };

    const union = (x, y) => {
      const rootX = find(x);
      const rootY = find(y);

      if (rootX === rootY) return false;

      // Union by rank
      if (rank[rootX] < rank[rootY]) {
        parent[rootX] = rootY;
      } else if (rank[rootX] > rank[rootY]) {
        parent[rootY] = rootX;
      } else {
        parent[rootY] = rootX;
        rank[rootX]++;
      }
      return true;
    };

    // Initialize Union-Find
    nodes.forEach(node => makeSet(node));

    // Sort edges by weight
    const sortedEdges = [...edges].sort((a, b) => a.weight - b.weight);
    const mstEdges = [];
    let totalWeight = 0;

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        graph,
        sortedEdges: sortedEdges.map(e => ({ ...e })),
        mstEdges: [],
        sets: nodes.map(n => ({ node: n, parent: parent[n] })),
        variables: { totalEdges: edges.length, vertices: nodes.length }
      },
      { graph, mstEdges: [] },
      'start',
      `Kruskal's Algorithm: Build MST using Union-Find`
    ));

    // Show sorted edges
    steps.push(this.createStep(
      stepNum++,
      {
        graph,
        sortedEdges: sortedEdges.map(e => ({ ...e })),
        mstEdges: [],
        variables: { sorted: sortedEdges.map(e => `${e.from}-${e.to}(${e.weight})`).join(', ') }
      },
      { graph, sortedEdges: sortedEdges.map(e => ({ ...e })) },
      'sort',
      `Edges sorted by weight: ${sortedEdges.map(e => `${e.from}-${e.to}(${e.weight})`).join(', ')}`
    ));

    // Process each edge
    let edgeIndex = 0;
    for (const edge of sortedEdges) {
      edgeIndex++;
      const { from, to, weight } = edge;

      // Check if they're in different sets
      const rootFrom = find(from);
      const rootTo = find(to);

      steps.push(this.createStep(
        stepNum++,
        {
          graph,
          sortedEdges: sortedEdges.map(e => ({ ...e })),
          mstEdges: [...mstEdges],
          currentEdge: edge,
          sets: nodes.map(n => ({ node: n, root: find(n) })),
          variables: {
            checking: `${from}-${to}`,
            weight,
            setOf_from: rootFrom,
            setOf_to: rootTo,
            sameSet: rootFrom === rootTo
          }
        },
        {
          graph,
          mstEdges: [...mstEdges],
          checking: { from, to, weight },
          sets: { [from]: rootFrom, [to]: rootTo }
        },
        'check_edge',
        `Edge ${edgeIndex}/${sortedEdges.length}: ${from}-${to} (w=${weight}). Sets: ${from}∈{${rootFrom}}, ${to}∈{${rootTo}}`
      ));

      if (rootFrom !== rootTo) {
        // Different sets - add to MST
        union(from, to);
        mstEdges.push(edge);
        totalWeight += weight;

        steps.push(this.createStep(
          stepNum++,
          {
            graph,
            sortedEdges: sortedEdges.map(e => ({ ...e })),
            mstEdges: [...mstEdges],
            sets: nodes.map(n => ({ node: n, root: find(n) })),
            variables: {
              action: 'ADD',
              edge: `${from}-${to}`,
              totalWeight,
              mstSize: mstEdges.length
            }
          },
          {
            graph,
            mstEdges: [...mstEdges],
            added: { from, to, weight },
            merged: [rootFrom, rootTo]
          },
          'add_edge',
          `✓ Added ${from}-${to} to MST. Merged sets. Total weight: ${totalWeight}`
        ));

        // Check if MST is complete
        if (mstEdges.length === nodes.length - 1) {
          steps.push(this.createStep(
            stepNum++,
            {
              graph,
              mstEdges: [...mstEdges],
              variables: { mstComplete: true, edgesNeeded: nodes.length - 1 }
            },
            { graph, mstEdges: [...mstEdges], complete: true },
            'mst_complete',
            `MST has ${nodes.length - 1} edges - all vertices connected!`
          ));
          break;
        }
      } else {
        // Same set - would create cycle
        steps.push(this.createStep(
          stepNum++,
          {
            graph,
            sortedEdges: sortedEdges.map(e => ({ ...e })),
            mstEdges: [...mstEdges],
            skippedEdge: edge,
            variables: {
              action: 'SKIP',
              edge: `${from}-${to}`,
              reason: 'Would create cycle'
            }
          },
          {
            graph,
            mstEdges: [...mstEdges],
            skipped: { from, to, weight },
            wouldCycle: true
          },
          'skip_edge',
          `✗ Skip ${from}-${to} - would create cycle (both in set {${rootFrom}})`
        ));
      }
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        graph,
        mstEdges: [...mstEdges],
        variables: {
          complete: true,
          totalWeight,
          edgeCount: mstEdges.length,
          mstEdges: mstEdges.map(e => `${e.from}-${e.to}(${e.weight})`).join(', ')
        }
      },
      {
        graph,
        mstEdges: [...mstEdges],
        complete: true,
        totalWeight
      },
      'complete',
      `Kruskal's MST Complete! Total weight: ${totalWeight}, Edges: ${mstEdges.map(e => `${e.from}-${e.to}`).join(', ')}`
    ));

    return this.buildIR(inputs, { graph, mstEdges: [] }, steps);
  }
}

// Register the generator
registry.register(new KruskalsGenerator());

export default KruskalsGenerator;
