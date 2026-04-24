/**
 * Key Mapper
 * Safe mapping of algorithm names/aliases to generator keys
 * Never trust raw LLM output - always map through this
 */

/**
 * Algorithm name aliases mapped to generator keys
 * Handles various naming conventions and common variations
 */
const ALGORITHM_ALIASES = {
  // Bubble Sort
  'bubble sort': 'bubble_sort',
  'bubblesort': 'bubble_sort',
  'bubble': 'bubble_sort',
  'bubble_sort': 'bubble_sort',

  // Quick Sort
  'quick sort': 'quick_sort',
  'quicksort': 'quick_sort',
  'quick': 'quick_sort',
  'quick_sort': 'quick_sort',
  'partition sort': 'quick_sort',

  // Merge Sort
  'merge sort': 'merge_sort',
  'mergesort': 'merge_sort',
  'merge': 'merge_sort',
  'merge_sort': 'merge_sort',

  // Insertion Sort
  'insertion sort': 'insertion_sort',
  'insertionsort': 'insertion_sort',
  'insertion': 'insertion_sort',
  'insertion_sort': 'insertion_sort',

  // Selection Sort
  'selection sort': 'selection_sort',
  'selectionsort': 'selection_sort',
  'selection': 'selection_sort',
  'selection_sort': 'selection_sort',

  // Binary Search
  'binary search': 'binary_search',
  'binarysearch': 'binary_search',
  'binary_search': 'binary_search',

  // Linear Search
  'linear search': 'linear_search',
  'linearsearch': 'linear_search',
  'linear_search': 'linear_search',
  'sequential search': 'linear_search',

  // BFS (Graph)
  'bfs': 'bfs',
  'breadth first search': 'bfs',
  'breadth-first search': 'bfs',
  'breadth first': 'bfs',
  'breadth_first_search': 'bfs',

  // DFS (Graph)
  'dfs': 'dfs',
  'depth first search': 'dfs',
  'depth-first search': 'dfs',
  'depth first': 'dfs',
  'depth_first_search': 'dfs',

  // Dijkstra (Graph)
  'dijkstra': 'dijkstra',
  "dijkstra's": 'dijkstra',
  "dijkstra's algorithm": 'dijkstra',
  'dijkstras': 'dijkstra',
  'shortest path': 'dijkstra',

  // Tree Traversals
  'inorder': 'inorder_traversal',
  'in-order': 'inorder_traversal',
  'in order': 'inorder_traversal',
  'inorder traversal': 'inorder_traversal',
  'inorder_traversal': 'inorder_traversal',

  'preorder': 'preorder_traversal',
  'pre-order': 'preorder_traversal',
  'pre order': 'preorder_traversal',
  'preorder traversal': 'preorder_traversal',
  'preorder_traversal': 'preorder_traversal',

  'postorder': 'postorder_traversal',
  'post-order': 'postorder_traversal',
  'post order': 'postorder_traversal',
  'postorder traversal': 'postorder_traversal',
  'postorder_traversal': 'postorder_traversal',

  // BST Operations
  'bst insert': 'bst_insert',
  'bst insertion': 'bst_insert',
  'binary search tree insert': 'bst_insert',
  'bst_insert': 'bst_insert',

  'bst search': 'bst_search',
  'binary search tree search': 'bst_search',
  'bst_search': 'bst_search',

  // Dynamic Programming
  'fibonacci': 'dp_fibonacci',
  'fib': 'dp_fibonacci',
  'dp fibonacci': 'dp_fibonacci',
  'dp_fibonacci': 'dp_fibonacci',

  'knapsack': 'dp_knapsack',
  '0/1 knapsack': 'dp_knapsack',
  'dp knapsack': 'dp_knapsack',
  'dp_knapsack': 'dp_knapsack',

  // Pathfinding
  'a*': 'astar',
  'a star': 'astar',
  'astar': 'astar',
  'a* search': 'astar',

  // Scheduling
  'round robin': 'round_robin',
  'round-robin': 'round_robin',
  'round_robin': 'round_robin',
  'rr': 'round_robin',

  'fcfs': 'fcfs',
  'first come first serve': 'fcfs',
  'first come first served': 'fcfs',
  'first-come-first-served': 'fcfs',

  'sjf': 'sjf',
  'shortest job first': 'sjf',
  'shortest-job-first': 'sjf',

  // Automata
  'dfa': 'dfa',
  'deterministic finite automaton': 'dfa',
  'deterministic finite automata': 'dfa',

  'nfa': 'nfa',
  'nondeterministic finite automaton': 'nfa',
  'nondeterministic finite automata': 'nfa',
  'non-deterministic finite automaton': 'nfa',

  // Math
  'gradient descent': 'gradient_descent',
  'gradient_descent': 'gradient_descent',

  'newton': 'newtons_method',
  "newton's method": 'newtons_method',
  'newtons method': 'newtons_method',
  'newtons_method': 'newtons_method',
};

/**
 * Type mappings for algorithms
 */
const TYPE_MAPPINGS = {
  'bubble_sort': 'array',
  'quick_sort': 'array',
  'merge_sort': 'array',
  'insertion_sort': 'array',
  'selection_sort': 'array',
  'binary_search': 'array',
  'linear_search': 'array',
  'bfs': 'graph',
  'dfs': 'graph',
  'dijkstra': 'graph',
  'inorder_traversal': 'tree',
  'preorder_traversal': 'tree',
  'postorder_traversal': 'tree',
  'bst_insert': 'tree',
  'bst_search': 'tree',
  'dp_fibonacci': 'grid',
  'dp_knapsack': 'grid',
  'astar': 'grid',
  'round_robin': 'timeline',
  'fcfs': 'timeline',
  'sjf': 'timeline',
  'dfa': 'state_machine',
  'nfa': 'state_machine',
  'gradient_descent': 'math',
  'newtons_method': 'math',
};

/**
 * Resolve an algorithm name/alias to a generator key
 * @param {string} input - Raw algorithm name from LLM or user
 * @returns {string|null} Generator key or null if not found
 */
export function resolveGeneratorKey(input) {
  if (!input || typeof input !== 'string') return null;

  const normalized = input.toLowerCase().trim();
  return ALGORITHM_ALIASES[normalized] || null;
}

/**
 * Get the simulation type for a generator key
 * @param {string} key - Generator key
 * @returns {string|null} Simulation type or null if not found
 */
export function getTypeForKey(key) {
  return TYPE_MAPPINGS[key] || null;
}

/**
 * Fuzzy match against registry with fallback strategies
 * @param {string} input - Raw algorithm name
 * @param {object} registry - Generator registry instance
 * @returns {string|null} Generator key or null if not found
 */
export function fuzzyMatchGenerator(input, registry) {
  if (!input || typeof input !== 'string') return null;

  const normalized = input.toLowerCase().trim();

  // Strategy 1: Direct registry lookup
  if (registry.has(normalized)) {
    return normalized;
  }

  // Strategy 2: Alias mapping
  const mapped = resolveGeneratorKey(normalized);
  if (mapped && registry.has(mapped)) {
    return mapped;
  }

  // Strategy 3: Partial match on registry keys
  const keys = registry.keys();

  // Exact substring match
  for (const key of keys) {
    if (key.includes(normalized) || normalized.includes(key.replace(/_/g, ' '))) {
      return key;
    }
  }

  // Word-based partial match
  const inputWords = normalized.split(/[\s_-]+/);
  for (const key of keys) {
    const keyWords = key.split('_');
    const matchCount = inputWords.filter(w => keyWords.some(kw => kw.includes(w) || w.includes(kw))).length;
    if (matchCount >= Math.min(inputWords.length, keyWords.length)) {
      return key;
    }
  }

  return null;
}

/**
 * Get all algorithm aliases for documentation/help
 * @returns {object} Object mapping categories to their aliases
 */
export function getAllAliases() {
  const categories = {
    sorting: ['bubble_sort', 'quick_sort', 'merge_sort', 'insertion_sort', 'selection_sort'],
    searching: ['binary_search', 'linear_search'],
    graph: ['bfs', 'dfs', 'dijkstra'],
    tree: ['inorder_traversal', 'preorder_traversal', 'postorder_traversal', 'bst_insert', 'bst_search'],
    dynamic_programming: ['dp_fibonacci', 'dp_knapsack'],
    pathfinding: ['astar'],
    scheduling: ['round_robin', 'fcfs', 'sjf'],
    automata: ['dfa', 'nfa'],
    math: ['gradient_descent', 'newtons_method'],
  };

  const result = {};
  for (const [category, keys] of Object.entries(categories)) {
    result[category] = keys.map(key => ({
      key,
      aliases: Object.entries(ALGORITHM_ALIASES)
        .filter(([, v]) => v === key)
        .map(([alias]) => alias)
    }));
  }

  return result;
}

export default {
  resolveGeneratorKey,
  getTypeForKey,
  fuzzyMatchGenerator,
  getAllAliases,
  ALGORITHM_ALIASES,
  TYPE_MAPPINGS,
};
