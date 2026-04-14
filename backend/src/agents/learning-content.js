/**
 * Learning Content Agents
 * Split into separate agents for different content types:
 * - LearnAgent: key_ideas, summary (Learn tab)
 * - ExamplesAgent: examples (Examples tab)
 * - QuizFlashcardsAgent: quiz + flashcards (Quiz & Flashcards tabs)
 * - MindMapAgent: mind_map (Mind Map tab)
 */
import { BaseAgent } from './base-agent.js';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

// ============================================
// JSON PARSING UTILITIES
// ============================================

function stripMarkdownFences(text) {
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7);
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3);
  }
  return cleanedText.trim();
}

function extractJsonBlock(text) {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return text;
  }
  return text.slice(firstBrace, lastBrace + 1);
}

function repairJsonString(text) {
  return text
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

function parseJsonResponse(text) {
  const stripped = stripMarkdownFences(text || '{}');
  const candidates = [stripped, extractJsonBlock(stripped), repairJsonString(extractJsonBlock(stripped))];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next strategy
    }
  }

  // Deep scan for valid JSON
  let braceCount = 0;
  let startIndex = -1;
  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i];
    if (char === '{') {
      if (braceCount === 0) startIndex = i;
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0 && startIndex !== -1) {
        const candidate = stripped.slice(startIndex, i + 1);
        try {
          return JSON.parse(repairJsonString(candidate));
        } catch {
          // Keep scanning
        }
      }
    }
  }

  throw new Error('Failed to parse JSON response');
}

// ============================================
// LEARN AGENT (key_ideas + summary)
// ============================================

export class LearnAgent extends BaseAgent {
  constructor() {
    super('learn-content', 'Generates key concepts and summary for Learn tab', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, profile = {} } = input;
    if (!query) throw new Error('Query is required');

    const learningLevel = profile.comprehension_level || profile.knowledge_level || 'intermediate';
    const learningStyle = profile.learning_style || 'visual';

    const response = await client.messages.create({
      model,
      max_tokens: 6000,
      system: `You are an expert educational content generator. Create DEEP, LAYERED learning content.
User Level: ${learningLevel}, Style: ${learningStyle}
Return ONLY valid JSON, no markdown code blocks.`,
      messages: [{
        role: 'user',
        content: `Generate learning content for: "${query}"

Return JSON with this structure:
{
  "topic": "Main topic name",
  "title": "Professional title",
  "summary": "2-3 sentence overview focusing on WHY this matters",
  "estimated_time": 15,
  "difficulty_level": "beginner|intermediate|advanced",
  "prerequisites": ["topic1", "topic2"],
  "key_ideas": [
    {
      "id": "concept_1",
      "title": "Concept name",
      "subtitle": "One-line hook",
      "difficulty": "foundational|medium|high",
      "time_estimate": 3,
      "blocks": [
        { "type": "concept", "title": "What is X?", "content": "Clear definition" },
        { "type": "code", "title": "Example", "language": "javascript", "code": "code here", "explanation": "What this shows" },
        { "type": "mistake", "title": "Common Mistake", "wrong": "bad code", "right": "good code", "why": "explanation" },
        { "type": "insight", "title": "Pro Tip", "content": "Advanced knowledge" }
      ]
    }
  ],
  "skill_areas": [{ "name": "Area", "weight": 0.3, "concepts": ["concept_1"] }],
  "next_topics": ["topic1", "topic2"],
  "image_search_keywords": ["keyword1", "keyword2"]
}

Generate 3-5 key_ideas, each with multiple blocks (concept, code, mistake, insight).
Focus on WHY things matter, not just WHAT they are.`
      }]
    });

    const text = response.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    return parseJsonResponse(text);
  }
}

// ============================================
// EXAMPLES AGENT
// ============================================

export class ExamplesAgent extends BaseAgent {
  constructor() {
    super('examples-content', 'Generates real-world examples for Examples tab', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, profile = {} } = input;
    if (!query) throw new Error('Query is required');

    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      system: `You are an expert at creating real-world examples. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `Generate 6-8 real-world examples for: "${query}"

Return JSON:
{
  "examples": [
    {
      "id": "ex_1",
      "title": "Example title",
      "description": "What this example demonstrates",
      "scenario": "Detailed real-world scenario",
      "code": "working code example",
      "language": "html|css|javascript|python",
      "explanation": "Why this matters in production",
      "real_world_context": "Where you'd see this in the real world",
      "icon": "💡",
      "involves_ai": false
    }
  ]
}

Include a mix:
- 2-3 basic examples
- 2-3 intermediate examples
- 1-2 advanced/AI-related examples (set involves_ai: true for AI examples)
Each example must have working code.`
      }]
    });

    const text = response.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    return parseJsonResponse(text);
  }
}

// ============================================
// QUIZ + FLASHCARDS AGENT
// ============================================

export class QuizFlashcardsAgent extends BaseAgent {
  constructor() {
    super('quiz-flashcards-content', 'Generates quiz questions and flashcards', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, profile = {} } = input;
    if (!query) throw new Error('Query is required');

    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      system: `You are an expert at creating educational assessments. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `Generate quiz questions and flashcards for: "${query}"

Return JSON:
{
  "quiz": [
    {
      "type": "mcq",
      "question": "Question text",
      "options": ["A option", "B option", "C option", "D option"],
      "correct": "A",
      "explanation": "Why this is correct",
      "why_it_matters": "Real-world relevance"
    },
    {
      "type": "fill_blank",
      "question": "Complete: The ___ attribute specifies...",
      "blank_position": "middle",
      "correct_answer": "href",
      "hint": "Hint text",
      "explanation": "Explanation"
    },
    {
      "type": "true_false",
      "statement": "Statement to evaluate",
      "correct": true,
      "explanation": "Why true/false"
    },
    {
      "type": "output_prediction",
      "code": "console.log(2 + '2')",
      "language": "javascript",
      "options": ["4", "22", "NaN", "Error"],
      "correct": "22",
      "explanation": "Type coercion explanation"
    },
    {
      "type": "code_sandbox",
      "task": "Write code to do X",
      "language": "javascript",
      "starter_code": "// start here",
      "solution": "// solution",
      "validation_keywords": ["keyword1"],
      "hints": ["hint1", "hint2"]
    }
  ],
  "flashcards": [
    { "front": "Question", "back": "Answer", "difficulty": "beginner|intermediate|advanced" }
  ]
}

REQUIREMENTS:
- Generate EXACTLY 15-20 quiz questions with this mix:
  - 5-6 MCQ questions
  - 4 fill_blank questions
  - 2 true_false questions
  - 3-4 output_prediction questions
  - 2 code_sandbox questions
- Questions should progress from easy to hard
- Generate 20 flashcards (6 beginner, 8 intermediate, 6 advanced)`
      }]
    });

    const text = response.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    return parseJsonResponse(text);
  }
}

// ============================================
// MIND MAP AGENT
// ============================================

export class MindMapAgent extends BaseAgent {
  constructor() {
    super('mindmap-content', 'Generates mind map structure', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, profile = {} } = input;
    if (!query) throw new Error('Query is required');

    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: `You are an expert at creating educational mind maps. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `Generate a comprehensive mind map for: "${query}"

Return JSON:
{
  "mind_map": {
    "root": "Central topic",
    "branches": [
      {
        "label": "Main branch 1",
        "children": ["Sub-topic 1", "Sub-topic 2", "Sub-topic 3"]
      },
      {
        "label": "Main branch 2",
        "children": ["Sub-topic A", "Sub-topic B"]
      }
    ]
  }
}

Create 4-6 main branches with 2-4 children each.
Cover: fundamentals, applications, advanced topics, related concepts.`
      }]
    });

    const text = response.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    return parseJsonResponse(text);
  }
}

// ============================================
// COMBINED AGENT (backward compatibility)
// ============================================

export class LearningContentAgent extends BaseAgent {
  constructor() {
    super('learning-content', 'Orchestrates all learning content agents', '1.0.0');
    this.learnAgent = new LearnAgent();
    this.examplesAgent = new ExamplesAgent();
    this.quizFlashcardsAgent = new QuizFlashcardsAgent();
    this.mindMapAgent = new MindMapAgent();
  }

  async execute(input, context = {}) {
    const { query, profile = {}, contentType } = input;
    if (!query) throw new Error('Query is required');

    // If specific content type requested, return only that
    if (contentType) {
      switch (contentType) {
        case 'learn':
          return await this.learnAgent.execute(input, context);
        case 'examples':
          return await this.examplesAgent.execute(input, context);
        case 'quiz-flashcards':
          return await this.quizFlashcardsAgent.execute(input, context);
        case 'mindmap':
          return await this.mindMapAgent.execute(input, context);
        default:
          throw new Error(`Unknown content type: ${contentType}`);
      }
    }

    // Default: fetch all content in parallel
    const [learnContent, examplesContent, quizFlashcardsContent, mindMapContent] = await Promise.all([
      this.learnAgent.execute(input, context),
      this.examplesAgent.execute(input, context),
      this.quizFlashcardsAgent.execute(input, context),
      this.mindMapAgent.execute(input, context),
    ]);

    // Merge all content
    return {
      ...learnContent,
      ...examplesContent,
      ...quizFlashcardsContent,
      ...mindMapContent,
      generatedAt: new Date().toISOString(),
    };
  }
}

// Export instances
export const learnAgent = new LearnAgent();
export const examplesAgent = new ExamplesAgent();
export const quizFlashcardsAgent = new QuizFlashcardsAgent();
export const mindMapAgent = new MindMapAgent();
export const learningContentAgent = new LearningContentAgent();

export default learningContentAgent;
