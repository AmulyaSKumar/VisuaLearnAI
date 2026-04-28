/**
 * A* Pathfinding Generator
 * Generates step-by-step simulation of A* pathfinding algorithm
 * Finds the shortest path between two points in a grid
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class AStarGenerator extends BaseGenerator {
  constructor() {
    super('a_star', 'grid', 'A* Pathfinding', {
      grid: {
        type: 'grid',
        label: 'Grid',
        description: 'A 2D grid (0 = walkable, 1 = wall)',
        default: {
          rows: 8,
          cols: 10,
          cells: [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0, 1, 0],
            [0, 1, 1, 1, 0, 1, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          ]
        }
      },
      startRow: {
        type: 'number',
        label: 'Start Row',
        description: 'Starting row (0-indexed)',
        default: 0,
        validation: { min: 0, max: 19 }
      },
      startCol: {
        type: 'number',
        label: 'Start Column',
        description: 'Starting column (0-indexed)',
        default: 0,
        validation: { min: 0, max: 19 }
      },
      endRow: {
        type: 'number',
        label: 'End Row',
        description: 'Target row (0-indexed)',
        default: 7,
        validation: { min: 0, max: 19 }
      },
      endCol: {
        type: 'number',
        label: 'End Column',
        description: 'Target column (0-indexed)',
        default: 9,
        validation: { min: 0, max: 19 }
      }
    });

    this.setDescription('Find shortest path using heuristic-guided search. Combines best features of Dijkstra and Greedy BFS.');
    this.setComplexity('O(E log V)', 'O(V)');
  }

  doGenerate(inputs) {
    const { grid: inputGrid, startRow, startCol, endRow, endCol } = inputs;

    const grid = inputGrid.cells.map(row => [...row]);
    const rows = grid.length;
    const cols = grid[0].length;

    const steps = [];
    let stepNum = 1;

    // Validate positions
    if (startRow >= rows || startCol >= cols || endRow >= rows || endCol >= cols) {
      steps.push(this.createStep(
        stepNum++,
        { grid, error: true },
        {},
        'error',
        `Invalid positions for grid of size ${rows}×${cols}`
      ));
      return this.buildIR(inputs, { grid: inputGrid }, steps);
    }

    if (grid[startRow][startCol] === 1 || grid[endRow][endCol] === 1) {
      steps.push(this.createStep(
        stepNum++,
        { grid, error: true },
        { start: { row: startRow, col: startCol }, end: { row: endRow, col: endCol } },
        'error',
        `Start or end position is blocked by a wall!`
      ));
      return this.buildIR(inputs, { grid: inputGrid }, steps);
    }

    // Heuristic function (Manhattan distance)
    const heuristic = (r, c) => Math.abs(r - endRow) + Math.abs(c - endCol);

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        grid: grid.map(r => [...r]),
        variables: {
          start: `(${startRow},${startCol})`,
          end: `(${endRow},${endCol})`,
          heuristic: 'Manhattan Distance'
        }
      },
      {
        start: { row: startRow, col: startCol },
        end: { row: endRow, col: endCol }
      },
      'start',
      `A* Pathfinding: Find path from (${startRow},${startCol}) to (${endRow},${endCol})`
    ));

    // Data structures
    const openSet = new Map(); // key -> { row, col, g, h, f, parent }
    const closedSet = new Set();
    const cameFrom = new Map();

    // Initialize start node
    const startKey = `${startRow},${startCol}`;
    const startH = heuristic(startRow, startCol);
    openSet.set(startKey, {
      row: startRow,
      col: startCol,
      g: 0,
      h: startH,
      f: startH,
      parent: null
    });

    steps.push(this.createStep(
      stepNum++,
      {
        grid: grid.map(r => [...r]),
        variables: { g: 0, h: startH, f: startH }
      },
      {
        start: { row: startRow, col: startCol },
        end: { row: endRow, col: endCol },
        openSet: [{ row: startRow, col: startCol, f: startH }],
        current: { row: startRow, col: startCol }
      },
      'init',
      `Initialize: g=0, h=${startH} (distance to goal), f=g+h=${startH}`
    ));

    // Direction vectors (4-connected)
    const directions = [
      { dr: -1, dc: 0, name: 'up' },
      { dr: 1, dc: 0, name: 'down' },
      { dr: 0, dc: -1, name: 'left' },
      { dr: 0, dc: 1, name: 'right' }
    ];

    let found = false;
    let iterations = 0;
    const maxIterations = rows * cols * 2;

    while (openSet.size > 0 && iterations < maxIterations) {
      iterations++;

      // Find node with lowest f score
      let current = null;
      let currentKey = null;
      let lowestF = Infinity;

      for (const [key, node] of openSet) {
        if (node.f < lowestF) {
          lowestF = node.f;
          current = node;
          currentKey = key;
        }
      }

      if (!current) break;

      // Remove from open set, add to closed set
      openSet.delete(currentKey);
      closedSet.add(currentKey);

      steps.push(this.createStep(
        stepNum++,
        {
          grid: grid.map(r => [...r]),
          variables: {
            currentPos: `(${current.row},${current.col})`,
            g: current.g,
            h: current.h,
            f: current.f,
            openSetSize: openSet.size,
            closedSetSize: closedSet.size
          }
        },
        {
          start: { row: startRow, col: startCol },
          end: { row: endRow, col: endCol },
          current: { row: current.row, col: current.col },
          openSet: Array.from(openSet.values()).map(n => ({ row: n.row, col: n.col, f: n.f })),
          closedSet: this.parseClosedSet(closedSet)
        },
        'explore',
        `Exploring (${current.row},${current.col}): f=${current.f} (g=${current.g} + h=${current.h})`
      ));

      // Check if we reached the goal
      if (current.row === endRow && current.col === endCol) {
        found = true;

        // Reconstruct path
        const path = [];
        let pathNode = current;
        while (pathNode) {
          path.unshift({ row: pathNode.row, col: pathNode.col });
          const parentKey = cameFrom.get(`${pathNode.row},${pathNode.col}`);
          pathNode = parentKey ? { row: parseInt(parentKey.split(',')[0]), col: parseInt(parentKey.split(',')[1]) } : null;
          if (pathNode && pathNode.row === startRow && pathNode.col === startCol) {
            path.unshift({ row: startRow, col: startCol });
            break;
          }
        }

        steps.push(this.createStep(
          stepNum++,
          {
            grid: grid.map(r => [...r]),
            variables: { pathLength: path.length, totalCost: current.g }
          },
          {
            start: { row: startRow, col: startCol },
            end: { row: endRow, col: endCol },
            path,
            closedSet: this.parseClosedSet(closedSet),
            found: true
          },
          'found',
          `Path found! Length: ${path.length} cells, Total cost: ${current.g}`
        ));

        break;
      }

      // Explore neighbors
      for (const { dr, dc, name } of directions) {
        const newRow = current.row + dr;
        const newCol = current.col + dc;
        const neighborKey = `${newRow},${newCol}`;

        // Check bounds
        if (newRow < 0 || newRow >= rows || newCol < 0 || newCol >= cols) {
          continue;
        }

        // Check if wall or already closed
        if (grid[newRow][newCol] === 1 || closedSet.has(neighborKey)) {
          continue;
        }

        const tentativeG = current.g + 1;
        const existingNode = openSet.get(neighborKey);

        if (!existingNode || tentativeG < existingNode.g) {
          const h = heuristic(newRow, newCol);
          const f = tentativeG + h;

          openSet.set(neighborKey, {
            row: newRow,
            col: newCol,
            g: tentativeG,
            h,
            f,
            parent: currentKey
          });

          cameFrom.set(neighborKey, currentKey);

          if (!existingNode) {
            steps.push(this.createStep(
              stepNum++,
              {
                grid: grid.map(r => [...r]),
                variables: {
                  neighbor: `(${newRow},${newCol})`,
                  direction: name,
                  g: tentativeG,
                  h,
                  f
                }
              },
              {
                start: { row: startRow, col: startCol },
                end: { row: endRow, col: endCol },
                current: { row: current.row, col: current.col },
                openSet: Array.from(openSet.values()).map(n => ({ row: n.row, col: n.col, f: n.f })),
                closedSet: this.parseClosedSet(closedSet),
                checking: { row: newRow, col: newCol }
              },
              'add_neighbor',
              `Add ${name} neighbor (${newRow},${newCol}): g=${tentativeG}, h=${h}, f=${f}`
            ));
          }
        }
      }
    }

    if (!found) {
      steps.push(this.createStep(
        stepNum,
        {
          grid: grid.map(r => [...r]),
          variables: { explored: closedSet.size }
        },
        {
          start: { row: startRow, col: startCol },
          end: { row: endRow, col: endCol },
          closedSet: this.parseClosedSet(closedSet),
          noPath: true
        },
        'no_path',
        `No path found! Explored ${closedSet.size} cells.`
      ));
    }

    return this.buildIR(inputs, { grid: inputGrid }, steps);
  }

  // Helper to parse closed set into array of coordinates
  parseClosedSet(closedSet) {
    return Array.from(closedSet).map(key => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    });
  }
}

// Register the generator
registry.register(new AStarGenerator());

export default AStarGenerator;
