/**
 * NFA (Non-deterministic Finite Automaton) Generator
 * Generates step-by-step visualization of NFA string processing
 * Handles multiple simultaneous states and epsilon transitions
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class NFAGenerator extends BaseGenerator {
  constructor() {
    super('nfa', 'state_machine', 'NFA Simulation', {
      states: {
        type: 'array',
        label: 'States',
        description: 'List of state names',
        default: ['q0', 'q1', 'q2', 'q3']
      },
      alphabet: {
        type: 'array',
        label: 'Alphabet',
        description: 'Input symbols (ε for epsilon)',
        default: ['a', 'b']
      },
      transitions: {
        type: 'object',
        label: 'Transitions',
        description: 'State transitions { "state,symbol": ["nextState1", "nextState2"] }',
        default: {
          'q0,a': ['q0', 'q1'],
          'q0,b': ['q0'],
          'q1,a': ['q2'],
          'q1,b': ['q2'],
          'q2,a': ['q3'],
          'q2,b': ['q3']
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
        default: ['q3']
      },
      input: {
        type: 'string',
        label: 'Input String',
        description: 'String to process',
        default: 'aab'
      }
    });

    this.setDescription('Non-deterministic Finite Automaton: Multiple transitions possible per symbol. Explores all paths simultaneously.');
    this.setComplexity('O(n × |Q|²)', 'O(|Q|)');
  }

  doGenerate(inputs) {
    const { states, alphabet, transitions, startState, acceptStates, input } = inputs;
    const steps = [];
    let stepNum = 1;

    const automaton = {
      states,
      alphabet,
      transitions,
      startState,
      acceptStates
    };

    // Helper to get epsilon closure
    const getEpsilonClosure = (stateSet) => {
      const closure = new Set(stateSet);
      const stack = [...stateSet];

      while (stack.length > 0) {
        const state = stack.pop();
        const epsilonKey = `${state},ε`;
        const epsilonTransitions = transitions[epsilonKey] || [];

        for (const nextState of epsilonTransitions) {
          if (!closure.has(nextState)) {
            closure.add(nextState);
            stack.push(nextState);
          }
        }
      }

      return closure;
    };

    // Initial state (with epsilon closure)
    let currentStates = getEpsilonClosure(new Set([startState]));

    steps.push(this.createStep(
      stepNum++,
      {
        automaton,
        input,
        currentStates: [...currentStates],
        position: -1,
        variables: {
          inputLength: input.length,
          totalStates: states.length,
          acceptStates: acceptStates.join(', ')
        }
      },
      {
        currentStates: [...currentStates],
        isStart: true
      },
      'start',
      `NFA: Process "${input}". Accept states: {${acceptStates.join(', ')}}`
    ));

    // Show initial epsilon closure if different from start
    if (currentStates.size > 1) {
      steps.push(this.createStep(
        stepNum++,
        {
          automaton,
          input,
          currentStates: [...currentStates],
          position: -1,
          variables: { epsilonClosure: [...currentStates].join(', ') }
        },
        {
          currentStates: [...currentStates],
          epsilonClosure: true
        },
        'epsilon_closure',
        `ε-closure({${startState}}) = {${[...currentStates].join(', ')}}`
      ));
    }

    const inputArray = input.split('');

    // Process each symbol
    for (let i = 0; i < inputArray.length; i++) {
      const symbol = inputArray[i];

      // Show current position
      steps.push(this.createStep(
        stepNum++,
        {
          automaton,
          input,
          currentStates: [...currentStates],
          position: i,
          variables: {
            symbol,
            activeStates: currentStates.size
          }
        },
        {
          currentStates: [...currentStates],
          position: i,
          symbol
        },
        'read_symbol',
        `Read '${symbol}' at position ${i}. Active states: {${[...currentStates].join(', ')}}`
      ));

      // Compute next states
      const nextStates = new Set();
      const transitionDetails = [];

      for (const state of currentStates) {
        const transitionKey = `${state},${symbol}`;
        const destinations = transitions[transitionKey] || [];

        for (const dest of destinations) {
          nextStates.add(dest);
          transitionDetails.push({ from: state, symbol, to: dest });
        }
      }

      if (nextStates.size === 0) {
        // No transitions available
        steps.push(this.createStep(
          stepNum++,
          {
            automaton,
            input,
            currentStates: [],
            position: i,
            variables: { dead: true, symbol }
          },
          {
            currentStates: [],
            dead: true,
            position: i
          },
          'dead',
          `No transitions for '${symbol}' from any active state. All paths dead.`
        ));

        steps.push(this.createStep(
          stepNum,
          {
            automaton,
            input,
            currentStates: [],
            position: i,
            variables: { result: 'REJECTED', reason: 'No valid paths' }
          },
          {
            rejected: true,
            dead: true
          },
          'reject',
          `Result: REJECTED - No computation path survives`
        ));

        return this.buildIR(inputs, { automaton, input }, steps);
      }

      // Show transitions
      steps.push(this.createStep(
        stepNum++,
        {
          automaton,
          input,
          currentStates: [...nextStates],
          position: i,
          variables: {
            transitions: transitionDetails.map(t => `δ(${t.from},${t.symbol})→${t.to}`).join(', ')
          }
        },
        {
          currentStates: [...nextStates],
          previousStates: [...currentStates],
          transitions: transitionDetails,
          position: i
        },
        'transition',
        `Transitions: ${transitionDetails.map(t => `δ(${t.from},${symbol})∋${t.to}`).join(', ')}`
      ));

      // Apply epsilon closure
      const afterEpsilon = getEpsilonClosure(nextStates);

      if (afterEpsilon.size > nextStates.size) {
        steps.push(this.createStep(
          stepNum++,
          {
            automaton,
            input,
            currentStates: [...afterEpsilon],
            position: i,
            variables: {
              beforeEpsilon: [...nextStates].join(', '),
              afterEpsilon: [...afterEpsilon].join(', ')
            }
          },
          {
            currentStates: [...afterEpsilon],
            epsilonClosure: true
          },
          'epsilon_closure',
          `ε-closure: {${[...nextStates].join(', ')}} → {${[...afterEpsilon].join(', ')}}`
        ));
      }

      currentStates = afterEpsilon;
    }

    // Check if any final state is accepting
    const acceptingFinal = [...currentStates].filter(s => acceptStates.includes(s));
    const isAccepted = acceptingFinal.length > 0;

    steps.push(this.createStep(
      stepNum++,
      {
        automaton,
        input,
        currentStates: [...currentStates],
        position: input.length,
        variables: {
          finalStates: [...currentStates].join(', '),
          acceptingFinal: acceptingFinal.join(', ') || 'none'
        }
      },
      {
        currentStates: [...currentStates],
        checking: true,
        acceptingStates: acceptingFinal
      },
      'check_accept',
      `Final states: {${[...currentStates].join(', ')}}. Accepting: {${acceptingFinal.join(', ') || 'none'}}`
    ));

    // Final result
    steps.push(this.createStep(
      stepNum,
      {
        automaton,
        input,
        currentStates: [...currentStates],
        position: input.length,
        variables: {
          result: isAccepted ? 'ACCEPTED' : 'REJECTED',
          acceptingPaths: acceptingFinal.length
        }
      },
      {
        currentStates: [...currentStates],
        complete: true,
        accepted: isAccepted,
        acceptingStates: acceptingFinal
      },
      'complete',
      `Result: ${isAccepted ? 'ACCEPTED' : 'REJECTED'} - ${isAccepted ? `${acceptingFinal.length} accepting path(s)` : 'No accepting paths'}`
    ));

    return this.buildIR(inputs, { automaton, input }, steps);
  }
}

// Register the generator
registry.register(new NFAGenerator());

export default NFAGenerator;
