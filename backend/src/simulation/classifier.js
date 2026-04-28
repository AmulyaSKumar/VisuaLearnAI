/**
 * Simulation Intent Classifier
 * Uses LLM to classify user queries and extract simulation parameters
 * This is the ONLY place where LLM is used in the simulation system
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/environment.js';
import { resolveGeneratorKey, fuzzyMatchGenerator } from './key-mapper.js';
import { classifyWithCache } from './cache.js';
// Import generators first to ensure they're registered before using registry
import './generators/index.js';
import registry from './registry.js';

// Initialize Anthropic client
const client = new Anthropic({
  apiKey: config.anthropic.apiKey,
  ...(config.anthropic.baseUrl && { baseURL: config.anthropic.baseUrl }),
});

/**
 * System prompt for classification
 */
const CLASSIFICATION_PROMPT = `You are a simulation classifier for an educational platform. Your job is to analyze user queries and determine if they can be visualized with an interactive simulation.

CURRENTLY AVAILABLE SIMULATIONS:

Type: "array"
Generators:
- Sorting: bubble_sort, quick_sort, merge_sort, insertion_sort, selection_sort, heap_sort
- Searching: binary_search, linear_search

Type: "graph"
Generators:
- Traversal: bfs (Breadth-First Search), dfs (Depth-First Search)
- Shortest Path: dijkstra (Dijkstra's Algorithm), bellman_ford (Bellman-Ford - handles negative weights)
- MST: prims (Prim's Algorithm), kruskals (Kruskal's Algorithm using Union-Find)
- All-pairs: floyd_warshall (Floyd-Warshall all-pairs shortest paths)

Type: "tree"
Generators:
- Traversals: inorder_traversal, preorder_traversal, postorder_traversal, levelorder_traversal
- BST Operations: bst_insert, bst_search

Type: "grid"
Generators:
- Filling: flood_fill (Flood Fill algorithm for connected region filling)
- Pathfinding: a_star (A* pathfinding algorithm)

Type: "dp"
Generators:
- dp_fibonacci (Fibonacci with memoization table)
- dp_knapsack (0/1 Knapsack problem with 2D DP table)
- lcs (Longest Common Subsequence)
- lis (Longest Increasing Subsequence)
- edit_distance (Edit Distance / Levenshtein Distance)

Type: "timeline"
Generators:
- fcfs (First Come First Served CPU scheduling)
- sjf (Shortest Job First CPU scheduling)
- round_robin (Round Robin CPU scheduling with time quantum)
- priority_scheduling (Priority-based CPU scheduling)
- srtf (Shortest Remaining Time First - preemptive SJF)

Type: "state_machine"
Generators:
- dfa (Deterministic Finite Automaton - string acceptance)
- nfa (Non-deterministic Finite Automaton - string acceptance)

Type: "math"
Generators:
- gradient_descent (Gradient descent optimization to find function minimum)
- newtons_method (Newton's method for finding function roots)

Type: "stack"
Generators:
- stack_operations (Push, Pop, Peek operations with overflow/underflow detection)

Type: "linkedlist"
Generators:
- linkedlist_insert (Insert node at position)
- linkedlist_delete (Delete node by value)
- linkedlist_reverse (Reverse linked list using three pointers)

Type: "heap"
Generators:
- min_heap (Min Heap operations - insert, extract min)
- max_heap (Max Heap operations - insert, extract max)

Type: "turing"
Generators:
- turing_machine (Turing Machine simulator with tape, states, transitions)

IMPORTANT: Only recommend algorithms from the CURRENTLY AVAILABLE list above.

Given a user query, respond with a JSON object:
{
  "simulatable": boolean,        // Can this be simulated?
  "type": string | null,         // Simulation type (array, graph, etc.)
  "algorithm": string | null,    // Generator key (e.g., "bubble_sort")
  "inputs": object | null,       // Extracted or suggested inputs
  "confidence": number,          // 0-1 confidence score
  "reason": string | null        // If not simulatable, explain why
}

EXAMPLES:
Query: "show me how bubble sort works with array [5, 2, 8, 1]"
Response: {"simulatable": true, "type": "array", "algorithm": "bubble_sort", "inputs": {"array": [5, 2, 8, 1]}, "confidence": 0.95, "reason": null}

Query: "binary search for 7 in [1, 3, 5, 7, 9, 11]"
Response: {"simulatable": true, "type": "array", "algorithm": "binary_search", "inputs": {"array": [1, 3, 5, 7, 9, 11], "target": 7}, "confidence": 0.95, "reason": null}

Query: "BFS traversal starting from node A"
Response: {"simulatable": true, "type": "graph", "algorithm": "bfs", "inputs": {"startNode": "A"}, "confidence": 0.9, "reason": null}

Query: "show me depth first search on a graph"
Response: {"simulatable": true, "type": "graph", "algorithm": "dfs", "inputs": null, "confidence": 0.85, "reason": null}

Query: "dijkstra shortest path from A to E"
Response: {"simulatable": true, "type": "graph", "algorithm": "dijkstra", "inputs": {"startNode": "A", "endNode": "E"}, "confidence": 0.95, "reason": null}

Query: "inorder traversal of binary tree"
Response: {"simulatable": true, "type": "tree", "algorithm": "inorder_traversal", "inputs": null, "confidence": 0.9, "reason": null}

Query: "preorder tree traversal"
Response: {"simulatable": true, "type": "tree", "algorithm": "preorder_traversal", "inputs": null, "confidence": 0.9, "reason": null}

Query: "insert 35 into BST"
Response: {"simulatable": true, "type": "tree", "algorithm": "bst_insert", "inputs": {"value": 35}, "confidence": 0.9, "reason": null}

Query: "search for 40 in binary search tree"
Response: {"simulatable": true, "type": "tree", "algorithm": "bst_search", "inputs": {"target": 40}, "confidence": 0.9, "reason": null}

Query: "heap sort algorithm with [4, 10, 3, 5, 1]"
Response: {"simulatable": true, "type": "array", "algorithm": "heap_sort", "inputs": {"array": [4, 10, 3, 5, 1]}, "confidence": 0.95, "reason": null}

Query: "level order traversal of binary tree"
Response: {"simulatable": true, "type": "tree", "algorithm": "levelorder_traversal", "inputs": null, "confidence": 0.9, "reason": null}

Query: "flood fill algorithm"
Response: {"simulatable": true, "type": "grid", "algorithm": "flood_fill", "inputs": null, "confidence": 0.9, "reason": null}

Query: "A* pathfinding in a grid"
Response: {"simulatable": true, "type": "grid", "algorithm": "a_star", "inputs": null, "confidence": 0.9, "reason": null}

Query: "find path through maze"
Response: {"simulatable": true, "type": "grid", "algorithm": "a_star", "inputs": null, "confidence": 0.85, "reason": null}

Query: "fibonacci dynamic programming"
Response: {"simulatable": true, "type": "dp", "algorithm": "dp_fibonacci", "inputs": {"n": 10}, "confidence": 0.9, "reason": null}

Query: "0/1 knapsack problem with weights [2,3,4] and values [3,4,5]"
Response: {"simulatable": true, "type": "dp", "algorithm": "dp_knapsack", "inputs": {"weights": [2,3,4], "values": [3,4,5], "capacity": 5}, "confidence": 0.95, "reason": null}

Query: "round robin scheduling with quantum 2"
Response: {"simulatable": true, "type": "timeline", "algorithm": "round_robin", "inputs": {"quantum": 2}, "confidence": 0.9, "reason": null}

Query: "first come first serve CPU scheduling"
Response: {"simulatable": true, "type": "timeline", "algorithm": "fcfs", "inputs": null, "confidence": 0.9, "reason": null}

Query: "shortest job first scheduling"
Response: {"simulatable": true, "type": "timeline", "algorithm": "sjf", "inputs": null, "confidence": 0.9, "reason": null}

Query: "DFA for binary strings ending in 01"
Response: {"simulatable": true, "type": "state_machine", "algorithm": "dfa", "inputs": {"input": "1101"}, "confidence": 0.85, "reason": null}

Query: "NFA simulation"
Response: {"simulatable": true, "type": "state_machine", "algorithm": "nfa", "inputs": null, "confidence": 0.85, "reason": null}

Query: "gradient descent optimization"
Response: {"simulatable": true, "type": "math", "algorithm": "gradient_descent", "inputs": {"learningRate": 0.1}, "confidence": 0.9, "reason": null}

Query: "newton's method to find roots"
Response: {"simulatable": true, "type": "math", "algorithm": "newtons_method", "inputs": null, "confidence": 0.9, "reason": null}

Query: "find minimum of a function"
Response: {"simulatable": true, "type": "math", "algorithm": "gradient_descent", "inputs": null, "confidence": 0.85, "reason": null}

Query: "root finding algorithm"
Response: {"simulatable": true, "type": "math", "algorithm": "newtons_method", "inputs": null, "confidence": 0.85, "reason": null}

Query: "bellman ford shortest path with negative weights"
Response: {"simulatable": true, "type": "graph", "algorithm": "bellman_ford", "inputs": {"startNode": "A"}, "confidence": 0.95, "reason": null}

Query: "floyd warshall all pairs shortest paths"
Response: {"simulatable": true, "type": "graph", "algorithm": "floyd_warshall", "inputs": null, "confidence": 0.9, "reason": null}

Query: "prim's minimum spanning tree"
Response: {"simulatable": true, "type": "graph", "algorithm": "prims", "inputs": null, "confidence": 0.9, "reason": null}

Query: "kruskal's algorithm for MST"
Response: {"simulatable": true, "type": "graph", "algorithm": "kruskals", "inputs": null, "confidence": 0.9, "reason": null}

Query: "longest common subsequence of ABCD and AEDF"
Response: {"simulatable": true, "type": "dp", "algorithm": "lcs", "inputs": {"string1": "ABCD", "string2": "AEDF"}, "confidence": 0.95, "reason": null}

Query: "longest increasing subsequence"
Response: {"simulatable": true, "type": "dp", "algorithm": "lis", "inputs": null, "confidence": 0.9, "reason": null}

Query: "edit distance between kitten and sitting"
Response: {"simulatable": true, "type": "dp", "algorithm": "edit_distance", "inputs": {"string1": "kitten", "string2": "sitting"}, "confidence": 0.95, "reason": null}

Query: "priority scheduling algorithm"
Response: {"simulatable": true, "type": "timeline", "algorithm": "priority_scheduling", "inputs": null, "confidence": 0.9, "reason": null}

Query: "shortest remaining time first scheduling"
Response: {"simulatable": true, "type": "timeline", "algorithm": "srtf", "inputs": null, "confidence": 0.9, "reason": null}

Query: "stack push and pop operations"
Response: {"simulatable": true, "type": "stack", "algorithm": "stack_operations", "inputs": null, "confidence": 0.9, "reason": null}

Query: "linked list insert and delete"
Response: {"simulatable": true, "type": "linkedlist", "algorithm": "linkedlist_insert", "inputs": null, "confidence": 0.85, "reason": null}

Query: "reverse a linked list"
Response: {"simulatable": true, "type": "linkedlist", "algorithm": "linkedlist_reverse", "inputs": null, "confidence": 0.9, "reason": null}

Query: "min heap operations"
Response: {"simulatable": true, "type": "heap", "algorithm": "min_heap", "inputs": null, "confidence": 0.9, "reason": null}

Query: "max heap insert and extract"
Response: {"simulatable": true, "type": "heap", "algorithm": "max_heap", "inputs": null, "confidence": 0.9, "reason": null}

Query: "turing machine simulation"
Response: {"simulatable": true, "type": "turing", "algorithm": "turing_machine", "inputs": null, "confidence": 0.9, "reason": null}

Query: "binary increment turing machine"
Response: {"simulatable": true, "type": "turing", "algorithm": "turing_machine", "inputs": {"tape": "1011"}, "confidence": 0.85, "reason": null}

Query: "explain sorting algorithms"
Response: {"simulatable": true, "type": "array", "algorithm": "bubble_sort", "inputs": null, "confidence": 0.7, "reason": null}

Query: "what is machine learning"
Response: {"simulatable": false, "type": null, "algorithm": null, "inputs": null, "confidence": 0.9, "reason": "Machine learning concepts don't have a step-by-step simulation available"}

IMPORTANT RULES:
1. Extract arrays from formats like "[1,2,3]", "1, 2, 3", "array: 1 2 3", etc.
2. For sorting, always use "array" as the input key
3. For search, use "array" and "target" as input keys
4. For graph algorithms, use "graph" (with nodes/edges), "startNode", and optionally "endNode"
5. For tree algorithms, use "tree" (with nodes array), and "value" or "target" for BST operations
6. If no specific algorithm mentioned but topic is simulatable, suggest the most common one
7. Only return algorithms from the CURRENTLY AVAILABLE list
8. Set confidence lower (0.5-0.7) if you had to infer the algorithm

Respond ONLY with valid JSON, no other text.`;

/**
 * Parse classification response from LLM
 * @param {string} content - Raw LLM response
 * @returns {object} Parsed classification
 */
function parseClassificationResponse(content) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        simulatable: false,
        type: null,
        algorithm: null,
        inputs: null,
        confidence: 0,
        reason: 'Failed to parse classification response'
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and sanitize the response
    return {
      simulatable: Boolean(parsed.simulatable),
      type: parsed.type || null,
      algorithm: parsed.algorithm || null,
      inputs: parsed.inputs || null,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reason: parsed.reason || null
    };
  } catch (error) {
    console.error('[Classifier] Failed to parse response:', error);
    return {
      simulatable: false,
      type: null,
      algorithm: null,
      inputs: null,
      confidence: 0,
      reason: 'Failed to parse classification response'
    };
  }
}

/**
 * Classify a user query for simulation intent
 * @param {string} query - User's query
 * @returns {Promise<object>} Classification result
 */
async function classifyIntent(query) {
  try {
    const response = await client.messages.create({
      model: config.anthropic.model || 'claude-sonnet-4-5',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Classify this query for simulation:\n"${query}"`
        }
      ],
      system: CLASSIFICATION_PROMPT
    });

    const content = response.content[0]?.text || '';
    const classification = parseClassificationResponse(content);

    // Validate algorithm against registry using safe key mapping
    if (classification.simulatable && classification.algorithm) {
      // Try to resolve the algorithm key
      let resolvedKey = resolveGeneratorKey(classification.algorithm);

      // If not resolved, try fuzzy matching
      if (!resolvedKey) {
        resolvedKey = fuzzyMatchGenerator(classification.algorithm, registry);
      }

      // Check if generator exists
      if (resolvedKey && registry.has(resolvedKey)) {
        classification.algorithm = resolvedKey;
        classification.generatorKey = resolvedKey;
      } else {
        // Generator not found - reduce confidence or mark as not simulatable
        console.warn(`[Classifier] Generator not found: ${classification.algorithm}`);
        classification.simulatable = false;
        classification.reason = `Algorithm "${classification.algorithm}" is not yet supported. Available: ${registry.keys().join(', ')}`;
        classification.algorithm = null;
      }
    }

    return classification;
  } catch (error) {
    console.error('[Classifier] Classification failed:', error);
    return {
      simulatable: false,
      type: null,
      algorithm: null,
      inputs: null,
      confidence: 0,
      reason: `Classification failed: ${error.message}`
    };
  }
}

/**
 * Classify query with caching
 * @param {string} query - User's query
 * @returns {Promise<object>} Classification result (with cached flag)
 */
export async function classifySimulationIntent(query) {
  return classifyWithCache(query, classifyIntent);
}

/**
 * Quick check if query might be simulation-related (without LLM)
 * Used for pre-filtering to avoid unnecessary LLM calls
 * @param {string} query - User's query
 * @returns {boolean}
 */
export function mightBeSimulationRelated(query) {
  const lowerQuery = query.toLowerCase();

  const simulationKeywords = [
    'sort', 'sorting', 'bubble', 'quick', 'merge', 'insertion', 'selection', 'heap',
    'search', 'binary', 'linear',
    'bfs', 'dfs', 'breadth', 'depth', 'traversal', 'traverse',
    'dijkstra', 'shortest path', 'graph', 'bellman', 'floyd', 'warshall', 'prim', 'kruskal', 'mst', 'spanning',
    'tree', 'bst', 'inorder', 'preorder', 'postorder', 'levelorder', 'level order',
    'grid', 'flood', 'fill', 'maze', 'pathfind',
    'fibonacci', 'knapsack', 'dynamic programming', 'dp', 'lcs', 'lis', 'subsequence', 'edit distance', 'levenshtein',
    'a*', 'astar', 'pathfinding',
    'scheduling', 'round robin', 'fcfs', 'sjf', 'srtf', 'priority',
    'automata', 'dfa', 'nfa', 'finite',
    'gradient descent', 'newton',
    'stack', 'push', 'pop', 'lifo',
    'linked list', 'linkedlist', 'node', 'pointer',
    'min heap', 'max heap', 'heapify', 'extract',
    'turing', 'tape', 'transition', 'state machine',
    'algorithm', 'visualize', 'simulate', 'animation', 'step by step',
    'show me how', 'demonstrate', 'walk through'
  ];

  return simulationKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Get suggested inputs for a generator
 * @param {string} generatorKey
 * @returns {object|null}
 */
export function getSuggestedInputs(generatorKey) {
  const generator = registry.get(generatorKey);
  if (!generator) return null;
  return generator.getDefaults();
}

export default {
  classifySimulationIntent,
  mightBeSimulationRelated,
  getSuggestedInputs
};
