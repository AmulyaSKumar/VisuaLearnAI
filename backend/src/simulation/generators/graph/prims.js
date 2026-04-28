/**
 * Prim's Algorithm Generator
 * Generates step-by-step visualization of Prim's MST algorithm
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class PrimsGenerator extends BaseGenerator {
  constructor() {
    super('prims', 'graph', "Prim's Algorithm (MST)", {
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
      },
      startNode: {
        type: 'string',
        label: 'Start Node',
        description: 'Starting vertex for MST',
        default: 'A'
      }
    });

    this.setDescription("Build Minimum Spanning Tree by always selecting the minimum weight edge connecting MST to a new vertex.");
    this.setComplexity('O(E log V)', 'O(V)');
  }

  doGenerate(inputs) {
    const { graph, startNode } = inputs;
    const { nodes, edges } = graph;
    const steps = [];
    let stepNum = 1;

    // Build adjacency list (undirected)
    const adj = {};
    nodes.forEach(node => adj[node] = []);
    for (const edge of edges) {
      adj[edge.from].push({ to: edge.to, weight: edge.weight });
      adj[edge.to].push({ to: edge.from, weight: edge.weight });
    }

    // Initialize
    const inMST = new Set();
    const mstEdges = [];
    let totalWeight = 0;

    // Priority queue (simplified as array sorted by weight)
    // Each entry: { node, weight, from }
    let pq = [{ node: startNode, weight: 0, from: null }];

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        graph,
        mstEdges: [],
        inMST: [],
        variables: { startNode, totalWeight: 0 }
      },
      { graph, mstNodes: [], mstEdges: [] },
      'start',
      `Prim's Algorithm: Build MST starting from ${startNode}`
    ));

    while (pq.length > 0 && inMST.size < nodes.length) {
      // Sort and get minimum
      pq.sort((a, b) => a.weight - b.weight);
      const { node, weight, from } = pq.shift();

      if (inMST.has(node)) continue;

      // Show candidate selection
      steps.push(this.createStep(
        stepNum++,
        {
          graph,
          mstEdges: [...mstEdges],
          inMST: [...inMST],
          candidate: { node, weight, from },
          variables: {
            selecting: node,
            edgeWeight: from ? weight : 0,
            via: from || 'start'
          }
        },
        {
          graph,
          mstNodes: [...inMST],
          mstEdges: [...mstEdges],
          candidate: { node, from, weight }
        },
        'select',
        from
          ? `Select minimum edge: ${from}→${node} (weight ${weight})`
          : `Start with node ${node}`
      ));

      // Add to MST
      inMST.add(node);
      if (from) {
        mstEdges.push({ from, to: node, weight });
        totalWeight += weight;
      }

      steps.push(this.createStep(
        stepNum++,
        {
          graph,
          mstEdges: [...mstEdges],
          inMST: [...inMST],
          variables: {
            addedNode: node,
            mstSize: inMST.size,
            totalWeight
          }
        },
        {
          graph,
          mstNodes: [...inMST],
          mstEdges: [...mstEdges],
          justAdded: node
        },
        'add_to_mst',
        `Added ${node} to MST. Total weight: ${totalWeight}, Nodes in MST: ${inMST.size}/${nodes.length}`
      ));

      // Add edges from this node to PQ
      const newEdges = [];
      for (const neighbor of adj[node]) {
        if (!inMST.has(neighbor.to)) {
          pq.push({ node: neighbor.to, weight: neighbor.weight, from: node });
          newEdges.push({ to: neighbor.to, weight: neighbor.weight });
        }
      }

      if (newEdges.length > 0) {
        steps.push(this.createStep(
          stepNum++,
          {
            graph,
            mstEdges: [...mstEdges],
            inMST: [...inMST],
            variables: {
              exploringFrom: node,
              newCandidates: newEdges.map(e => `${node}→${e.to}(${e.weight})`).join(', ')
            }
          },
          {
            graph,
            mstNodes: [...inMST],
            mstEdges: [...mstEdges],
            exploring: node,
            candidates: newEdges.map(e => ({ from: node, to: e.to, weight: e.weight }))
          },
          'explore',
          `Exploring from ${node}: Adding ${newEdges.length} candidate edge(s) to queue`
        ));
      }
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        graph,
        mstEdges: [...mstEdges],
        inMST: [...inMST],
        variables: {
          complete: true,
          totalWeight,
          edgeCount: mstEdges.length,
          mstEdges: mstEdges.map(e => `${e.from}-${e.to}(${e.weight})`).join(', ')
        }
      },
      {
        graph,
        mstNodes: [...inMST],
        mstEdges: [...mstEdges],
        complete: true
      },
      'complete',
      `MST Complete! Total weight: ${totalWeight}, Edges: ${mstEdges.length}`
    ));

    return this.buildIR(inputs, { graph, mstEdges: [], inMST: [] }, steps);
  }
}

// Register the generator
registry.register(new PrimsGenerator());

export default PrimsGenerator;
