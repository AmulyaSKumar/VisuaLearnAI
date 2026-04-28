/**
 * Longest Common Subsequence (LCS) Generator
 * Generates step-by-step visualization of LCS using dynamic programming
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class LCSGenerator extends BaseGenerator {
  constructor() {
    super('lcs', 'dp', 'Longest Common Subsequence', {
      string1: {
        type: 'string',
        label: 'String 1',
        description: 'First string',
        default: 'ABCDGH'
      },
      string2: {
        type: 'string',
        label: 'String 2',
        description: 'Second string',
        default: 'AEDFHR'
      }
    });

    this.setDescription('Find the longest subsequence common to both strings using dynamic programming.');
    this.setComplexity('O(m×n)', 'O(m×n)');
  }

  doGenerate(inputs) {
    const { string1, string2 } = inputs;
    const m = string1.length;
    const n = string2.length;
    const steps = [];
    let stepNum = 1;

    // Create DP table
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        string1,
        string2,
        dp: dp.map(row => [...row]),
        variables: { m, n, phase: 'initialization' }
      },
      { dp: dp.map(row => [...row]), strings: [string1, string2] },
      'start',
      `LCS: Find longest common subsequence of "${string1}" and "${string2}"`
    ));

    // Fill the DP table
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const char1 = string1[i - 1];
        const char2 = string2[j - 1];

        steps.push(this.createStep(
          stepNum++,
          {
            string1,
            string2,
            dp: dp.map(row => [...row]),
            variables: {
              i, j,
              char1, char2,
              comparing: `${char1} vs ${char2}`
            }
          },
          {
            dp: dp.map(row => [...row]),
            comparing: { i, j, char1, char2 }
          },
          'compare',
          `Compare string1[${i-1}]='${char1}' with string2[${j-1}]='${char2}'`
        ));

        if (char1 === char2) {
          dp[i][j] = dp[i - 1][j - 1] + 1;

          steps.push(this.createStep(
            stepNum++,
            {
              string1,
              string2,
              dp: dp.map(row => [...row]),
              variables: {
                match: true,
                formula: `dp[${i}][${j}] = dp[${i-1}][${j-1}] + 1 = ${dp[i][j]}`
              }
            },
            {
              dp: dp.map(row => [...row]),
              updated: { i, j },
              match: true,
              diagonal: { i: i-1, j: j-1 }
            },
            'match',
            `Match! dp[${i}][${j}] = dp[${i-1}][${j-1}] + 1 = ${dp[i][j]}`
          ));
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);

          steps.push(this.createStep(
            stepNum++,
            {
              string1,
              string2,
              dp: dp.map(row => [...row]),
              variables: {
                match: false,
                formula: `dp[${i}][${j}] = max(dp[${i-1}][${j}], dp[${i}][${j-1}]) = max(${dp[i-1][j]}, ${dp[i][j-1]}) = ${dp[i][j]}`
              }
            },
            {
              dp: dp.map(row => [...row]),
              updated: { i, j },
              match: false,
              choices: [{ i: i-1, j }, { i, j: j-1 }]
            },
            'no_match',
            `No match. dp[${i}][${j}] = max(${dp[i-1][j]}, ${dp[i][j-1]}) = ${dp[i][j]}`
          ));
        }
      }
    }

    // Backtrack to find LCS
    let lcs = '';
    let i = m, j = n;
    const backtrackPath = [];

    steps.push(this.createStep(
      stepNum++,
      {
        string1,
        string2,
        dp: dp.map(row => [...row]),
        variables: { phase: 'backtracking', lcsLength: dp[m][n] }
      },
      { dp: dp.map(row => [...row]), backtracking: true },
      'backtrack_start',
      `LCS length is ${dp[m][n]}. Backtracking to find the actual subsequence...`
    ));

    while (i > 0 && j > 0) {
      backtrackPath.push({ i, j });

      if (string1[i - 1] === string2[j - 1]) {
        lcs = string1[i - 1] + lcs;

        steps.push(this.createStep(
          stepNum++,
          {
            string1,
            string2,
            dp: dp.map(row => [...row]),
            variables: {
              i, j,
              char: string1[i - 1],
              lcs,
              action: 'add_char'
            }
          },
          {
            dp: dp.map(row => [...row]),
            backtrack: { i, j },
            direction: 'diagonal',
            lcs
          },
          'backtrack_add',
          `Add '${string1[i - 1]}' to LCS. Current LCS: "${lcs}". Move diagonal.`
        ));

        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        steps.push(this.createStep(
          stepNum++,
          {
            string1,
            string2,
            dp: dp.map(row => [...row]),
            variables: { i, j, lcs, action: 'move_up' }
          },
          {
            dp: dp.map(row => [...row]),
            backtrack: { i, j },
            direction: 'up',
            lcs
          },
          'backtrack_up',
          `dp[${i-1}][${j}] > dp[${i}][${j-1}]. Move up.`
        ));
        i--;
      } else {
        steps.push(this.createStep(
          stepNum++,
          {
            string1,
            string2,
            dp: dp.map(row => [...row]),
            variables: { i, j, lcs, action: 'move_left' }
          },
          {
            dp: dp.map(row => [...row]),
            backtrack: { i, j },
            direction: 'left',
            lcs
          },
          'backtrack_left',
          `dp[${i}][${j-1}] >= dp[${i-1}][${j}]. Move left.`
        ));
        j--;
      }
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        string1,
        string2,
        dp: dp.map(row => [...row]),
        lcs,
        variables: {
          complete: true,
          lcsLength: lcs.length,
          lcs
        }
      },
      {
        dp: dp.map(row => [...row]),
        complete: true,
        lcs,
        path: backtrackPath
      },
      'complete',
      `Complete! LCS of "${string1}" and "${string2}" is "${lcs}" (length ${lcs.length})`
    ));

    return this.buildIR(inputs, { dp: [], strings: [string1, string2] }, steps);
  }
}

// Register the generator
registry.register(new LCSGenerator());

export default LCSGenerator;
