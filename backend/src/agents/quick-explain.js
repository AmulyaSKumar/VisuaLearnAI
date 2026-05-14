/**
 * Quick Explain Agent
 * Generates concise, simple explanations for "what is X" style queries
 * Output: 1-2 paragraphs + analogy + optional tiny example
 */
import { BaseAgent } from './base-agent.js';
import { createTextCompletion } from '../services/openai/azure-client.js';

/**
 * Parse JSON response with error handling
 */
function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown fences
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    // Try to find JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse JSON response');
  }
}

export class QuickExplainAgent extends BaseAgent {
  constructor() {
    super('quick-explain', 'Generates concise explanations for simple queries', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, profile = {}, intent = {} } = input;
    if (!query) throw new Error('Query is required');

    const learningLevel = profile.comprehension_level || profile.knowledge_level || 'beginner';
    const learningStyle = profile.learning_style || 'visual';
    const domain = intent.domain || 'cs';
    const needsCode = intent.needsCode !== false && domain === 'cs';

    const text = await createTextCompletion({
      maxTokens: 2000,
      system: `You are an expert educator who excels at simple, clear explanations.
Your goal is to explain concepts in the most accessible way possible.

User Level: ${learningLevel}
Style Preference: ${learningStyle}
Domain: ${domain}

GUIDELINES:
1. Keep explanations SHORT and SIMPLE (2-3 paragraphs max)
2. Use everyday language - avoid jargon
3. Include ONE memorable analogy
4. ${needsCode ? 'Include a TINY code example (5-10 lines max) only if it helps understanding' : 'NO code examples needed for this topic'}
5. Focus on the "what" and "why it matters" - not exhaustive details

CRITICAL: Respond with RAW JSON only. No explanation, no markdown fences. Start with { and end with }.`,
      messages: [{
        role: 'user',
        content: `Explain simply: "${query}"

Return JSON with this EXACT structure:
{
  "topic": "${query}",
  "title": "Clear, engaging title",
  "explanation": "2-3 paragraphs explaining the concept simply. Use short sentences. Define any terms. Focus on what it IS and why it matters.",
  "analogy": {
    "comparison": "It's like [everyday thing]...",
    "explanation": "Just as [everyday thing] does X, [topic] does Y..."
  },
  ${needsCode ? `"example": {
    "code": "// Tiny 5-10 line example\\nconst demo = ...;",
    "language": "javascript",
    "explanation": "What this code does in one sentence"
  },` : ''}
  "key_takeaway": "The ONE thing to remember about this topic",
  "complexity_note": "Brief note about complexity/difficulty (e.g., 'Simple concept, foundational to X')",
  "next_step": "What to learn next if interested",
  "responseMode": "quick_explain"
}`
      }]
    });

    const result = parseJsonResponse(text);

    // Ensure responseMode is set
    result.responseMode = 'quick_explain';

    return result;
  }
}

export const quickExplainAgent = new QuickExplainAgent();
export default quickExplainAgent;
