/**
 * Edit Distance (Levenshtein Distance) Generator
 * Generates step-by-step visualization of edit distance using DP
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class EditDistanceGenerator extends BaseGenerator {
  constructor() {
    super('edit_distance', 'dp', 'Edit Distance (Levenshtein)', {
      string1: {
        type: 'string',
        label: 'String 1',
        description: 'Source string',
        default: 'kitten'
      },
      string2: {
        type: 'string',
        label: 'String 2',
        description: 'Target string',
        default: 'sitting'
      }
    });

    this.setDescription('Find minimum operations (insert, delete, replace) to transform one string to another.');
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
      `Edit Distance: Transform "${string1}" to "${string2}"`
    ));

    // Initialize first row (insert all characters of string2)
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    steps.push(this.createStep(
      stepNum++,
      {
        string1,
        string2,
        dp: dp.map(row => [...row]),
        variables: { phase: 'init_row', meaning: 'Insert j characters to empty string' }
      },
      { dp: dp.map(row => [...row]), initRow: true },
      'init_row',
      `Initialize first row: dp[0][j] = j (j insertions to transform "" to string2[0..j])`
    ));

    // Initialize first column (delete all characters of string1)
    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
    }

    steps.push(this.createStep(
      stepNum++,
      {
        string1,
        string2,
        dp: dp.map(row => [...row]),
        variables: { phase: 'init_col', meaning: 'Delete i characters from string1' }
      },
      { dp: dp.map(row => [...row]), initCol: true },
      'init_col',
      `Initialize first column: dp[i][0] = i (i deletions to transform string1[0..i] to "")`
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
              comparing: `'${char1}' vs '${char2}'`
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
          // Characters match, no operation needed
          dp[i][j] = dp[i - 1][j - 1];

          steps.push(this.createStep(
            stepNum++,
            {
              string1,
              string2,
              dp: dp.map(row => [...row]),
              variables: {
                match: true,
                operation: 'none',
                formula: `dp[${i}][${j}] = dp[${i-1}][${j-1}] = ${dp[i][j]}`
              }
            },
            {
              dp: dp.map(row => [...row]),
              updated: { i, j },
              operation: 'match',
              source: { i: i-1, j: j-1 }
            },
            'match',
            `Match! No operation. dp[${i}][${j}] = dp[${i-1}][${j-1}] = ${dp[i][j]}`
          ));
        } else {
          // Calculate costs of three operations
          const insertCost = dp[i][j - 1] + 1;
          const deleteCost = dp[i - 1][j] + 1;
          const replaceCost = dp[i - 1][j - 1] + 1;

          dp[i][j] = Math.min(insertCost, deleteCost, replaceCost);

          let operation = 'replace';
          let source = { i: i-1, j: j-1 };
          if (dp[i][j] === insertCost) {
            operation = 'insert';
            source = { i, j: j-1 };
          } else if (dp[i][j] === deleteCost) {
            operation = 'delete';
            source = { i: i-1, j };
          }

          steps.push(this.createStep(
            stepNum++,
            {
              string1,
              string2,
              dp: dp.map(row => [...row]),
              variables: {
                match: false,
                insertCost,
                deleteCost,
                replaceCost,
                chosen: operation,
                formula: `dp[${i}][${j}] = min(${insertCost}, ${deleteCost}, ${replaceCost}) = ${dp[i][j]}`
              }
            },
            {
              dp: dp.map(row => [...row]),
              updated: { i, j },
              operation,
              source,
              costs: { insert: insertCost, delete: deleteCost, replace: replaceCost }
            },
            'operation',
            `No match. Costs: Insert=${insertCost}, Delete=${deleteCost}, Replace=${replaceCost}. Choose ${operation}: ${dp[i][j]}`
          ));
        }
      }
    }

    // Backtrack to find operations
    const operations = [];
    let i = m, j = n;

    steps.push(this.createStep(
      stepNum++,
      {
        string1,
        string2,
        dp: dp.map(row => [...row]),
        variables: { phase: 'backtracking', editDistance: dp[m][n] }
      },
      { dp: dp.map(row => [...row]), backtracking: true },
      'backtrack_start',
      `Edit distance is ${dp[m][n]}. Backtracking to find operations...`
    ));

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && string1[i - 1] === string2[j - 1]) {
        operations.unshift({ type: 'match', char: string1[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j] === dp[i][j - 1] + 1)) {
        operations.unshift({ type: 'insert', char: string2[j - 1] });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
        operations.unshift({ type: 'delete', char: string1[i - 1] });
        i--;
      } else {
        operations.unshift({ type: 'replace', from: string1[i - 1], to: string2[j - 1] });
        i--;
        j--;
      }
    }

    const opStrings = operations.map(op => {
      if (op.type === 'match') return `keep '${op.char}'`;
      if (op.type === 'insert') return `insert '${op.char}'`;
      if (op.type === 'delete') return `delete '${op.char}'`;
      return `replace '${op.from}' → '${op.to}'`;
    });

    steps.push(this.createStep(
      stepNum++,
      {
        string1,
        string2,
        dp: dp.map(row => [...row]),
        operations,
        variables: {
          operationSequence: opStrings.join(', ')
        }
      },
      { dp: dp.map(row => [...row]), operations, path: true },
      'operations',
      `Operations: ${opStrings.join(' → ')}`
    ));

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        string1,
        string2,
        dp: dp.map(row => [...row]),
        operations,
        variables: {
          complete: true,
          editDistance: dp[m][n],
          operations: opStrings.filter(s => !s.startsWith('keep')).length
        }
      },
      {
        dp: dp.map(row => [...row]),
        complete: true,
        editDistance: dp[m][n],
        operations
      },
      'complete',
      `Complete! Edit distance from "${string1}" to "${string2}" is ${dp[m][n]}`
    ));

    return this.buildIR(inputs, { dp: [], strings: [string1, string2] }, steps);
  }
}

// Register the generator
registry.register(new EditDistanceGenerator());

export default EditDistanceGenerator;
