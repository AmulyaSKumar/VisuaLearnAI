/**
 * BST Search Generator
 * Generates step-by-step visualization of searching for a value in a Binary Search Tree
 */
import { BaseGenerator } from '../base-generator.js';
import { registry } from '../../registry.js';

class BSTSearchGenerator extends BaseGenerator {
  constructor() {
    super('bst_search', 'tree', 'BST Search', {
      tree: {
        type: 'tree',
        label: 'Binary Search Tree',
        description: 'BST nodes to search in',
        default: {
          nodes: [
            { id: '1', value: 50, left: '2', right: '3' },
            { id: '2', value: 30, left: '4', right: '5' },
            { id: '3', value: 70, left: '6', right: '7' },
            { id: '4', value: 20 },
            { id: '5', value: 40 },
            { id: '6', value: 60 },
            { id: '7', value: 80 }
          ]
        }
      },
      target: {
        type: 'number',
        label: 'Search Value',
        description: 'Value to search for',
        default: 40,
        validation: { min: 1, max: 100 }
      }
    });

    this.setDescription('Searches for a value in BST by comparing and going left/right at each node.');
    this.setComplexity('O(h)', 'O(1)');
  }

  doGenerate(inputs) {
    const { tree, target } = inputs;
    const nodes = tree.nodes || [];

    // Build node lookup map
    const nodeMap = new Map();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const steps = [];
    let stepNum = 1;

    // Initial state
    const initialState = {
      tree: { nodes: [...nodes] },
      target,
      current: null,
      path: [],
      found: null
    };

    steps.push(this.createStep(
      stepNum++,
      initialState,
      { target },
      'start',
      `Starting BST Search: looking for value ${target}`
    ));

    // Find root node
    const root = nodeMap.get('1') || nodes[0];
    if (!root) {
      steps.push(this.createStep(
        stepNum++,
        {
          tree: { nodes: [...nodes] },
          target,
          current: null,
          path: [],
          found: false
        },
        { notFound: true },
        'empty',
        `Tree is empty. Value ${target} not found.`
      ));
      return this.buildIR(inputs, initialState, steps);
    }

    // Search the tree
    let current = root;
    const path = [];
    const visited = new Set();

    while (current) {
      path.push(current.id);
      visited.add(current.id);

      steps.push(this.createStep(
        stepNum++,
        {
          tree: { nodes: [...nodes] },
          target,
          current: current.id,
          path: [...path],
          comparison: { nodeValue: current.value, target }
        },
        {
          current: current.id,
          visited: [...visited],
          path: [...path],
          comparing: true
        },
        'compare',
        `At node ${current.value}: comparing with target ${target}`
      ));

      if (target === current.value) {
        // Found!
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            target,
            current: current.id,
            path: [...path],
            found: true
          },
          {
            current: current.id,
            visited: [...visited],
            path: [...path],
            found: current.id
          },
          'found',
          `Found ${target}! Value exists at this node.`
        ));

        // Final state
        steps.push(this.createStep(
          stepNum,
          {
            tree: { nodes: [...nodes] },
            target,
            current: current.id,
            path: [...path],
            found: true,
            complete: true
          },
          {
            current: current.id,
            visited: [...visited],
            path: [...path],
            found: current.id,
            complete: true
          },
          'complete',
          `BST Search complete! Found ${target} after visiting ${path.length} nodes.`
        ));

        return this.buildIR(inputs, initialState, steps);
      }

      if (target < current.value) {
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            target,
            current: current.id,
            path: [...path],
            direction: 'left'
          },
          {
            current: current.id,
            visited: [...visited],
            path: [...path],
            direction: 'left'
          },
          'go_left',
          `${target} < ${current.value}, go left`
        ));

        current = current.left ? nodeMap.get(current.left) : null;
      } else {
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            target,
            current: current.id,
            path: [...path],
            direction: 'right'
          },
          {
            current: current.id,
            visited: [...visited],
            path: [...path],
            direction: 'right'
          },
          'go_right',
          `${target} > ${current.value}, go right`
        ));

        current = current.right ? nodeMap.get(current.right) : null;
      }
    }

    // Not found
    steps.push(this.createStep(
      stepNum++,
      {
        tree: { nodes: [...nodes] },
        target,
        current: null,
        path: [...path],
        found: false
      },
      {
        visited: [...visited],
        path: [...path],
        notFound: true
      },
      'not_found',
      `Reached null pointer. Value ${target} not found in tree.`
    ));

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        tree: { nodes: [...nodes] },
        target,
        current: null,
        path: [...path],
        found: false,
        complete: true
      },
      {
        visited: [...visited],
        path: [...path],
        notFound: true,
        complete: true
      },
      'complete',
      `BST Search complete! ${target} not found after visiting ${path.length} nodes.`
    ));

    return this.buildIR(inputs, initialState, steps);
  }
}

// Register the generator
registry.register(new BSTSearchGenerator());

export default BSTSearchGenerator;
