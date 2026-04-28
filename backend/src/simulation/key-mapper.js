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

  // Heap Sort
  'heap sort': 'heap_sort',
  'heapsort': 'heap_sort',
  'heap': 'heap_sort',
  'heap_sort': 'heap_sort',

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

  'levelorder': 'levelorder_traversal',
  'level-order': 'levelorder_traversal',
  'level order': 'levelorder_traversal',
  'levelorder traversal': 'levelorder_traversal',
  'levelorder_traversal': 'levelorder_traversal',
  'level order traversal': 'levelorder_traversal',
  'bfs tree': 'levelorder_traversal',

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

  // Grid - Pathfinding
  'a*': 'a_star',
  'a star': 'a_star',
  'astar': 'a_star',
  'a* search': 'a_star',
  'a_star': 'a_star',
  'pathfinding': 'a_star',
  'path finding': 'a_star',
  'maze solving': 'a_star',
  'maze': 'a_star',

  // Grid - Flood Fill
  'flood fill': 'flood_fill',
  'floodfill': 'flood_fill',
  'flood_fill': 'flood_fill',
  'bucket fill': 'flood_fill',
  'paint bucket': 'flood_fill',
  'fill algorithm': 'flood_fill',

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

  // Graph - Additional
  'bellman ford': 'bellman_ford',
  'bellman-ford': 'bellman_ford',
  'bellman_ford': 'bellman_ford',
  'negative weight shortest path': 'bellman_ford',

  'floyd warshall': 'floyd_warshall',
  'floyd-warshall': 'floyd_warshall',
  'floyd_warshall': 'floyd_warshall',
  'all pairs shortest path': 'floyd_warshall',

  'prims': 'prims',
  "prim's": 'prims',
  "prim's algorithm": 'prims',
  'prim': 'prims',

  'kruskals': 'kruskals',
  "kruskal's": 'kruskals',
  "kruskal's algorithm": 'kruskals',
  'kruskal': 'kruskals',
  'union find': 'kruskals',

  'minimum spanning tree': 'prims',
  'mst': 'prims',

  // DP - Additional
  'lcs': 'lcs',
  'longest common subsequence': 'lcs',
  'common subsequence': 'lcs',

  'lis': 'lis',
  'longest increasing subsequence': 'lis',
  'increasing subsequence': 'lis',

  'edit distance': 'edit_distance',
  'edit_distance': 'edit_distance',
  'levenshtein': 'edit_distance',
  'levenshtein distance': 'edit_distance',
  'string distance': 'edit_distance',

  // Scheduling - Additional
  'priority': 'priority_scheduling',
  'priority scheduling': 'priority_scheduling',
  'priority_scheduling': 'priority_scheduling',

  'srtf': 'srtf',
  'shortest remaining time first': 'srtf',
  'shortest remaining time': 'srtf',
  'preemptive sjf': 'srtf',

  // Stack
  'stack': 'stack_operations',
  'stack operations': 'stack_operations',
  'stack_operations': 'stack_operations',
  'push pop': 'stack_operations',
  'lifo': 'stack_operations',

  // Linked List
  'linked list': 'linkedlist_insert',
  'linkedlist': 'linkedlist_insert',
  'linked list insert': 'linkedlist_insert',
  'linkedlist_insert': 'linkedlist_insert',
  'linkedlist insert': 'linkedlist_insert',

  'linked list delete': 'linkedlist_delete',
  'linkedlist_delete': 'linkedlist_delete',
  'linkedlist delete': 'linkedlist_delete',

  'linked list reverse': 'linkedlist_reverse',
  'linkedlist_reverse': 'linkedlist_reverse',
  'linkedlist reverse': 'linkedlist_reverse',
  'reverse linked list': 'linkedlist_reverse',

  // Heap
  'min heap': 'min_heap',
  'min_heap': 'min_heap',
  'minheap': 'min_heap',
  'minimum heap': 'min_heap',

  'max heap': 'max_heap',
  'max_heap': 'max_heap',
  'maxheap': 'max_heap',
  'maximum heap': 'max_heap',

  // Turing Machine
  'turing machine': 'turing_machine',
  'turing_machine': 'turing_machine',
  'tm': 'turing_machine',
  'tape machine': 'turing_machine',
};

/**
 * Type mappings for algorithms
 */
const TYPE_MAPPINGS = {
  // Array
  'bubble_sort': 'array',
  'quick_sort': 'array',
  'merge_sort': 'array',
  'insertion_sort': 'array',
  'selection_sort': 'array',
  'heap_sort': 'array',
  'binary_search': 'array',
  'linear_search': 'array',

  // Graph
  'bfs': 'graph',
  'dfs': 'graph',
  'dijkstra': 'graph',
  'bellman_ford': 'graph',
  'floyd_warshall': 'graph',
  'prims': 'graph',
  'kruskals': 'graph',

  // Tree
  'inorder_traversal': 'tree',
  'preorder_traversal': 'tree',
  'postorder_traversal': 'tree',
  'levelorder_traversal': 'tree',
  'bst_insert': 'tree',
  'bst_search': 'tree',

  // Grid
  'flood_fill': 'grid',
  'a_star': 'grid',

  // DP
  'dp_fibonacci': 'dp',
  'dp_knapsack': 'dp',
  'lcs': 'dp',
  'lis': 'dp',
  'edit_distance': 'dp',

  // Timeline/Scheduling
  'round_robin': 'timeline',
  'fcfs': 'timeline',
  'sjf': 'timeline',
  'priority_scheduling': 'timeline',
  'srtf': 'timeline',

  // State Machine
  'dfa': 'state_machine',
  'nfa': 'state_machine',

  // Math
  'gradient_descent': 'math',
  'newtons_method': 'math',

  // Stack
  'stack_operations': 'stack',

  // Linked List
  'linkedlist_insert': 'linkedlist',
  'linkedlist_delete': 'linkedlist',
  'linkedlist_reverse': 'linkedlist',

  // Heap
  'min_heap': 'heap',
  'max_heap': 'heap',

  // Turing Machine
  'turing_machine': 'turing',
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
    sorting: ['bubble_sort', 'quick_sort', 'merge_sort', 'insertion_sort', 'selection_sort', 'heap_sort'],
    searching: ['binary_search', 'linear_search'],
    graph: ['bfs', 'dfs', 'dijkstra', 'bellman_ford', 'floyd_warshall', 'prims', 'kruskals'],
    tree: ['inorder_traversal', 'preorder_traversal', 'postorder_traversal', 'levelorder_traversal', 'bst_insert', 'bst_search'],
    grid: ['flood_fill', 'a_star'],
    dp: ['dp_fibonacci', 'dp_knapsack', 'lcs', 'lis', 'edit_distance'],
    timeline: ['round_robin', 'fcfs', 'sjf', 'priority_scheduling', 'srtf'],
    state_machine: ['dfa', 'nfa'],
    math: ['gradient_descent', 'newtons_method'],
    stack: ['stack_operations'],
    linkedlist: ['linkedlist_insert', 'linkedlist_delete', 'linkedlist_reverse'],
    heap: ['min_heap', 'max_heap'],
    turing: ['turing_machine'],
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
