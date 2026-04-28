/**
 * DFA (Deterministic Finite Automaton) Generator
 * Generates step-by-step visualization of DFA string processing
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class DFAGenerator extends BaseGenerator {
  constructor() {
    super('dfa', 'state_machine', 'DFA Simulation', {
      states: {
        type: 'array',
        label: 'States',
        description: 'List of state names',
        default: ['q0', 'q1', 'q2']
      },
      alphabet: {
        type: 'array',
        label: 'Alphabet',
        description: 'Input symbols',
        default: ['0', '1']
      },
      transitions: {
        type: 'object',
        label: 'Transitions',
        description: 'State transitions { "state,symbol": "nextState" }',
        default: {
          'q0,0': 'q0',
          'q0,1': 'q1',
          'q1,0': 'q2',
          'q1,1': 'q0',
          'q2,0': 'q1',
          'q2,1': 'q2'
        }
      },
      startState: {
        type: 'string',
        label: 'Start State',
        description: 'Initial state',
        default: 'q0'
      },
      acceptStates: {
        type: 'array',
        label: 'Accept States',
        description: 'Final/accepting states',
        default: ['q0']
      },
      input: {
        type: 'string',
        label: 'Input String',
        description: 'String to process',
        default: '110101'
      }
    });

    this.setDescription('Deterministic Finite Automaton: Process input string one symbol at a time. Exactly one transition per state-symbol pair.');
    this.setComplexity('O(n)', 'O(1)');
  }

  doGenerate(inputs) {
    const { states, alphabet, transitions, startState, acceptStates, input } = inputs;
    const steps = [];
    let stepNum = 1;

    // Build automaton structure for visualization
    const automaton = {
      states,
      alphabet,
      transitions,
      startState,
      acceptStates
    };

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        automaton,
        input,
        currentState: startState,
        position: -1,
        variables: {
          inputLength: input.length,
          totalStates: states.length,
          acceptStates: acceptStates.join(', ')
        }
      },
      {
        currentState: startState,
        isStart: true
      },
      'start',
      `DFA: Process "${input}" starting from ${startState}. Accept states: {${acceptStates.join(', ')}}`
    ));

    // Show the automaton structure
    steps.push(this.createStep(
      stepNum++,
      {
        automaton,
        input,
        currentState: startState,
        position: -1,
        variables: { showStructure: true }
      },
      {
        currentState: startState,
        showTransitions: true
      },
      'show_automaton',
      `Automaton has ${states.length} states with alphabet {${alphabet.join(', ')}}`
    ));

    let currentState = startState;
    const inputArray = input.split('');

    // Process each symbol
    for (let i = 0; i < inputArray.length; i++) {
      const symbol = inputArray[i];
      const transitionKey = `${currentState},${symbol}`;
      const nextState = transitions[transitionKey];

      // Show current position
      steps.push(this.createStep(
        stepNum++,
        {
          automaton,
          input,
          currentState,
          position: i,
          variables: {
            symbol,
            reading: `position ${i}`,
            lookingFor: transitionKey
          }
        },
        {
          currentState,
          position: i,
          symbol,
          highlightInput: i
        },
        'read_symbol',
        `Read symbol '${symbol}' at position ${i}. Current state: ${currentState}`
      ));

      if (!nextState) {
        // No transition - reject
        steps.push(this.createStep(
          stepNum++,
          {
            automaton,
            input,
            currentState,
            position: i,
            variables: { error: 'No transition', symbol }
          },
          {
            currentState,
            error: true,
            position: i
          },
          'no_transition',
          `No transition for (${currentState}, ${symbol})! String REJECTED.`
        ));

        steps.push(this.createStep(
          stepNum,
          {
            automaton,
            input,
            currentState,
            position: i,
            variables: { result: 'REJECTED', reason: 'No valid transition' }
          },
          {
            rejected: true,
            finalState: currentState
          },
          'reject',
          `Result: REJECTED - No transition defined for δ(${currentState}, ${symbol})`
        ));

        return this.buildIR(inputs, { automaton, input }, steps);
      }

      // Make transition
      steps.push(this.createStep(
        stepNum++,
        {
          automaton,
          input,
          currentState: nextState,
          position: i,
          variables: {
            transition: `δ(${currentState}, ${symbol}) = ${nextState}`,
            from: currentState,
            to: nextState
          }
        },
        {
          currentState: nextState,
          previousState: currentState,
          transition: { from: currentState, symbol, to: nextState },
          position: i
        },
        'transition',
        `δ(${currentState}, ${symbol}) = ${nextState}`
      ));

      currentState = nextState;
    }

    // Check if final state is accepting
    const isAccepted = acceptStates.includes(currentState);

    steps.push(this.createStep(
      stepNum++,
      {
        automaton,
        input,
        currentState,
        position: input.length,
        variables: {
          finalState: currentState,
          isAcceptState: isAccepted
        }
      },
      {
        currentState,
        checking: true,
        isAcceptState: isAccepted
      },
      'check_accept',
      `Input consumed. Final state: ${currentState}. Is ${currentState} ∈ {${acceptStates.join(', ')}}?`
    ));

    // Final result
    steps.push(this.createStep(
      stepNum,
      {
        automaton,
        input,
        currentState,
        position: input.length,
        variables: {
          result: isAccepted ? 'ACCEPTED' : 'REJECTED',
          finalState: currentState
        }
      },
      {
        currentState,
        complete: true,
        accepted: isAccepted
      },
      'complete',
      `Result: ${isAccepted ? 'ACCEPTED' : 'REJECTED'} - Final state ${currentState} is ${isAccepted ? '' : 'NOT '}an accept state`
    ));

    return this.buildIR(inputs, { automaton, input }, steps);
  }
}

// Register the generator
registry.register(new DFAGenerator());

export default DFAGenerator;
