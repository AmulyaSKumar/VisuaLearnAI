/**
 * Longest Increasing Subsequence (LIS) Generator
 * Generates step-by-step visualization of LIS using dynamic programming
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class LISGenerator extends BaseGenerator {
  constructor() {
    super('lis', 'dp', 'Longest Increasing Subsequence', {
      array: {
        type: 'array',
        label: 'Array',
        description: 'Input array of numbers',
        default: [10, 22, 9, 33, 21, 50, 41, 60, 80]
      }
    });

    this.setDescription('Find the length of longest strictly increasing subsequence.');
    this.setComplexity('O(n²)', 'O(n)');
  }

  doGenerate(inputs) {
    const { array } = inputs;
    const n = array.length;
    const steps = [];
    let stepNum = 1;

    // dp[i] = length of LIS ending at index i
    const dp = Array(n).fill(1);
    // prev[i] = previous index in LIS ending at i
    const prev = Array(n).fill(-1);

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        array,
        dp: [...dp],
        variables: { n, phase: 'initialization' }
      },
      { array, dp: [...dp] },
      'start',
      `LIS: Find longest increasing subsequence in [${array.join(', ')}]`
    ));

    steps.push(this.createStep(
      stepNum++,
      {
        array,
        dp: [...dp],
        variables: { initialized: 'dp[i] = 1 for all i (single element is LIS of length 1)' }
      },
      { array, dp: [...dp], initialized: true },
      'init',
      `Initialize: dp[i] = 1 for all i (each element alone is a subsequence of length 1)`
    ));

    // Fill DP table
    for (let i = 1; i < n; i++) {
      steps.push(this.createStep(
        stepNum++,
        {
          array,
          dp: [...dp],
          variables: { i, current: array[i], checking: 'all j < i' }
        },
        { array, dp: [...dp], current: i },
        'outer_loop',
        `Finding LIS ending at index ${i} (value ${array[i]})`
      ));

      for (let j = 0; j < i; j++) {
        steps.push(this.createStep(
          stepNum++,
          {
            array,
            dp: [...dp],
            variables: {
              i, j,
              arr_i: array[i],
              arr_j: array[j],
              comparing: `${array[j]} < ${array[i]}?`
            }
          },
          { array, dp: [...dp], comparing: { i, j } },
          'compare',
          `Compare: array[${j}]=${array[j]} < array[${i}]=${array[i]}?`
        ));

        if (array[j] < array[i]) {
          if (dp[j] + 1 > dp[i]) {
            const oldDp = dp[i];
            dp[i] = dp[j] + 1;
            prev[i] = j;

            steps.push(this.createStep(
              stepNum++,
              {
                array,
                dp: [...dp],
                variables: {
                  i, j,
                  update: `dp[${i}] = dp[${j}] + 1 = ${dp[i]}`,
                  old: oldDp,
                  new: dp[i]
                }
              },
              { array, dp: [...dp], updated: i, from: j },
              'update',
              `Yes! dp[${j}]+1=${dp[i]} > old dp[${i}]=${oldDp}. Update dp[${i}] = ${dp[i]}`
            ));
          } else {
            steps.push(this.createStep(
              stepNum++,
              {
                array,
                dp: [...dp],
                variables: {
                  i, j,
                  noUpdate: `dp[${j}]+1=${dp[j]+1} ≤ dp[${i}]=${dp[i]}, no update`
                }
              },
              { array, dp: [...dp], noUpdate: { i, j } },
              'no_update',
              `Yes, but dp[${j}]+1=${dp[j]+1} ≤ dp[${i}]=${dp[i]}. No update needed.`
            ));
          }
        } else {
          steps.push(this.createStep(
            stepNum++,
            {
              array,
              dp: [...dp],
              variables: {
                i, j,
                skip: `${array[j]} ≥ ${array[i]}, can't extend`
              }
            },
            { array, dp: [...dp], skip: { i, j } },
            'skip',
            `No. ${array[j]} ≥ ${array[i]}, can't extend LIS.`
          ));
        }
      }
    }

    // Find maximum LIS length and reconstruct
    let maxLen = 0;
    let maxIdx = 0;
    for (let i = 0; i < n; i++) {
      if (dp[i] > maxLen) {
        maxLen = dp[i];
        maxIdx = i;
      }
    }

    steps.push(this.createStep(
      stepNum++,
      {
        array,
        dp: [...dp],
        variables: {
          maxLength: maxLen,
          endingAt: maxIdx,
          phase: 'reconstruction'
        }
      },
      { array, dp: [...dp], maxIdx, maxLen },
      'find_max',
      `Maximum LIS length is ${maxLen}, ending at index ${maxIdx}`
    ));

    // Reconstruct LIS
    const lis = [];
    let idx = maxIdx;
    while (idx !== -1) {
      lis.unshift(array[idx]);
      idx = prev[idx];
    }

    steps.push(this.createStep(
      stepNum++,
      {
        array,
        dp: [...dp],
        lis,
        variables: {
          reconstructed: lis.join(' → ')
        }
      },
      { array, dp: [...dp], lis, path: true },
      'reconstruct',
      `Reconstructed LIS: [${lis.join(', ')}]`
    ));

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        array,
        dp: [...dp],
        lis,
        variables: {
          complete: true,
          lisLength: maxLen,
          lis: lis.join(', ')
        }
      },
      {
        array,
        dp: [...dp],
        lis,
        complete: true
      },
      'complete',
      `Complete! LIS of [${array.join(', ')}] is [${lis.join(', ')}] with length ${maxLen}`
    ));

    return this.buildIR(inputs, { array, dp: [] }, steps);
  }
}

// Register the generator
registry.register(new LISGenerator());

export default LISGenerator;
