/**
 * Linked List Delete Generator
 * Generates step-by-step visualization of linked list deletion
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class LinkedListDeleteGenerator extends BaseGenerator {
  constructor() {
    super('linkedlist_delete', 'linkedlist', 'Linked List Delete', {
      initialList: {
        type: 'array',
        label: 'Initial List',
        description: 'Initial values in the linked list',
        default: [10, 20, 30, 40, 50]
      },
      deleteValue: {
        type: 'number',
        label: 'Value to Delete',
        description: 'Value to delete from the list',
        default: 30
      }
    });

    this.setDescription('Delete a node with a specific value from a singly linked list.');
    this.setComplexity('O(n)', 'O(1)');
  }

  doGenerate(inputs) {
    const { initialList, deleteValue } = inputs;
    const steps = [];
    let stepNum = 1;

    // Build initial linked list
    let nodes = initialList.map((val, i) => ({
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
        variables: { listSize: nodes.length, deleteValue }
      },
      { nodes: nodes.map(n => n.id), head },
      'start',
      `Delete node with value ${deleteValue} from list [${initialList.join(' → ')}]`
    ));

    if (nodes.length === 0) {
      steps.push(this.createStep(
        stepNum,
        { nodes: [], head: null, variables: { error: 'Empty list' } },
        { error: true },
        'empty',
        `Cannot delete from empty list!`
      ));
      return this.buildIR(inputs, { nodes: [], head: null }, steps);
    }

    // Check if deleting head
    if (nodes[0].value === deleteValue) {
      const deletedNode = nodes[0];

      steps.push(this.createStep(
        stepNum++,
        {
          nodes: [...nodes],
          head,
          variables: { foundAt: 'head', value: deleteValue }
        },
        { found: deletedNode.id, isHead: true },
        'found_at_head',
        `Found ${deleteValue} at head! Will delete head node.`
      ));

      head = deletedNode.next;
      nodes = nodes.slice(1);

      steps.push(this.createStep(
        stepNum++,
        {
          nodes: [...nodes],
          head,
          deletedValue: deleteValue,
          variables: { newHead: head ? nodes[0]?.value : 'null', listSize: nodes.length }
        },
        { nodes: nodes.map(n => n.id), head, deleted: deletedNode.id },
        'delete_head',
        `Deleted head. New head: ${head ? nodes[0]?.value : 'null'}. List size: ${nodes.length}`
      ));
    } else {
      // Search for the node to delete
      let current = head;
      let prev = null;
      let found = false;
      let index = 0;

      steps.push(this.createStep(
        stepNum++,
        {
          nodes: [...nodes],
          head,
          variables: { searching: true, target: deleteValue }
        },
        { current, searching: true },
        'search_start',
        `Searching for node with value ${deleteValue}...`
      ));

      while (current) {
        const currentNode = nodes.find(n => n.id === current);

        steps.push(this.createStep(
          stepNum++,
          {
            nodes: [...nodes],
            head,
            variables: { checking: currentNode.value, index }
          },
          {
            current,
            previous: prev,
            comparing: currentNode.value === deleteValue
          },
          'compare',
          `Checking node ${index}: ${currentNode.value} ${currentNode.value === deleteValue ? '= ' + deleteValue + ' Found!' : '≠ ' + deleteValue}`
        ));

        if (currentNode.value === deleteValue) {
          found = true;

          // Update previous node's next pointer
          const prevNode = nodes.find(n => n.id === prev);
          if (prevNode) {
            prevNode.next = currentNode.next;
          }

          steps.push(this.createStep(
            stepNum++,
            {
              nodes: [...nodes],
              head,
              variables: { deleting: deleteValue, reconnecting: true }
            },
            { found: current, previous: prev, reconnecting: true },
            'reconnect',
            `Reconnecting: ${prevNode?.value} → ${currentNode.next ? nodes.find(n => n.id === currentNode.next)?.value : 'null'}`
          ));

          // Remove from nodes array
          nodes = nodes.filter(n => n.id !== current);

          steps.push(this.createStep(
            stepNum++,
            {
              nodes: [...nodes],
              head,
              deletedValue: deleteValue,
              variables: { deleted: deleteValue, listSize: nodes.length }
            },
            { nodes: nodes.map(n => n.id), head, deleted: current },
            'deleted',
            `Deleted node with value ${deleteValue}. List size: ${nodes.length}`
          ));

          break;
        }

        prev = current;
        current = currentNode.next;
        index++;
      }

      if (!found) {
        steps.push(this.createStep(
          stepNum++,
          {
            nodes: [...nodes],
            head,
            variables: { notFound: true, searchedValue: deleteValue }
          },
          { notFound: true },
          'not_found',
          `Value ${deleteValue} not found in the list!`
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
          list: nodes.map(n => n.value).join(' → ') || 'empty'
        }
      },
      { nodes: nodes.map(n => n.id), head, complete: true },
      'complete',
      `Complete! List: [${nodes.map(n => n.value).join(' → ') || 'empty'}]`
    ));

    return this.buildIR(inputs, { nodes: [], head: null }, steps);
  }
}

// Register the generator
registry.register(new LinkedListDeleteGenerator());

export default LinkedListDeleteGenerator;
