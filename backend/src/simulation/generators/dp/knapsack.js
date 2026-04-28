/**
 * 0/1 Knapsack DP Generator
 * Generates step-by-step visualization of the knapsack problem
 * Shows 2D DP table building process
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class KnapsackDPGenerator extends BaseGenerator {
  constructor() {
    super('dp_knapsack', 'dp', '0/1 Knapsack (DP)', {
      weights: {
        type: 'array',
        label: 'Weights',
        description: 'Weight of each item',
        default: [2, 3, 4, 5],
        validation: { minLength: 1, maxLength: 8 }
      },
      values: {
        type: 'array',
        label: 'Values',
        description: 'Value of each item',
        default: [3, 4, 5, 6],
        validation: { minLength: 1, maxLength: 8 }
      },
      capacity: {
        type: 'number',
        label: 'Capacity',
        description: 'Knapsack capacity',
        default: 8,
        validation: { min: 1, max: 20 }
      }
    });

    this.setDescription('Solve 0/1 Knapsack using bottom-up DP. Find maximum value that fits in capacity.');
    this.setComplexity('O(n×W)', 'O(n×W)');
  }

  doGenerate(inputs) {
    const { weights, values, capacity } = inputs;
    const n = weights.length;
    const steps = [];
    let stepNum = 1;

    // Create items array for display
    const items = weights.map((w, i) => ({ id: i + 1, weight: w, value: values[i] }));

    // Initialize DP table (n+1 rows, capacity+1 columns)
    const dp = Array(n + 1).fill(null).map(() => Array(capacity + 1).fill(0));

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        dp: dp.map(row => [...row]),
        items,
        variables: { n, capacity, maxValue: 0 }
      },
      { items },
      'start',
      `0/1 Knapsack: ${n} items, capacity ${capacity}. Find maximum value.`
    ));

    // Show items
    steps.push(this.createStep(
      stepNum++,
      {
        dp: dp.map(row => [...row]),
        items,
        variables: { n, capacity }
      },
      { items, showItems: true },
      'show_items',
      `Items: ${items.map(it => `Item${it.id}(w=${it.weight}, v=${it.value})`).join(', ')}`
    ));

    // Fill DP table
    for (let i = 1; i <= n; i++) {
      const itemWeight = weights[i - 1];
      const itemValue = values[i - 1];

      steps.push(this.createStep(
        stepNum++,
        {
          dp: dp.map(row => [...row]),
          items,
          variables: { currentItem: i, weight: itemWeight, value: itemValue }
        },
        { currentRow: i, currentItem: i - 1 },
        'process_item',
        `Processing Item ${i}: weight=${itemWeight}, value=${itemValue}`
      ));

      for (let w = 1; w <= capacity; w++) {
        // Option 1: Don't take the item
        const dontTake = dp[i - 1][w];

        // Option 2: Take the item (if it fits)
        let take = 0;
        let canTake = false;
        if (itemWeight <= w) {
          take = itemValue + dp[i - 1][w - itemWeight];
          canTake = true;
        }

        // Choose maximum
        dp[i][w] = Math.max(dontTake, take);

        // Only show key steps to avoid too many steps
        if (w === capacity || (canTake && take > dontTake)) {
          steps.push(this.createStep(
            stepNum++,
            {
              dp: dp.map(row => [...row]),
              items,
              variables: {
                currentItem: i,
                currentCapacity: w,
                dontTake,
                take: canTake ? take : 'N/A',
                decision: dp[i][w] === take && canTake ? 'TAKE' : 'SKIP'
              }
            },
            {
              currentCell: { row: i, col: w },
              compareCell: canTake ? { row: i - 1, col: w - itemWeight } : null,
              prevCell: { row: i - 1, col: w },
              currentItem: i - 1
            },
            'fill_cell',
            canTake
              ? `dp[${i}][${w}] = max(${dontTake}, ${itemValue}+${dp[i - 1][w - itemWeight]}) = ${dp[i][w]}${dp[i][w] === take ? ' (Take!)' : ' (Skip)'}`
              : `dp[${i}][${w}] = ${dontTake} (Item too heavy)`
          ));
        }
      }
    }

    // Backtrack to find selected items
    const selected = [];
    let w = capacity;
    for (let i = n; i > 0 && w > 0; i--) {
      if (dp[i][w] !== dp[i - 1][w]) {
        selected.unshift(i);
        w -= weights[i - 1];
      }
    }

    steps.push(this.createStep(
      stepNum++,
      {
        dp: dp.map(row => [...row]),
        items,
        variables: { maxValue: dp[n][capacity], selectedItems: selected }
      },
      {
        resultCell: { row: n, col: capacity },
        selectedItems: selected.map(i => i - 1)
      },
      'backtrack',
      `Maximum value: ${dp[n][capacity]}. Selected items: ${selected.map(i => `Item${i}`).join(', ')}`
    ));

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        dp: dp.map(row => [...row]),
        items,
        variables: {
          maxValue: dp[n][capacity],
          selectedItems: selected,
          totalWeight: selected.reduce((sum, i) => sum + weights[i - 1], 0)
        }
      },
      {
        complete: true,
        selectedItems: selected.map(i => i - 1),
        resultCell: { row: n, col: capacity }
      },
      'complete',
      `Complete! Max value: ${dp[n][capacity]}, Items: [${selected.join(', ')}], Weight: ${selected.reduce((sum, i) => sum + weights[i - 1], 0)}/${capacity}`
    ));

    return this.buildIR(inputs, { dp: Array(n + 1).fill(null).map(() => Array(capacity + 1).fill(0)), items }, steps);
  }
}

// Register the generator
registry.register(new KnapsackDPGenerator());

export default KnapsackDPGenerator;
