/**
 * Flood Fill Generator
 * Generates step-by-step simulation of flood fill algorithm
 * Used in paint bucket tools, image processing, and game board filling
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class FloodFillGenerator extends BaseGenerator {
  constructor() {
    super('flood_fill', 'grid', 'Flood Fill', {
      grid: {
        type: 'grid',
        label: 'Grid',
        description: 'A 2D grid with values (0 = empty, 1 = wall)',
        default: {
          rows: 8,
          cols: 8,
          cells: [
            [0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 1, 1],
            [1, 1, 1, 1, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 1, 0],
            [0, 0, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0]
          ]
        }
      },
      startRow: {
        type: 'number',
        label: 'Start Row',
        description: 'Row to start filling from (0-indexed)',
        default: 0,
        validation: { min: 0, max: 19 }
      },
      startCol: {
        type: 'number',
        label: 'Start Column',
        description: 'Column to start filling from (0-indexed)',
        default: 0,
        validation: { min: 0, max: 19 }
      },
      fillValue: {
        type: 'number',
        label: 'Fill Value',
        description: 'Value to fill with',
        default: 2,
        validation: { min: 2, max: 9 }
      }
    });

    this.setDescription('Fill connected regions with a new value using BFS. Used in paint tools and game development.');
    this.setComplexity('O(m×n)', 'O(m×n)');
  }

  doGenerate(inputs) {
    const { grid: inputGrid, startRow, startCol, fillValue } = inputs;

    // Deep clone the grid
    const grid = inputGrid.cells.map(row => [...row]);
    const rows = grid.length;
    const cols = grid[0].length;

    const steps = [];
    let stepNum = 1;

    // Validate start position
    if (startRow >= rows || startCol >= cols) {
      steps.push(this.createStep(
        stepNum++,
        { grid, error: true },
        {},
        'error',
        `Invalid start position (${startRow}, ${startCol}) for grid of size ${rows}×${cols}`
      ));
      return this.buildIR(inputs, { grid: inputGrid }, steps);
    }

    const originalValue = grid[startRow][startCol];

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        grid: grid.map(r => [...r]),
        variables: { startRow, startCol, originalValue, fillValue, filled: 0 }
      },
      { start: { row: startRow, col: startCol } },
      'start',
      `Starting Flood Fill at (${startRow}, ${startCol}). Original value: ${originalValue}, Fill with: ${fillValue}`
    ));

    // Check if fill is needed
    if (originalValue === fillValue) {
      steps.push(this.createStep(
        stepNum++,
        { grid: grid.map(r => [...r]), variables: { filled: 0 } },
        { start: { row: startRow, col: startCol } },
        'no_fill_needed',
        `Cell already has the fill value (${fillValue}). No filling needed.`
      ));
      return this.buildIR(inputs, { grid: inputGrid }, steps);
    }

    // BFS flood fill
    const queue = [{ row: startRow, col: startCol }];
    const visited = new Set();
    visited.add(`${startRow},${startCol}`);
    let filledCount = 0;

    // Direction vectors for 4-connected neighbors
    const directions = [
      { dr: -1, dc: 0, name: 'up' },
      { dr: 1, dc: 0, name: 'down' },
      { dr: 0, dc: -1, name: 'left' },
      { dr: 0, dc: 1, name: 'right' }
    ];

    steps.push(this.createStep(
      stepNum++,
      {
        grid: grid.map(r => [...r]),
        variables: { queueSize: 1, filled: 0 }
      },
      {
        queue: [{ row: startRow, col: startCol }],
        current: { row: startRow, col: startCol }
      },
      'init_queue',
      `Initialize queue with starting cell (${startRow}, ${startCol})`
    ));

    while (queue.length > 0) {
      const { row, col } = queue.shift();

      // Fill current cell
      if (grid[row][col] === originalValue) {
        grid[row][col] = fillValue;
        filledCount++;

        steps.push(this.createStep(
          stepNum++,
          {
            grid: grid.map(r => [...r]),
            variables: { row, col, queueSize: queue.length, filled: filledCount }
          },
          {
            current: { row, col },
            filled: this.getFilledCells(grid, fillValue),
            queue: queue.map(q => ({ row: q.row, col: q.col }))
          },
          'fill',
          `Fill cell (${row}, ${col}) with value ${fillValue}. Total filled: ${filledCount}`
        ));
      }

      // Check neighbors
      const neighbors = [];
      for (const { dr, dc, name } of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        const key = `${newRow},${newCol}`;

        // Check bounds
        if (newRow < 0 || newRow >= rows || newCol < 0 || newCol >= cols) {
          continue;
        }

        // Check if already visited
        if (visited.has(key)) {
          continue;
        }

        // Check if can be filled (has original value)
        if (grid[newRow][newCol] === originalValue) {
          visited.add(key);
          queue.push({ row: newRow, col: newCol });
          neighbors.push({ row: newRow, col: newCol, direction: name });
        }
      }

      if (neighbors.length > 0) {
        steps.push(this.createStep(
          stepNum++,
          {
            grid: grid.map(r => [...r]),
            variables: { row, col, neighborsFound: neighbors.length, queueSize: queue.length }
          },
          {
            current: { row, col },
            filled: this.getFilledCells(grid, fillValue),
            queue: queue.map(q => ({ row: q.row, col: q.col })),
            checking: neighbors
          },
          'add_neighbors',
          `Found ${neighbors.length} fillable neighbor(s). Queue size: ${queue.length}`
        ));
      }
    }

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        grid: grid.map(r => [...r]),
        variables: { totalFilled: filledCount }
      },
      {
        filled: this.getFilledCells(grid, fillValue),
        complete: true
      },
      'complete',
      `Flood Fill complete! Filled ${filledCount} cells.`
    ));

    return this.buildIR(inputs, { grid: inputGrid }, steps);
  }

  // Helper to get all filled cells
  getFilledCells(grid, fillValue) {
    const filled = [];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === fillValue) {
          filled.push({ row: r, col: c });
        }
      }
    }
    return filled;
  }
}

// Register the generator
registry.register(new FloodFillGenerator());

export default FloodFillGenerator;
