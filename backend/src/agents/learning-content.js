/**
 * LearningContentAgent
 * Generates comprehensive structured learning content from a topic
 * Produces: topic extraction, concepts, examples, mindmap, flashcards, quiz, learning path
 */
import { BaseAgent } from './base-agent.js';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

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

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeLearningContent(content, query, profile) {
  const topic = content?.topic || query;
  const summary =
    typeof content?.summary === 'string' && content.summary.trim()
      ? content.summary
      : `A structured overview of ${query}.`;

  // Normalize key_ideas (new schema)
  let keyIdeas = normalizeArray(content?.key_ideas);
  if (keyIdeas.length === 0) {
    keyIdeas = [
      {
        id: 'idea_1',
        title: `Core concept of ${topic}`,
        explanation: `${topic} is a fundamental concept that forms the basis for understanding related topics.`,
        difficulty: 'foundational',
        analogy: `Think of ${topic} like building blocks - each piece connects to form a larger picture.`,
        emoji: '🧩'
      },
      {
        id: 'idea_2',
        title: `Applications of ${topic}`,
        explanation: `Understanding ${topic} enables practical applications in real-world scenarios.`,
        difficulty: 'medium',
        analogy: `It's like learning to ride a bike - once you grasp the basics, you can go anywhere.`,
        emoji: '🚀'
      }
    ];
  }

  // Normalize examples (new schema with involves_ai field)
  let examples = normalizeArray(content?.examples);
  if (examples.length === 0) {
    examples = [
      {
        id: 'ex_1',
        title: `Real-world application of ${topic}`,
        description: `Consider how ${topic} is applied in everyday situations.`,
        real_world_context: `This concept is commonly used in industry and academia.`,
        icon: '💡',
        involves_ai: false
      },
      {
        id: 'ex_2',
        title: `${topic} in practice`,
        description: `Professionals working with ${topic} encounter common patterns.`,
        real_world_context: `Recognizing these patterns helps build problem-solving skills.`,
        icon: '🔧',
        involves_ai: false
      }
    ];
  }

  // Normalize quiz (new schema with letter-based correct answers)
  let quiz = normalizeArray(content?.quiz);
  if (quiz.length === 0 && content?.quiz?.questions) {
    // Convert old format to new format
    quiz = content.quiz.questions.map((q, idx) => ({
      question: q.question,
      options: q.options,
      correct: typeof q.correct === 'number' ? String.fromCharCode(65 + q.correct) : q.correct,
      explanation: q.explanation || ''
    }));
  }

  // Normalize flashcards (with difficulty levels)
  let flashcards = normalizeArray(content?.flashcards);
  // Ensure each flashcard has a difficulty level
  flashcards = flashcards.map((card, idx) => ({
    ...card,
    difficulty: card.difficulty || (idx < 6 ? 'beginner' : idx < 14 ? 'intermediate' : 'advanced')
  }));
  if (flashcards.length === 0) {
    flashcards = [
      { front: `What is ${topic}?`, back: `${topic} is a concept that involves understanding key principles and their applications.`, difficulty: 'beginner' },
      { front: `Why is ${topic} important?`, back: `It forms the foundation for more advanced concepts and has practical applications.`, difficulty: 'beginner' }
    ];
  }

  // Normalize mind_map (new schema)
  let mindMap = content?.mind_map || content?.mindmap;
  if (!mindMap || !mindMap.root) {
    mindMap = {
      root: topic,
      branches: [
        { label: 'Core Concepts', children: ['Fundamentals', 'Principles'] },
        { label: 'Applications', children: ['Practical Uses', 'Examples'] },
        { label: 'Advanced Topics', children: ['Deep Dive', 'Extensions'] }
      ]
    };
  }

  // Normalize image_search_keywords
  let imageSearchKeywords = normalizeArray(content?.image_search_keywords);
  if (imageSearchKeywords.length === 0) {
    imageSearchKeywords = [
      `${topic} concept`,
      `${topic} diagram`,
      `${topic} illustration`
    ];
  }

  return {
    topic,
    title: content?.title || `Understanding ${topic}`,
    summary,
    key_ideas: keyIdeas,
    examples,
    quiz,
    flashcards,
    mind_map: mindMap,
    image_search_keywords: imageSearchKeywords,
    generatedAt: new Date().toISOString(),
    profile: {
      level: profile.level,
      style: profile.style,
      pace: profile.pace,
    },
  };
}

function createFallbackLearningContent(query, rawText, profile) {
  const cleanedText = (rawText || '')
    .replace(/```json|```/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = cleanedText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const summary =
    sentences.slice(0, 2).join(' ') ||
    `A structured overview of ${query}.`;

  // Generate fallback key_ideas based on the query
  const fallbackKeyIdeas = sentences.slice(0, 4).map((sentence, index) => ({
    id: `idea_${index + 1}`,
    title: `Key idea ${index + 1}`,
    explanation: sentence,
    difficulty: index === 0 ? 'foundational' : index === 1 ? 'medium' : 'high',
    analogy: `Think of this concept as a building block for understanding ${query}.`,
    emoji: ['🧩', '💡', '🎯', '🔑'][index] || '📚'
  }));

  // Ensure we have at least 2 key ideas
  if (fallbackKeyIdeas.length < 2) {
    fallbackKeyIdeas.push(
      {
        id: 'idea_1',
        title: `Core concept of ${query}`,
        explanation: `${query} is a fundamental concept that forms the basis for understanding related topics.`,
        difficulty: 'foundational',
        analogy: `Think of ${query} like building blocks - each piece connects to form a larger picture.`,
        emoji: '🧩'
      },
      {
        id: 'idea_2',
        title: `Applications of ${query}`,
        explanation: `Understanding ${query} enables practical applications in real-world scenarios.`,
        difficulty: 'medium',
        analogy: `It's like learning to ride a bike - once you grasp the basics, you can go anywhere.`,
        emoji: '🚀'
      }
    );
  }

  // Generate fallback examples with involves_ai field
  const fallbackExamples = [
    {
      id: 'ex_1',
      title: `Real-world application of ${query}`,
      description: `Consider how ${query} is applied in everyday situations. This helps understand its practical relevance.`,
      real_world_context: `Understanding ${query} in context makes the concept more tangible and memorable.`,
      icon: '💡',
      involves_ai: false
    },
    {
      id: 'ex_2',
      title: `${query} in practice`,
      description: `When working with ${query}, professionals often encounter common patterns and challenges.`,
      real_world_context: `Recognizing these patterns helps build intuition and problem-solving skills.`,
      icon: '🔧',
      involves_ai: false
    },
    {
      id: 'ex_3',
      title: `Learning from ${query} examples`,
      description: `Studying examples of ${query} reveals the underlying principles at work.`,
      real_world_context: `Examples serve as anchors for understanding abstract concepts.`,
      icon: '📖',
      involves_ai: false
    },
    {
      id: 'ex_4',
      title: `AI-enhanced ${query}`,
      description: `Modern applications often use AI to enhance ${query} capabilities.`,
      real_world_context: `AI can automate and optimize aspects of ${query}.`,
      icon: '🤖',
      involves_ai: true
    }
  ];

  // Generate fallback quiz questions
  const fallbackQuiz = [
    {
      question: `What is the main purpose of understanding ${query}?`,
      options: [
        'To build a foundation for advanced concepts',
        'To memorize facts without context',
        'To avoid practical applications',
        'To skip fundamentals'
      ],
      correct: 'A',
      explanation: `Understanding ${query} provides a foundation for more advanced concepts and real-world applications.`
    },
    {
      question: `Which approach is most effective for learning ${query}?`,
      options: [
        'Memorizing definitions only',
        'Combining theory with practical examples',
        'Skipping the basics',
        'Avoiding questions'
      ],
      correct: 'B',
      explanation: `Combining theoretical understanding with practical examples helps reinforce learning.`
    }
  ];

  // Generate fallback flashcards (20 cards with difficulty levels)
  const fallbackFlashcards = [
    // Beginner cards (6)
    { front: `What is ${query}?`, back: `${query} is a concept that involves understanding key principles and their applications.`, difficulty: 'beginner' },
    { front: `Why is ${query} important?`, back: `It forms the foundation for more advanced concepts and has practical applications.`, difficulty: 'beginner' },
    { front: `What are the basic components of ${query}?`, back: `The basic components include fundamental elements that work together to form the concept.`, difficulty: 'beginner' },
    { front: `Who uses ${query}?`, back: `Professionals, students, and enthusiasts who work in related fields.`, difficulty: 'beginner' },
    { front: `Where is ${query} commonly applied?`, back: `In education, industry, and everyday problem-solving scenarios.`, difficulty: 'beginner' },
    { front: `When should you learn ${query}?`, back: `When you want to build a foundation for understanding related topics.`, difficulty: 'beginner' },
    // Intermediate cards (8)
    { front: `How do you apply ${query} in practice?`, back: `By understanding the core principles and practicing with real-world examples.`, difficulty: 'intermediate' },
    { front: `What are common misconceptions about ${query}?`, back: `Many people oversimplify it or confuse it with related concepts.`, difficulty: 'intermediate' },
    { front: `How does ${query} relate to other concepts?`, back: `It connects to broader topics and builds upon foundational knowledge.`, difficulty: 'intermediate' },
    { front: `What skills are needed to master ${query}?`, back: `Critical thinking, practice, and the ability to connect theory to application.`, difficulty: 'intermediate' },
    { front: `What are the key principles of ${query}?`, back: `Core principles include understanding fundamentals, practicing regularly, and applying knowledge.`, difficulty: 'intermediate' },
    { front: `How has ${query} evolved over time?`, back: `It has developed through research, practical application, and technological advances.`, difficulty: 'intermediate' },
    { front: `What tools or methods support ${query}?`, back: `Various frameworks, technologies, and methodologies enhance understanding and application.`, difficulty: 'intermediate' },
    { front: `How do experts approach ${query}?`, back: `Experts break it into components, practice systematically, and stay updated on developments.`, difficulty: 'intermediate' },
    // Advanced cards (6)
    { front: `What are the limitations of ${query}?`, back: `Like any concept, it has boundaries and edge cases where it may not apply directly.`, difficulty: 'advanced' },
    { front: `How do you troubleshoot problems with ${query}?`, back: `By analyzing root causes, testing hypotheses, and applying systematic debugging.`, difficulty: 'advanced' },
    { front: `What advanced techniques exist for ${query}?`, back: `Advanced techniques include optimization, edge case handling, and integration with other systems.`, difficulty: 'advanced' },
    { front: `How do you evaluate mastery of ${query}?`, back: `Through practical application, teaching others, and solving novel problems.`, difficulty: 'advanced' },
    { front: `What are future trends in ${query}?`, back: `Emerging trends include AI integration, automation, and cross-disciplinary applications.`, difficulty: 'advanced' },
    { front: `How do you contribute to the field of ${query}?`, back: `Through research, sharing knowledge, building tools, and mentoring others.`, difficulty: 'advanced' }
  ];

  // Generate fallback mind_map
  const fallbackMindMap = {
    root: query,
    branches: [
      { label: 'Fundamentals', children: ['Core Concepts', 'Basic Principles'] },
      { label: 'Applications', children: ['Real-world Uses', 'Practical Examples'] },
      { label: 'Advanced Topics', children: ['Deep Dive', 'Extensions'] }
    ]
  };

  return normalizeLearningContent(
    {
      topic: query,
      title: `Understanding ${query}`,
      summary,
      key_ideas: fallbackKeyIdeas,
      examples: fallbackExamples,
      quiz: fallbackQuiz,
      flashcards: fallbackFlashcards,
      mind_map: fallbackMindMap,
      image_search_keywords: [
        `${query} concept diagram`,
        `${query} illustration`,
        `${query} education`
      ]
    },
    query,
    profile,
  );
}

export class LearningContentAgent extends BaseAgent {
  constructor() {
    super(
      'learning-content',
      'Generates comprehensive structured learning content including mindmaps, flashcards, quizzes',
      '1.0.0'
    );
  }

  parseLearningContent(text) {
    const stripped = stripMarkdownFences(text || '{}');
    const candidates = [stripped, extractJsonBlock(stripped), repairJsonString(extractJsonBlock(stripped))];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      try {
        return JSON.parse(candidate);
      } catch {
        // Try the next recovery strategy.
      }
    }

    let braceCount = 0;
    let startIndex = -1;

    for (let index = 0; index < stripped.length; index += 1) {
      const character = stripped[index];

      if (character === '{') {
        if (braceCount === 0) {
          startIndex = index;
        }
        braceCount += 1;
      } else if (character === '}') {
        braceCount -= 1;

        if (braceCount === 0 && startIndex !== -1) {
          const candidate = stripped.slice(startIndex, index + 1);

          try {
            return JSON.parse(repairJsonString(candidate));
          } catch {
            // Keep scanning in case a later JSON block is valid.
          }
        }
      }
    }

    throw new Error('Learning content generator returned malformed JSON');
  }

  async execute(input, context = {}) {
    const { query, profile = {} } = input;

    if (!query) {
      throw new Error('Query is required');
    }

    const learningLevel = profile.comprehension_level || profile.knowledge_level || 'intermediate';
    const learningStyle = profile.learning_style || 'visual';
    const pace = profile.pace_preference || 'normal';

    const systemPrompt = `You are an expert educational content generator creating DEEP, LAYERED learning content. Each concept should feel like a mini-lesson, not a flashcard.

USER PROFILE:
- Level: ${learningLevel}
- Style: ${learningStyle}
- Pace: ${pace}

You MUST respond with ONLY valid JSON (no markdown, no code blocks, no explanation outside JSON).

CRITICAL: Generate DEEP content with multiple layers per concept. Each concept needs:
1. Definition (what it is)
2. Structure/Mechanics (how it works internally)
3. Real Usage (practical code examples)
4. Common Mistakes (what beginners get wrong)
5. Advanced Insight (interview-level knowledge)

CONTENT TYPES to include in each concept's "blocks" array:
- "concept": Theory explanation
- "code": Code example with language specified
- "mistake": Common error with fix
- "comparison": Compare two related things
- "challenge": Mini exercise for the reader
- "insight": Deep dive or interview tip

The JSON schema:
{
  "topic": "Main topic",
  "title": "Professional title",
  "summary": "2-3 sentence overview focusing on WHY this matters",
  "estimated_time": 15,
  "difficulty_level": "beginner|intermediate|advanced",
  "prerequisites": ["topic1", "topic2"],
  "key_ideas": [
    {
      "id": "concept_1",
      "title": "Concept name",
      "subtitle": "One-line hook that makes it interesting",
      "difficulty": "foundational|medium|high",
      "time_estimate": 3,
      "blocks": [
        {
          "type": "concept",
          "title": "What is X?",
          "content": "Clear definition in 2-3 sentences"
        },
        {
          "type": "concept",
          "title": "How it works",
          "content": "Internal mechanics explanation"
        },
        {
          "type": "code",
          "title": "Basic Usage",
          "language": "html|css|javascript|python|etc",
          "code": "actual code here",
          "explanation": "What this code demonstrates"
        },
        {
          "type": "mistake",
          "title": "Common Mistake",
          "wrong": "incorrect code or approach",
          "right": "correct code or approach",
          "why": "Explanation of why this matters"
        },
        {
          "type": "comparison",
          "title": "X vs Y",
          "items": [
            { "name": "X", "description": "what X does", "when_to_use": "use case" },
            { "name": "Y", "description": "what Y does", "when_to_use": "use case" }
          ]
        },
        {
          "type": "insight",
          "title": "Interview Insight",
          "content": "Advanced knowledge that impresses in interviews"
        },
        {
          "type": "challenge",
          "title": "Quick Challenge",
          "prompt": "Task description",
          "starter_code": "optional starter code",
          "solution": "solution code",
          "hints": ["hint1", "hint2"]
        }
      ]
    }
  ],
  "examples": [
    {
      "id": "ex_1",
      "title": "Real-world example title",
      "scenario": "Detailed real-world scenario",
      "code": "working code example",
      "language": "html|css|javascript",
      "explanation": "Why this matters in production",
      "involves_ai": false
    }
  ],
  "quiz": [
    {
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct": "A|B|C|D",
      "explanation": "Why this is correct",
      "misconception": "What wrong answers reveal about understanding"
    }
  ],
  "flashcards": [
    { "front": "Question", "back": "Answer", "difficulty": "beginner|intermediate|advanced" }
  ],
  "mind_map": {
    "root": "Central topic",
    "branches": [
      { "label": "Branch", "children": ["Child1", "Child2"] }
    ]
  },
  "skill_areas": [
    { "name": "Area name", "weight": 0.3, "concepts": ["concept_1", "concept_2"] }
  ],
  "next_topics": ["suggested topic 1", "suggested topic 2"],
  "image_search_keywords": ["keyword1", "keyword2"]
}`;

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: `Generate DEEP, LAYERED learning content for: "${query}"

CRITICAL: Each concept must feel like a MINI-LESSON with multiple content blocks.

REQUIREMENTS:
1. 3-5 key_ideas, EACH with a "blocks" array containing:
   - At least 1 "concept" block (definition + mechanics)
   - At least 1 "code" block with working code example
   - At least 1 "mistake" block showing common errors
   - At least 1 "insight" or "comparison" block
   - Optionally a "challenge" block

2. Make content PRACTICAL and REAL:
   - Instead of "HTML attributes provide info" → "Why img tags break layouts without width/height (CLS issue)"
   - Focus on WHY things matter, not just WHAT they are

3. Include 4+ examples with real code that runs
4. Include 5+ quiz questions with misconception explanations
5. Include 20 flashcards (6 beginner, 8 intermediate, 6 advanced)
6. Include mind_map, skill_areas, next_topics

CONTENT DEPTH per concept:
- Level 1: Definition (what is it?)
- Level 2: Structure (how does it work internally?)
- Level 3: Real usage (show working code)
- Level 4: Common mistakes (what breaks and why)
- Level 5: Advanced insight (interview-level knowledge)

Return ONLY valid JSON, no markdown code blocks.`
          }
        ],
        system: systemPrompt,
      });

      const text = response.content
        .filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join('\n');

      let content;

      try {
        content = this.parseLearningContent(text);
      } catch (parseError) {
        console.warn('[LearningContentAgent] Falling back after parse failure:', parseError.message);
        return createFallbackLearningContent(query, text, {
          level: learningLevel,
          style: learningStyle,
          pace,
        });
      }

      return normalizeLearningContent(content, query, {
        level: learningLevel,
        style: learningStyle,
        pace,
      });
    } catch (error) {
      console.error('[LearningContentAgent] Error:', error.message);
      throw error;
    }
  }
}

export const learningContentAgent = new LearningContentAgent();
export default learningContentAgent;
