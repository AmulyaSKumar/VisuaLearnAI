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
- Sorting: bubble_sort, quick_sort, merge_sort, insertion_sort, selection_sort
- Searching: binary_search, linear_search

Type: "graph"
Generators:
- Traversal: bfs (Breadth-First Search), dfs (Depth-First Search)
- Shortest Path: dijkstra (Dijkstra's Algorithm)

Type: "tree"
Generators:
- Traversals: inorder_traversal, preorder_traversal, postorder_traversal
- BST Operations: bst_insert, bst_search

COMING SOON (NOT YET AVAILABLE - do NOT recommend these):
- Dynamic programming visualizations
- CPU scheduling simulations
- Automata visualizations

IMPORTANT: Only recommend algorithms from the CURRENTLY AVAILABLE list above. If a user asks about DP, scheduling, or automata algorithms not in the available list, set simulatable=false and explain that this simulation type is coming soon.

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
    'sort', 'sorting', 'bubble', 'quick', 'merge', 'insertion', 'selection',
    'search', 'binary', 'linear',
    'bfs', 'dfs', 'breadth', 'depth', 'traversal', 'traverse',
    'dijkstra', 'shortest path', 'graph',
    'tree', 'bst', 'inorder', 'preorder', 'postorder',
    'fibonacci', 'knapsack', 'dynamic programming', 'dp',
    'a*', 'astar', 'pathfinding',
    'scheduling', 'round robin', 'fcfs', 'sjf',
    'automata', 'dfa', 'nfa', 'finite',
    'gradient descent', 'newton',
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
