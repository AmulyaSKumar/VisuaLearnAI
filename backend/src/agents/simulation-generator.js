/**
 * Simulation Generator Agent
 * Generates step-by-step algorithm simulations for educational visualization
 * Supports: array_sort, graph_traversal, tree_traversal
 */
import { BaseAgent } from './base-agent.js';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

// ============================================
// JSON PARSING UTILITIES
// ============================================

function stripMarkdownFences(text) {
  let cleanedText = text.trim();
  const jsonFenceMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonFenceMatch) return jsonFenceMatch[1].trim();
  const genericFenceMatch = cleanedText.match(/```\s*([\s\S]*?)\s*```/);
  if (genericFenceMatch) return genericFenceMatch[1].trim();
  cleanedText = cleanedText.replace(/^```(?:json|JSON)?\s*\n?/, '');
  cleanedText = cleanedText.replace(/\n?```\s*$/, '');
  return cleanedText.trim();
}

function extractJsonObject(text) {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  return text.slice(firstBrace, lastBrace + 1);
}

function repairJsonString(text) {
  if (!text) return text;
  return text
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
}

function parseJsonResponse(text) {
  const rawText = text || '';

  try { return JSON.parse(rawText); } catch { /* continue */ }

  const stripped = stripMarkdownFences(rawText);
  try { return JSON.parse(stripped); } catch { /* continue */ }

  const repairedStripped = repairJsonString(stripped);
  try { return JSON.parse(repairedStripped); } catch { /* continue */ }

  const objectBlock = extractJsonObject(repairedStripped);
  if (objectBlock) {
    try { return JSON.parse(objectBlock); } catch { /* continue */ }
    try { return JSON.parse(repairJsonString(objectBlock)); } catch { /* continue */ }
  }

  throw new Error(`Failed to parse JSON response. Preview: ${rawText.substring(0, 200)}`);
}

// ============================================
// DEFAULT INPUTS FOR DETERMINISTIC CACHING
// ============================================

const DEFAULT_INPUTS = {
  array_sort: [5, 3, 8, 2, 7, 1, 9, 4],
  graph_traversal: {
    nodes: ['A', 'B', 'C', 'D', 'E'],
    edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E']]
  },
  tree_traversal: {
    root: 10,
    nodes: [10, 5, 15, 3, 7, 12, 20]
  }
};

// ============================================
// SIMULATION AGENT
// ============================================

export class SimulationAgent extends BaseAgent {
  constructor() {
    super('simulation-generator', 'Generates step-by-step algorithm simulations', '1.0.0');
  }

  async execute(input, context = {}) {
    const { topic, simulationType, difficulty = 'beginner', sampleInput } = input;

    this.validateInput(input, ['topic', 'simulationType']);

    const validTypes = ['array_sort', 'graph_traversal', 'tree_traversal'];
    if (!validTypes.includes(simulationType)) {
      throw new Error(`Invalid simulation type. Use: ${validTypes.join(', ')}`);
    }

    const inputData = sampleInput || DEFAULT_INPUTS[simulationType];

    // Generate simulation
    const result = await this.generateSimulation(topic, simulationType, difficulty, inputData);

    // Validate output - retry once on failure
    if (!this.validateOutput(result, simulationType)) {
      console.warn('SimulationAgent: Invalid output, retrying...');
      const retry = await this.generateSimulation(topic, simulationType, difficulty, inputData);
      if (!this.validateOutput(retry, simulationType)) {
        throw new Error('Failed to generate valid simulation after retry');
      }
      return retry;
    }

    // Enforce step limit (max 50)
    if (result.steps && result.steps.length > 50) {
      result.steps = result.steps.slice(0, 50);
    }

    return result;
  }

  async generateSimulation(topic, simulationType, difficulty, inputData) {
    const schemaPrompt = this.getSchemaPrompt(simulationType, inputData);

    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      system: `You are an expert in algorithms and educational visualization.
Generate a step-by-step simulation for the given topic.

RULES:
- Output ONLY valid JSON (no text, no markdown fences, no explanation)
- Steps must reflect CORRECT algorithm behavior
- Each step must include the FULL state (array/structure), indices/nodes being processed, action flag, and short description
- Ensure logical correctness across steps
- Keep steps minimal but complete
- DO NOT hallucinate incorrect steps
- DO NOT skip intermediate states
- Keep structure consistent across all steps

Difficulty: ${difficulty}
- beginner: Include every single step, explain simply
- intermediate: Show key steps, moderate detail
- advanced: Focus on key operations, assume prior knowledge

CRITICAL: Start your response with { and end with }. No other text.`,
      messages: [{
        role: 'user',
        content: `Generate a ${difficulty} simulation for: "${topic}"

${schemaPrompt}

Return ONLY the JSON object. No explanation, no markdown.`
      }]
    });

    const text = response.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    return parseJsonResponse(text);
  }

  getSchemaPrompt(type, inputData) {
    switch (type) {
      case 'array_sort':
        return `TYPE: array_sort
INPUT ARRAY: ${JSON.stringify(inputData)}

Return this EXACT structure:
{
  "type": "array_sort",
  "initialArray": ${JSON.stringify(inputData)},
  "steps": [
    {
      "step": 1,
      "array": [current array state],
      "highlight": [index1, index2],
      "swap": false,
      "description": "Comparing X and Y"
    }
  ]
}

REQUIREMENTS:
- "array" must be the FULL array at each step
- "highlight" must be exactly 2 indices being compared
- "swap" is true only when a swap occurs
- Show EVERY comparison and swap operation`;

      case 'graph_traversal':
        return `TYPE: graph_traversal
GRAPH:
- nodes: ${JSON.stringify(inputData.nodes)}
- edges: ${JSON.stringify(inputData.edges)}

Return this EXACT structure:
{
  "type": "graph_traversal",
  "nodes": ${JSON.stringify(inputData.nodes)},
  "edges": ${JSON.stringify(inputData.edges)},
  "steps": [
    {
      "step": 1,
      "visited": ["A"],
      "current": "A",
      "queue": ["B", "C"],
      "description": "Starting at A, adding neighbors to queue"
    }
  ]
}

REQUIREMENTS:
- "visited" is cumulative list of all visited nodes
- "current" is the node being processed this step
- "queue" (or "stack" for DFS) shows pending nodes
- Show every node visit and queue/stack operation`;

      case 'tree_traversal':
        return `TYPE: tree_traversal
TREE VALUES: ${JSON.stringify(inputData.nodes)} (build a BST from these values)

Return this EXACT structure:
{
  "type": "tree_traversal",
  "nodes": [
    { "id": "1", "value": 10, "left": "2", "right": "3" },
    { "id": "2", "value": 5, "left": "4", "right": "5" }
  ],
  "steps": [
    {
      "step": 1,
      "current": "1",
      "traversalOrder": [10],
      "stack": ["2"],
      "description": "Visit root node 10"
    }
  ]
}

REQUIREMENTS:
- "nodes" defines the tree structure (id, value, left child id, right child id)
- "current" is the node id being visited
- "traversalOrder" shows values visited so far
- "stack" shows pending nodes
- Show every node visit in order`;

      default:
        throw new Error(`Unknown simulation type: ${type}`);
    }
  }

  validateOutput(sim, type) {
    if (!sim || typeof sim !== 'object') return false;
    if (!Array.isArray(sim.steps) || sim.steps.length === 0) return false;
    if (sim.type !== type) return false;

    switch (type) {
      case 'array_sort':
        if (!Array.isArray(sim.initialArray)) return false;
        return sim.steps.every(s =>
          Array.isArray(s.array) &&
          Array.isArray(s.highlight) &&
          typeof s.swap === 'boolean' &&
          typeof s.description === 'string'
        );

      case 'graph_traversal':
        if (!Array.isArray(sim.nodes) || !Array.isArray(sim.edges)) return false;
        return sim.steps.every(s =>
          Array.isArray(s.visited) &&
          typeof s.current === 'string' &&
          Array.isArray(s.queue || s.stack) &&
          typeof s.description === 'string'
        );

      case 'tree_traversal':
        if (!Array.isArray(sim.nodes)) return false;
        return sim.steps.every(s =>
          typeof s.current === 'string' &&
          Array.isArray(s.traversalOrder) &&
          typeof s.description === 'string'
        );

      default:
        return false;
    }
  }
}

// Export singleton instance
export const simulationAgent = new SimulationAgent();

export default simulationAgent;
