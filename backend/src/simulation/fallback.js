/**
 * Fallback Responses
 * Helpful responses when a topic is not simulatable
 */
// Import generators first to ensure they're registered before using registry
import './generators/index.js';
import registry from './registry.js';

/**
 * Find related simulatable topics based on keywords
 * @param {string} query - User's query
 * @returns {object[]} Array of related simulation suggestions
 */
export function findRelatedSimulatableTopics(query) {
  const lowerQuery = query.toLowerCase();
  const suggestions = [];

  // Keyword mappings to related simulations
  const keywordMappings = {
    // Sorting related
    'sort': [
      { name: 'Bubble Sort', key: 'bubble_sort', description: 'Simple comparison-based sorting' },
      { name: 'Quick Sort', key: 'quick_sort', description: 'Efficient divide-and-conquer sorting' },
      { name: 'Merge Sort', key: 'merge_sort', description: 'Stable divide-and-conquer sorting' }
    ],
    'array': [
      { name: 'Bubble Sort', key: 'bubble_sort', description: 'Sort an array step by step' },
      { name: 'Binary Search', key: 'binary_search', description: 'Efficiently search a sorted array' }
    ],
    'compare': [
      { name: 'Bubble Sort', key: 'bubble_sort', description: 'Compare and swap adjacent elements' },
      { name: 'Selection Sort', key: 'selection_sort', description: 'Find minimum and place it' }
    ],

    // Search related
    'search': [
      { name: 'Binary Search', key: 'binary_search', description: 'O(log n) search in sorted array' },
      { name: 'Linear Search', key: 'linear_search', description: 'O(n) sequential search' }
    ],
    'find': [
      { name: 'Binary Search', key: 'binary_search', description: 'Find element in sorted array' },
      { name: 'Linear Search', key: 'linear_search', description: 'Find element in any array' }
    ],

    // Graph related
    'graph': [
      { name: 'BFS', key: 'bfs', description: 'Breadth-first graph traversal' },
      { name: 'DFS', key: 'dfs', description: 'Depth-first graph traversal' },
      { name: 'Dijkstra', key: 'dijkstra', description: 'Shortest path algorithm' }
    ],
    'path': [
      { name: 'Dijkstra', key: 'dijkstra', description: 'Find shortest path' },
      { name: 'BFS', key: 'bfs', description: 'Explore paths level by level' }
    ],
    'traverse': [
      { name: 'BFS', key: 'bfs', description: 'Breadth-first traversal' },
      { name: 'DFS', key: 'dfs', description: 'Depth-first traversal' }
    ],

    // Tree related
    'tree': [
      { name: 'Inorder Traversal', key: 'inorder_traversal', description: 'Left-Root-Right tree traversal' },
      { name: 'Preorder Traversal', key: 'preorder_traversal', description: 'Root-Left-Right tree traversal' }
    ],
    'binary tree': [
      { name: 'Inorder Traversal', key: 'inorder_traversal', description: 'Visit nodes in sorted order' }
    ],

    // Data structures
    'data structure': [
      { name: 'Bubble Sort', key: 'bubble_sort', description: 'Array sorting visualization' },
      { name: 'Binary Search', key: 'binary_search', description: 'Sorted array operations' }
    ],

    // Algorithm general
    'algorithm': [
      { name: 'Bubble Sort', key: 'bubble_sort', description: 'Classic sorting algorithm' },
      { name: 'Quick Sort', key: 'quick_sort', description: 'Efficient sorting algorithm' },
      { name: 'Binary Search', key: 'binary_search', description: 'Efficient search algorithm' }
    ],

    // Complexity related
    'complexity': [
      { name: 'Bubble Sort', key: 'bubble_sort', description: 'O(n²) time complexity' },
      { name: 'Quick Sort', key: 'quick_sort', description: 'O(n log n) average' },
      { name: 'Binary Search', key: 'binary_search', description: 'O(log n) search' }
    ],

    // Performance
    'efficient': [
      { name: 'Quick Sort', key: 'quick_sort', description: 'Fast divide-and-conquer sorting' },
      { name: 'Binary Search', key: 'binary_search', description: 'Logarithmic search time' }
    ],
    'optimize': [
      { name: 'Quick Sort', key: 'quick_sort', description: 'Optimized sorting approach' }
    ]
  };

  // Find matching keywords
  for (const [keyword, relatedSims] of Object.entries(keywordMappings)) {
    if (lowerQuery.includes(keyword)) {
      for (const sim of relatedSims) {
        // Only add if generator exists and not already suggested
        if (registry.has(sim.key) && !suggestions.find(s => s.key === sim.key)) {
          suggestions.push(sim);
        }
      }
    }
  }

  // Limit to top 3 suggestions
  return suggestions.slice(0, 3);
}

/**
 * Create a fallback response when topic is not simulatable
 * @param {string} query - User's query
 * @param {string} reason - Why it's not simulatable
 * @returns {object} Fallback response object
 */
export function createFallbackResponse(query, reason) {
  const relatedTopics = findRelatedSimulatableTopics(query);

  return {
    simulatable: false,
    reason,
    fallback: {
      type: 'explanation',
      title: 'No Interactive Simulation Available',
      content: `This topic doesn't have an interactive step-by-step simulation yet, but you can explore related algorithms:`,
      suggestions: relatedTopics.length > 0
        ? relatedTopics.map(t => `Try "${t.name}" - ${t.description}`)
        : [
            'Try "bubble sort" for array sorting visualization',
            'Try "binary search" for efficient search demonstration',
            'Try "quick sort" for divide-and-conquer approach'
          ],
      relatedTopics
    }
  };
}

/**
 * Get all available simulations for help/discovery
 * @returns {object[]}
 */
export function getAvailableSimulations() {
  return registry.list().map(meta => ({
    key: meta.key,
    name: meta.name,
    type: meta.type,
    description: meta.description,
    complexity: meta.complexity
  }));
}

export default {
  findRelatedSimulatableTopics,
  createFallbackResponse,
  getAvailableSimulations
};
