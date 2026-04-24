/**
 * BST Insert Generator
 * Generates step-by-step visualization of inserting a value into a Binary Search Tree
 */
import { BaseGenerator } from '../base-generator.js';
import { registry } from '../../registry.js';

class BSTInsertGenerator extends BaseGenerator {
  constructor() {
    super('bst_insert', 'tree', 'BST Insert', {
      tree: {
        type: 'tree',
        label: 'Binary Search Tree',
        description: 'Initial BST nodes',
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
      value: {
        type: 'number',
        label: 'Value to Insert',
        description: 'Value to insert into the BST',
        default: 35,
        validation: { min: 1, max: 100 }
      }
    });

    this.setDescription('Inserts a value into a BST by comparing at each node and going left or right.');
    this.setComplexity('O(h)', 'O(1)');
  }

  doGenerate(inputs) {
    const { tree, value } = inputs;
    let nodes = JSON.parse(JSON.stringify(tree.nodes || [])); // Deep clone

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
      insertValue: value,
      current: null,
      path: [],
      comparison: null
    };

    steps.push(this.createStep(
      stepNum++,
      initialState,
      { insertValue: value },
      'start',
      `Starting BST Insert: inserting value ${value}`
    ));

    // Find root node
    let root = nodeMap.get('1') || nodes[0];
    if (!root) {
      // Empty tree - create root
      const newNode = { id: '1', value };
      nodes = [newNode];

      steps.push(this.createStep(
        stepNum++,
        {
          tree: { nodes: [...nodes] },
          insertValue: value,
          current: '1',
          path: [],
          inserted: true
        },
        { current: '1', inserted: '1' },
        'insert_root',
        `Tree is empty. Created root node with value ${value}`
      ));

      return this.buildIR(inputs, initialState, steps);
    }

    // Traverse to find insertion point
    let current = root;
    const path = [];
    let parent = null;
    let direction = null;

    while (current) {
      path.push(current.id);

      steps.push(this.createStep(
        stepNum++,
        {
          tree: { nodes: [...nodes] },
          insertValue: value,
          current: current.id,
          path: [...path],
          comparison: { nodeValue: current.value, insertValue: value }
        },
        {
          current: current.id,
          path: [...path],
          comparing: true
        },
        'compare',
        `At node ${current.value}: comparing with ${value}`
      ));

      parent = current;

      if (value < current.value) {
        direction = 'left';
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            insertValue: value,
            current: current.id,
            path: [...path],
            direction: 'left'
          },
          {
            current: current.id,
            path: [...path],
            direction: 'left'
          },
          'go_left',
          `${value} < ${current.value}, go left`
        ));

        current = current.left ? nodeMap.get(current.left) : null;
      } else if (value > current.value) {
        direction = 'right';
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            insertValue: value,
            current: current.id,
            path: [...path],
            direction: 'right'
          },
          {
            current: current.id,
            path: [...path],
            direction: 'right'
          },
          'go_right',
          `${value} > ${current.value}, go right`
        ));

        current = current.right ? nodeMap.get(current.right) : null;
      } else {
        // Value already exists
        steps.push(this.createStep(
          stepNum++,
          {
            tree: { nodes: [...nodes] },
            insertValue: value,
            current: current.id,
            path: [...path],
            duplicate: true
          },
          {
            current: current.id,
            path: [...path],
            duplicate: true
          },
          'duplicate',
          `Value ${value} already exists in tree!`
        ));

        return this.buildIR(inputs, initialState, steps);
      }
    }

    // Insert new node
    const newId = String(nodes.length + 1);
    const newNode = { id: newId, value };
    nodes.push(newNode);
    nodeMap.set(newId, newNode);

    // Update parent's child pointer
    const parentNode = nodeMap.get(parent.id);
    if (direction === 'left') {
      parentNode.left = newId;
    } else {
      parentNode.right = newId;
    }

    path.push(newId);

    steps.push(this.createStep(
      stepNum++,
      {
        tree: { nodes: [...nodes] },
        insertValue: value,
        current: newId,
        path: [...path],
        inserted: true
      },
      {
        current: newId,
        path: [...path],
        inserted: newId,
        parent: parent.id
      },
      'insert',
      `Found empty spot! Insert ${value} as ${direction} child of ${parent.value}`
    ));

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        tree: { nodes: [...nodes] },
        insertValue: value,
        current: null,
        path: [...path],
        complete: true
      },
      { path: [...path], complete: true, inserted: newId },
      'complete',
      `BST Insert complete! ${value} inserted successfully`
    ));

    return this.buildIR(inputs, initialState, steps);
  }
}

// Register the generator
registry.register(new BSTInsertGenerator());

export default BSTInsertGenerator;
