/**
 * Conceptual Agent
 * Generates rich explanations for non-CS topics (engines, biology, physics, etc.)
 * NO code blocks - focuses on visual descriptions and analogies
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

export class ConceptualAgent extends BaseAgent {
  constructor() {
    super('conceptual', 'Generates rich explanations for non-CS topics', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, profile = {}, intent = {} } = input;
    if (!query) throw new Error('Query is required');

    const learningLevel = profile.comprehension_level || profile.knowledge_level || 'intermediate';
    const learningStyle = profile.learning_style || 'visual';
    const complexity = intent.complexity || 'intermediate';

    // Determine number of concepts based on complexity
    const conceptCount = complexity === 'beginner' ? 3 : complexity === 'advanced' ? 6 : 4;

    const text = await createTextCompletion({
      maxTokens: 8000,
      system: `You are an expert educator specializing in explaining real-world concepts without code.
Your explanations should be rich with visual descriptions, analogies, and relatable examples.

User Level: ${learningLevel}
Style Preference: ${learningStyle}

GUIDELINES:
1. NO CODE BLOCKS - this is for non-CS topics
2. Use vivid visual descriptions ("imagine...", "picture this...")
3. Connect concepts to everyday experiences
4. Include real-world examples and applications
5. Explain processes step-by-step where applicable
6. Use analogies liberally to make abstract concepts concrete

CRITICAL: Respond with RAW JSON only. No explanation, no markdown fences. Start with { and end with }.`,
      messages: [{
        role: 'user',
        content: `Create learning content for: "${query}"

Return JSON with this EXACT structure:
{
  "topic": "${query}",
  "title": "Engaging, descriptive title",
  "overview": "2-3 sentence introduction that hooks the reader and explains why this matters",
  "key_concepts": [
    {
      "id": "concept_1",
      "title": "Specific aspect of ${query}",
      "explanation": "Detailed 2-3 paragraph explanation. Use vivid language. Help the reader visualize the concept.",
      "visual_description": "Describe what this would look like if you could see it. Use 'imagine' or 'picture' language.",
      "real_world_example": "A concrete example from everyday life or industry",
      "why_it_matters": "Why understanding this concept is important"
    }
  ],
  "main_analogy": {
    "comparison": "The central analogy for understanding ${query}",
    "breakdown": "How different parts of ${query} map to parts of the analogy"
  },
  "how_it_works": {
    "overview": "Brief summary of the process/mechanism",
    "steps": [
      {
        "step": 1,
        "title": "Step name",
        "description": "What happens in this step",
        "visual": "What you would see/observe"
      }
    ]
  },
  "interesting_facts": [
    "Fascinating fact 1 about ${query}",
    "Surprising fact 2",
    "Counter-intuitive fact 3"
  ],
  "common_misconceptions": [
    {
      "myth": "Common misconception",
      "reality": "The actual truth"
    }
  ],
  "applications": [
    "Real-world application 1",
    "Application 2",
    "Application 3"
  ],
  "learn_more": [
    "Related topic to explore next",
    "Another related topic"
  ],
  "difficulty_level": "${complexity}",
  "estimated_time": 15,
  "responseMode": "conceptual_noncs"
}

Generate ${conceptCount} key_concepts that progressively build understanding.
Include 4-6 steps in how_it_works if the topic involves a process.
Make visual_description fields vivid and immersive.`
      }]
    });

    const result = parseJsonResponse(text);

    // Ensure responseMode is set
    result.responseMode = 'conceptual_noncs';

    return result;
  }
}

export const conceptualAgent = new ConceptualAgent();
export default conceptualAgent;
