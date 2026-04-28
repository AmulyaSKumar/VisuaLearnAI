/**
 * Fibonacci DP Generator
 * Generates step-by-step visualization of Fibonacci using dynamic programming
 * Shows memoization table building process
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class FibonacciDPGenerator extends BaseGenerator {
  constructor() {
    super('dp_fibonacci', 'dp', 'Fibonacci (DP)', {
      n: {
        type: 'number',
        label: 'N',
        description: 'Calculate Fibonacci(N)',
        default: 10,
        validation: { min: 1, max: 20 }
      }
    });

    this.setDescription('Calculate Fibonacci numbers using bottom-up dynamic programming with memoization table.');
    this.setComplexity('O(n)', 'O(n)');
  }

  doGenerate(inputs) {
    const { n } = inputs;
    const steps = [];
    let stepNum = 1;

    // DP table
    const dp = new Array(n + 1).fill(null);

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        dp: [...dp],
        variables: { n, computing: null }
      },
      { table: [...dp] },
      'start',
      `Calculate Fibonacci(${n}) using Dynamic Programming`
    ));

    // Base cases
    dp[0] = 0;
    steps.push(this.createStep(
      stepNum++,
      {
        dp: [...dp],
        variables: { n, computing: 0 }
      },
      { current: 0, filled: [0] },
      'base_case',
      `Base case: F(0) = 0`
    ));

    if (n >= 1) {
      dp[1] = 1;
      steps.push(this.createStep(
        stepNum++,
        {
          dp: [...dp],
          variables: { n, computing: 1 }
        },
        { current: 1, filled: [0, 1] },
        'base_case',
        `Base case: F(1) = 1`
      ));
    }

    // Fill DP table
    for (let i = 2; i <= n; i++) {
      // Show which cells we're looking at
      steps.push(this.createStep(
        stepNum++,
        {
          dp: [...dp],
          variables: { n, computing: i, looking: [i - 1, i - 2] }
        },
        {
          current: i,
          dependencies: [i - 1, i - 2],
          filled: dp.map((v, idx) => v !== null ? idx : null).filter(x => x !== null)
        },
        'compute_deps',
        `Computing F(${i}): Need F(${i - 1}) = ${dp[i - 1]} and F(${i - 2}) = ${dp[i - 2]}`
      ));

      // Compute and store
      dp[i] = dp[i - 1] + dp[i - 2];

      steps.push(this.createStep(
        stepNum++,
        {
          dp: [...dp],
          variables: { n, computing: i, result: dp[i] }
        },
        {
          current: i,
          justFilled: i,
          filled: dp.map((v, idx) => v !== null ? idx : null).filter(x => x !== null)
        },
        'fill',
        `F(${i}) = F(${i - 1}) + F(${i - 2}) = ${dp[i - 1]} + ${dp[i - 2]} = ${dp[i]}`
      ));
    }

    // Final result
    steps.push(this.createStep(
      stepNum,
      {
        dp: [...dp],
        variables: { n, result: dp[n] }
      },
      {
        result: n,
        filled: dp.map((v, idx) => v !== null ? idx : null).filter(x => x !== null),
        complete: true
      },
      'complete',
      `Complete! Fibonacci(${n}) = ${dp[n]}`
    ));

    return this.buildIR(inputs, { dp: new Array(n + 1).fill(null) }, steps);
  }
}

// Register the generator
registry.register(new FibonacciDPGenerator());

export default FibonacciDPGenerator;
