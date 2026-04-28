/**
 * Linked List Insert Generator
 * Generates step-by-step visualization of linked list insertion
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class LinkedListInsertGenerator extends BaseGenerator {
  constructor() {
    super('linkedlist_insert', 'linkedlist', 'Linked List Insert', {
      initialList: {
        type: 'array',
        label: 'Initial List',
        description: 'Initial values in the linked list',
        default: [10, 20, 30, 40]
      },
      insertValue: {
        type: 'number',
        label: 'Value to Insert',
        description: 'Value to insert',
        default: 25
      },
      position: {
        type: 'number',
        label: 'Position',
        description: 'Position to insert at (0 = head)',
        default: 2,
        validation: { min: 0, max: 10 }
      }
    });

    this.setDescription('Insert a new node at a specific position in a singly linked list.');
    this.setComplexity('O(n)', 'O(1)');
  }

  doGenerate(inputs) {
    const { initialList, insertValue, position } = inputs;
    const steps = [];
    let stepNum = 1;

    // Build initial linked list
    const nodes = initialList.map((val, i) => ({
      id: `node-${i}`,
      value: val,
      next: i < initialList.length - 1 ? `node-${i + 1}` : null
    }));

    let head = nodes.length > 0 ? 'node-0' : null;

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        nodes: [...nodes],
        head,
        variables: { listSize: nodes.length, insertValue, targetPosition: position }
      },
      { nodes: nodes.map(n => n.id), head },
      'start',
      `Insert ${insertValue} at position ${position} in linked list [${initialList.join(' → ')}]`
    ));

    // Handle insert at head (position 0)
    if (position === 0) {
      const newNode = {
        id: `node-new`,
        value: insertValue,
        next: head
      };

      steps.push(this.createStep(
        stepNum++,
        {
          nodes: [...nodes],
          head,
          newNode,
          variables: { insertAt: 'head', newValue: insertValue }
        },
        { newNode: newNode.id, insertingAt: 'head' },
        'create_node',
        `Create new node with value ${insertValue}. Inserting at head.`
      ));

      nodes.unshift(newNode);
      head = newNode.id;

      steps.push(this.createStep(
        stepNum++,
        {
          nodes: [...nodes],
          head,
          variables: { newHead: insertValue, listSize: nodes.length }
        },
        { nodes: nodes.map(n => n.id), head, justInserted: newNode.id },
        'insert_complete',
        `New node is now the head. List: [${nodes.map(n => n.value).join(' → ')}]`
      ));
    } else {
      // Traverse to find insertion point
      let current = head;
      let currentIdx = 0;
      let prev = null;

      steps.push(this.createStep(
        stepNum++,
        {
          nodes: [...nodes],
          head,
          variables: { traversing: true, currentIndex: 0, targetPosition: position }
        },
        { current, currentIndex: 0 },
        'traverse_start',
        `Start traversal to find position ${position}. Current: node 0`
      ));

      while (currentIdx < position - 1 && current) {
        const currentNode = nodes.find(n => n.id === current);
        prev = current;
        current = currentNode?.next;
        currentIdx++;

        steps.push(this.createStep(
          stepNum++,
          {
            nodes: [...nodes],
            head,
            variables: { currentIndex: currentIdx, targetPosition: position }
          },
          {
            current,
            previous: prev,
            currentIndex: currentIdx,
            traversePath: nodes.slice(0, currentIdx + 1).map(n => n.id)
          },
          'traverse',
          `Move to node ${currentIdx}. ${currentIdx === position - 1 ? 'Found insertion point!' : 'Continue...'}`
        ));
      }

      if (currentIdx === position - 1 && current) {
        const currentNode = nodes.find(n => n.id === current);
        const newNode = {
          id: `node-new`,
          value: insertValue,
          next: currentNode.next
        };

        steps.push(this.createStep(
          stepNum++,
          {
            nodes: [...nodes],
            head,
            newNode,
            variables: { insertAfter: currentNode.value, newValue: insertValue }
          },
          { newNode: newNode.id, insertAfter: current },
          'create_node',
          `Create new node with value ${insertValue}. Will insert after ${currentNode.value}.`
        ));

        // Update links
        currentNode.next = newNode.id;

        // Insert into nodes array at correct position
        const insertIdx = nodes.findIndex(n => n.id === current) + 1;
        nodes.splice(insertIdx, 0, newNode);

        steps.push(this.createStep(
          stepNum++,
          {
            nodes: [...nodes],
            head,
            variables: { linked: true, listSize: nodes.length }
          },
          {
            nodes: nodes.map(n => n.id),
            head,
            justInserted: newNode.id,
            updatedLink: current
          },
          'link_updated',
          `Updated links. ${currentNode.value} → ${insertValue} → ${newNode.next ? nodes.find(n => n.id === newNode.next)?.value : 'null'}`
        ));
      } else {
        // Position out of bounds - insert at end
        steps.push(this.createStep(
          stepNum++,
          {
            nodes: [...nodes],
            head,
            variables: { outOfBounds: true, insertingAtEnd: true }
          },
          { warning: true },
          'out_of_bounds',
          `Position ${position} is beyond list length. Inserting at end.`
        ));

        const lastNode = nodes[nodes.length - 1];
        const newNode = {
          id: `node-new`,
          value: insertValue,
          next: null
        };
        lastNode.next = newNode.id;
        nodes.push(newNode);

        steps.push(this.createStep(
          stepNum++,
          {
            nodes: [...nodes],
            head,
            variables: { listSize: nodes.length }
          },
          { nodes: nodes.map(n => n.id), justInserted: newNode.id },
          'insert_at_end',
          `Inserted ${insertValue} at end of list.`
        ));
      }
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        nodes: [...nodes],
        head,
        variables: {
          finalSize: nodes.length,
          list: nodes.map(n => n.value).join(' → ')
        }
      },
      { nodes: nodes.map(n => n.id), head, complete: true },
      'complete',
      `Complete! List: [${nodes.map(n => n.value).join(' → ')}]`
    ));

    return this.buildIR(inputs, { nodes: [], head: null }, steps);
  }
}

// Register the generator
registry.register(new LinkedListInsertGenerator());

export default LinkedListInsertGenerator;
