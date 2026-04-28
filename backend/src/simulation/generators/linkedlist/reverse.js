/**
 * Linked List Reverse Generator
 * Generates step-by-step visualization of reversing a linked list
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class LinkedListReverseGenerator extends BaseGenerator {
  constructor() {
    super('linkedlist_reverse', 'linkedlist', 'Linked List Reverse', {
      initialList: {
        type: 'array',
        label: 'Initial List',
        description: 'Initial values in the linked list',
        default: [1, 2, 3, 4, 5]
      }
    });

    this.setDescription('Reverse a singly linked list in-place using iterative method with three pointers.');
    this.setComplexity('O(n)', 'O(1)');
  }

  doGenerate(inputs) {
    const { initialList } = inputs;
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
        nodes: nodes.map(n => ({ ...n })),
        head,
        variables: { listSize: nodes.length, original: initialList.join(' → ') }
      },
      { nodes: nodes.map(n => n.id), head },
      'start',
      `Reverse linked list [${initialList.join(' → ')}] using three pointers: prev, current, next`
    ));

    if (nodes.length <= 1) {
      steps.push(this.createStep(
        stepNum,
        {
          nodes: nodes.map(n => ({ ...n })),
          head,
          variables: { result: 'Already reversed (0 or 1 element)' }
        },
        { nodes: nodes.map(n => n.id), head, complete: true },
        'complete',
        `List with ${nodes.length} element(s) is already reversed!`
      ));
      return this.buildIR(inputs, { nodes: [], head: null }, steps);
    }

    // Initialize three pointers
    let prev = null;
    let current = head;
    let next = null;

    steps.push(this.createStep(
      stepNum++,
      {
        nodes: nodes.map(n => ({ ...n })),
        head,
        pointers: { prev: null, current, next: null },
        variables: { prev: 'null', current: nodes[0].value, next: 'null' }
      },
      { prev: null, current, next: null, pointers: true },
      'init_pointers',
      `Initialize: prev = null, current = ${nodes[0].value}, next = null`
    ));

    // Reversal loop
    let iteration = 0;
    while (current) {
      iteration++;
      const currentNode = nodes.find(n => n.id === current);
      next = currentNode.next;

      // Step 1: Save next
      steps.push(this.createStep(
        stepNum++,
        {
          nodes: nodes.map(n => ({ ...n })),
          head,
          pointers: { prev, current, next },
          variables: {
            iteration,
            step: 'Save next',
            prev: prev ? nodes.find(n => n.id === prev)?.value : 'null',
            current: currentNode.value,
            next: next ? nodes.find(n => n.id === next)?.value : 'null'
          }
        },
        { prev, current, next, step: 'save_next' },
        'save_next',
        `Iteration ${iteration}: Save next = ${next ? nodes.find(n => n.id === next)?.value : 'null'}`
      ));

      // Step 2: Reverse link
      currentNode.next = prev;

      steps.push(this.createStep(
        stepNum++,
        {
          nodes: nodes.map(n => ({ ...n })),
          head,
          pointers: { prev, current, next },
          variables: {
            iteration,
            step: 'Reverse link',
            reverseLink: `${currentNode.value} → ${prev ? nodes.find(n => n.id === prev)?.value : 'null'}`
          }
        },
        { prev, current, next, reversedLink: current, step: 'reverse_link' },
        'reverse_link',
        `Reverse link: ${currentNode.value}.next = ${prev ? nodes.find(n => n.id === prev)?.value : 'null'}`
      ));

      // Step 3: Move prev forward
      prev = current;

      // Step 4: Move current forward
      current = next;

      steps.push(this.createStep(
        stepNum++,
        {
          nodes: nodes.map(n => ({ ...n })),
          head,
          pointers: { prev, current, next },
          variables: {
            iteration,
            step: 'Move pointers',
            prev: prev ? nodes.find(n => n.id === prev)?.value : 'null',
            current: current ? nodes.find(n => n.id === current)?.value : 'null'
          }
        },
        { prev, current, next, step: 'move_pointers' },
        'move_pointers',
        `Move pointers: prev = ${nodes.find(n => n.id === prev)?.value}, current = ${current ? nodes.find(n => n.id === current)?.value : 'null'}`
      ));
    }

    // Update head to prev (last non-null node)
    head = prev;

    // Reorder nodes array to match new order
    const reorderedNodes = [];
    let node = head;
    while (node) {
      const n = nodes.find(nd => nd.id === node);
      if (n) {
        reorderedNodes.push(n);
        node = n.next;
      } else {
        break;
      }
    }

    steps.push(this.createStep(
      stepNum++,
      {
        nodes: reorderedNodes.map(n => ({ ...n })),
        head,
        variables: { newHead: nodes.find(n => n.id === head)?.value }
      },
      { nodes: reorderedNodes.map(n => n.id), head, newHead: true },
      'update_head',
      `Update head to ${nodes.find(n => n.id === head)?.value} (previously the tail)`
    ));

    // Final state
    const reversedList = reorderedNodes.map(n => n.value);
    steps.push(this.createStep(
      stepNum,
      {
        nodes: reorderedNodes.map(n => ({ ...n })),
        head,
        variables: {
          original: initialList.join(' → '),
          reversed: reversedList.join(' → '),
          iterations: iteration
        }
      },
      { nodes: reorderedNodes.map(n => n.id), head, complete: true },
      'complete',
      `Complete! Reversed: [${reversedList.join(' → ')}]`
    ));

    return this.buildIR(inputs, { nodes: [], head: null }, steps);
  }
}

// Register the generator
registry.register(new LinkedListReverseGenerator());

export default LinkedListReverseGenerator;
