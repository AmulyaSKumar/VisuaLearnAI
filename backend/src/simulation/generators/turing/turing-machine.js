/**
 * Turing Machine Simulator Generator
 * Generates step-by-step visualization of Turing Machine execution
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class TuringMachineGenerator extends BaseGenerator {
  constructor() {
    super('turing_machine', 'turing', 'Turing Machine Simulator', {
      tape: {
        type: 'string',
        label: 'Input Tape',
        description: 'Initial tape content (use _ for blank)',
        default: '1011'
      },
      transitions: {
        type: 'array',
        label: 'Transitions',
        description: 'State transition rules: [state, read, write, move, nextState]',
        default: [
          // Binary increment machine
          { state: 'q0', read: '1', write: '1', move: 'R', next: 'q0' },
          { state: 'q0', read: '0', write: '0', move: 'R', next: 'q0' },
          { state: 'q0', read: '_', write: '_', move: 'L', next: 'q1' },
          { state: 'q1', read: '1', write: '0', move: 'L', next: 'q1' },
          { state: 'q1', read: '0', write: '1', move: 'R', next: 'qf' },
          { state: 'q1', read: '_', write: '1', move: 'R', next: 'qf' }
        ]
      },
      startState: {
        type: 'string',
        label: 'Start State',
        description: 'Initial state of the machine',
        default: 'q0'
      },
      acceptStates: {
        type: 'array',
        label: 'Accept States',
        description: 'Accepting/final states',
        default: ['qf']
      },
      maxSteps: {
        type: 'number',
        label: 'Max Steps',
        description: 'Maximum steps before halting',
        default: 50
      }
    });

    this.setDescription('Simulate a Turing Machine with configurable tape, states, and transitions.');
    this.setComplexity('O(s)', 'O(n)');
  }

  doGenerate(inputs) {
    const { tape: inputTape, transitions, startState, acceptStates, maxSteps } = inputs;
    const steps = [];
    let stepNum = 1;

    // Initialize tape with blanks on both sides
    const BLANK = '_';
    let tape = [BLANK, BLANK, ...inputTape.split(''), BLANK, BLANK];
    let head = 2; // Start at first input character
    let currentState = startState;
    let halted = false;
    let accepted = false;

    // Build transition function map
    const transitionMap = {};
    for (const t of transitions) {
      const key = `${t.state},${t.read}`;
      transitionMap[key] = t;
    }

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        tape: [...tape],
        head,
        state: currentState,
        transitions,
        variables: {
          inputTape,
          numTransitions: transitions.length,
          startState,
          acceptStates: acceptStates.join(', ')
        }
      },
      {
        tape: [...tape],
        head,
        state: currentState
      },
      'start',
      `Turing Machine initialized. Input: "${inputTape}", Start state: ${startState}`
    ));

    let executionStep = 0;
    while (!halted && executionStep < maxSteps) {
      executionStep++;

      // Read current symbol
      const readSymbol = tape[head];
      const transitionKey = `${currentState},${readSymbol}`;
      const transition = transitionMap[transitionKey];

      steps.push(this.createStep(
        stepNum++,
        {
          tape: [...tape],
          head,
          state: currentState,
          variables: {
            step: executionStep,
            reading: readSymbol,
            lookingFor: transitionKey,
            transitionFound: !!transition
          }
        },
        {
          tape: [...tape],
          head,
          state: currentState,
          reading: true
        },
        'read',
        `Step ${executionStep}: State=${currentState}, Read='${readSymbol}' at position ${head}`
      ));

      if (!transition) {
        // No transition found - halt
        halted = true;
        accepted = acceptStates.includes(currentState);

        steps.push(this.createStep(
          stepNum++,
          {
            tape: [...tape],
            head,
            state: currentState,
            variables: {
              halted: true,
              reason: 'No transition found',
              accepted
            }
          },
          {
            tape: [...tape],
            head,
            state: currentState,
            halted: true,
            accepted
          },
          'halt',
          `HALT: No transition for (${currentState}, '${readSymbol}'). ${accepted ? 'ACCEPTED' : 'REJECTED'}`
        ));
        break;
      }

      // Apply transition
      const { write, move, next } = transition;

      // Write symbol
      tape[head] = write;

      steps.push(this.createStep(
        stepNum++,
        {
          tape: [...tape],
          head,
          state: currentState,
          variables: {
            wrote: write,
            willMove: move,
            nextState: next
          }
        },
        {
          tape: [...tape],
          head,
          state: currentState,
          wrote: write
        },
        'write',
        `Write '${write}' at position ${head}`
      ));

      // Move head
      const oldHead = head;
      if (move === 'R') {
        head++;
        // Extend tape if needed
        if (head >= tape.length - 1) {
          tape.push(BLANK);
        }
      } else if (move === 'L') {
        head--;
        // Extend tape if needed
        if (head <= 0) {
          tape.unshift(BLANK);
          head = 1;
        }
      }

      steps.push(this.createStep(
        stepNum++,
        {
          tape: [...tape],
          head,
          state: currentState,
          variables: {
            moved: move,
            fromPosition: oldHead,
            toPosition: head
          }
        },
        {
          tape: [...tape],
          head,
          state: currentState,
          moved: { from: oldHead, to: head, direction: move }
        },
        'move',
        `Move head ${move === 'R' ? 'RIGHT' : move === 'L' ? 'LEFT' : 'STAY'} to position ${head}`
      ));

      // Transition to new state
      const prevState = currentState;
      currentState = next;

      if (prevState !== currentState) {
        steps.push(this.createStep(
          stepNum++,
          {
            tape: [...tape],
            head,
            state: currentState,
            variables: {
              stateChange: `${prevState} → ${currentState}`
            }
          },
          {
            tape: [...tape],
            head,
            state: currentState,
            stateChanged: { from: prevState, to: currentState }
          },
          'state_change',
          `State transition: ${prevState} → ${currentState}`
        ));
      }

      // Check if in accept state
      if (acceptStates.includes(currentState)) {
        halted = true;
        accepted = true;

        steps.push(this.createStep(
          stepNum++,
          {
            tape: [...tape],
            head,
            state: currentState,
            variables: {
              halted: true,
              reason: 'Reached accept state',
              accepted: true
            }
          },
          {
            tape: [...tape],
            head,
            state: currentState,
            halted: true,
            accepted: true
          },
          'accept',
          `HALT: Reached accept state ${currentState}. ACCEPTED!`
        ));
        break;
      }
    }

    // Check for max steps exceeded
    if (!halted && executionStep >= maxSteps) {
      steps.push(this.createStep(
        stepNum++,
        {
          tape: [...tape],
          head,
          state: currentState,
          variables: {
            halted: true,
            reason: `Max steps (${maxSteps}) exceeded`,
            possibleInfiniteLoop: true
          }
        },
        {
          tape: [...tape],
          head,
          state: currentState,
          halted: true,
          timeout: true
        },
        'timeout',
        `HALT: Max steps (${maxSteps}) exceeded. Possible infinite loop.`
      ));
    }

    // Extract final tape content (trim blanks)
    const finalTape = tape.join('').replace(/^_+|_+$/g, '') || BLANK;

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        tape: [...tape],
        head,
        state: currentState,
        variables: {
          complete: true,
          finalTape,
          totalSteps: executionStep,
          accepted,
          finalState: currentState
        }
      },
      {
        tape: [...tape],
        head,
        state: currentState,
        complete: true,
        accepted,
        finalTape
      },
      'complete',
      `Complete! Final tape: "${finalTape}", Steps: ${executionStep}, Result: ${accepted ? 'ACCEPTED' : 'REJECTED/HALTED'}`
    ));

    return this.buildIR(inputs, { tape: [], head: 0, state: startState }, steps);
  }
}

// Register the generator
registry.register(new TuringMachineGenerator());

export default TuringMachineGenerator;
