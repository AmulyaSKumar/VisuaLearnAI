/**
 * Normalizes learning content from various formats to the expected schema.
 * Handles field name variations from AI responses and stored content.
 */

/**
 * Extracts a string value from a potentially nested object.
 * Handles cases where AI returns { text: "..." } or { content: "..." } instead of plain strings.
 */
function extractString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (typeof value === 'object' && !Array.isArray(value)) {
    // Try common text field names
    const textFields = ['text', 'content', 'value', 'label', 'name', 'title', 'description', 'body', 'message'];
    for (const field of textFields) {
      if (value[field] && typeof value[field] === 'string') {
        return value[field];
      }
    }
    // If object has only one string property, use it
    const values = Object.values(value);
    const stringVal = values.find(v => typeof v === 'string');
    if (stringVal) return stringVal;

    // Last resort: stringify but warn
    console.warn('extractString: Could not extract string from object, stringifying:', value);
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  if (Array.isArray(value)) {
    // If array, join string elements
    return value.filter(v => typeof v === 'string').join(', ') || fallback;
  }

  return fallback;
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // Check if it's an object with a nested array (e.g., { questions: [...] })
    const keys = Object.keys(value);
    for (const key of keys) {
      if (Array.isArray(value[key])) {
        return value[key];
      }
    }
  }
  return [];
}

function normalizeKeyIdea(idea, index) {
  if (!idea || typeof idea !== 'object') {
    return {
      id: `idea_${index}`,
      title: extractString(idea, `Key idea ${index + 1}`),
      explanation: '',
      difficulty: 'medium',
      analogy: '',
      emoji: '💡'
    };
  }

  // Extract title with fallbacks, using extractString for each possibility
  const titleRaw = idea.title || idea.name || idea.concept;
  const title = extractString(titleRaw, `Key idea ${index + 1}`);

  // Extract explanation with fallbacks
  const explanationRaw = idea.explanation || idea.description || idea.content || idea.text;
  const explanation = extractString(explanationRaw, '');

  // Extract analogy
  const analogyRaw = idea.analogy || idea.think_of_it_like;
  const analogy = extractString(analogyRaw, '');

  // Extract emoji
  const emojiRaw = idea.emoji || idea.icon;
  const emoji = extractString(emojiRaw, '💡');

  // Extract difficulty
  const difficultyRaw = idea.difficulty || idea.importance;
  const difficulty = extractString(difficultyRaw, 'medium');

  return {
    id: idea.id || `idea_${index}`,
    title,
    explanation,
    difficulty,
    analogy,
    emoji
  };
}

function normalizeExample(example, index) {
  if (!example || typeof example !== 'object') {
    return {
      id: `ex_${index}`,
      title: extractString(example, `Example ${index + 1}`),
      description: '',
      real_world_context: '',
      icon: '💡',
      involves_ai: false
    };
  }

  // Extract title
  const titleRaw = example.title || example.name;
  const title = extractString(titleRaw, `Example ${index + 1}`);

  // Extract description
  const descRaw = example.description || example.scenario || example.content;
  const description = extractString(descRaw, '');

  // Extract real world context
  const contextRaw = example.real_world_context || example.realWorldContext || example.explanation || example.context;
  const real_world_context = extractString(contextRaw, '');

  // Extract icon
  const iconRaw = example.icon || example.emoji;
  const icon = extractString(iconRaw, '💡');

  // Handle involves_ai - could be boolean or string
  let involves_ai = false;
  const aiVal = example.involves_ai ?? example.involvesAi ?? example.involvesAI ?? example.is_ai ?? example.ai;
  if (typeof aiVal === 'boolean') {
    involves_ai = aiVal;
  } else if (typeof aiVal === 'string') {
    involves_ai = aiVal.toLowerCase() === 'true' || aiVal.toLowerCase() === 'yes';
  } else if (aiVal) {
    involves_ai = Boolean(aiVal);
  }

  return {
    id: example.id || `ex_${index}`,
    title,
    description,
    real_world_context,
    icon,
    involves_ai
  };
}

function normalizeFlashcard(card, index) {
  if (!card || typeof card !== 'object') {
    // If it's a string, try to parse it as JSON
    if (typeof card === 'string') {
      try {
        const parsed = JSON.parse(card);
        return normalizeFlashcard(parsed, index);
      } catch {
        // Not JSON, use as front text
        return {
          id: `card_${index}`,
          front: card,
          back: '',
          difficulty: index < 6 ? 'beginner' : index < 14 ? 'intermediate' : 'advanced'
        };
      }
    }
    return {
      id: `card_${index}`,
      front: extractString(card, ''),
      back: '',
      difficulty: index < 6 ? 'beginner' : index < 14 ? 'intermediate' : 'advanced'
    };
  }

  // Extract front side
  const frontRaw = card.front || card.question || card.term || card.q;
  const front = extractString(frontRaw, '');

  // Extract back side
  const backRaw = card.back || card.answer || card.definition || card.a;
  const back = extractString(backRaw, '');

  // Extract difficulty
  const difficultyRaw = card.difficulty || card.level;
  let difficulty = extractString(difficultyRaw, '').toLowerCase();
  // Normalize difficulty values
  if (!['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
    difficulty = index < 6 ? 'beginner' : index < 14 ? 'intermediate' : 'advanced';
  }

  return {
    id: card.id || `card_${index}`,
    front,
    back,
    difficulty
  };
}

function normalizeQuizQuestion(question, index) {
  if (!question || typeof question !== 'object') {
    return null;
  }

  // Handle correct answer - convert index to letter if needed
  let correct = question.correct || question.correctAnswer || question.answer || 'A';
  if (typeof correct === 'number') {
    correct = String.fromCharCode(65 + correct); // 0 -> 'A', 1 -> 'B', etc.
  } else if (typeof correct === 'object') {
    correct = extractString(correct, 'A');
  }

  // Extract question text
  const questionRaw = question.question || question.text || question.q;
  const questionText = extractString(questionRaw, `Question ${index + 1}`);

  // Extract options - handle both array of strings and array of objects
  const optionsRaw = question.options || question.choices || question.answers;
  const optionsArray = ensureArray(optionsRaw);
  const options = optionsArray.map(opt => extractString(opt, ''));

  // Extract explanation
  const explanationRaw = question.explanation || question.hint;
  const explanation = extractString(explanationRaw, '');

  return {
    question: questionText,
    options,
    correct,
    explanation
  };
}

function normalizeMindMap(mindMap) {
  if (!mindMap || typeof mindMap !== 'object') {
    return null;
  }

  // Handle different field names - use extractString for each
  const rootRaw = mindMap.root || mindMap.central || mindMap.center || mindMap.topic;
  const root = extractString(rootRaw, 'Main Topic');
  const branches = ensureArray(mindMap.branches || mindMap.nodes || mindMap.children);

  return {
    root,
    branches: branches.map((branch, index) => {
      if (typeof branch === 'string') {
        return { label: branch, children: [] };
      }

      // Extract branch label
      const labelRaw = branch.label || branch.name || branch.title;
      const label = extractString(labelRaw, `Branch ${index + 1}`);

      // Extract children
      const childrenArray = ensureArray(branch.children || branch.nodes || branch.items);
      const children = childrenArray.map(child => {
        if (typeof child === 'string') return child;
        const childLabelRaw = child.label || child.name || child.title;
        return extractString(childLabelRaw, '');
      }).filter(Boolean);

      return { label, children };
    })
  };
}

/**
 * Main normalization function - converts any learning content format to expected schema
 */
export function normalizeLearningContent(content) {
  if (!content) {
    console.warn('normalizeLearningContent: No content provided');
    return null;
  }

  // If content is a string, try to parse it
  if (typeof content === 'string') {
    try {
      // Strip markdown code fences if present
      const clean = content.replace(/```json\s*|```\s*/g, '').trim();
      content = JSON.parse(clean);
    } catch (e) {
      console.error('Failed to parse content string:', e);
      return null;
    }
  }

  console.log('Normalizing learning content:', content);

  // Extract key_ideas with fallbacks
  const keyIdeasRaw = content.key_ideas || content.keyIdeas || content.ideas ||
                      content.concepts || content.key_concepts || content.keypoints || [];
  const keyIdeas = ensureArray(keyIdeasRaw).map(normalizeKeyIdea);

  // Extract examples with fallbacks
  const examplesRaw = content.examples || content.example_list || content.scenarios || [];
  const examples = ensureArray(examplesRaw).map(normalizeExample);

  // Extract flashcards with fallbacks
  const flashcardsRaw = content.flashcards || content.flash_cards || content.cards || [];
  const flashcards = ensureArray(flashcardsRaw).map(normalizeFlashcard);

  // Extract quiz with fallbacks - handle both array and nested object formats
  let quizRaw = content.quiz || content.questions || content.quiz_questions || [];
  if (quizRaw && typeof quizRaw === 'object' && !Array.isArray(quizRaw)) {
    // Handle { questions: [...] } format
    quizRaw = quizRaw.questions || quizRaw.items || [];
  }
  const quiz = ensureArray(quizRaw).map(normalizeQuizQuestion).filter(Boolean);

  // Extract mind_map with fallbacks
  const mindMapRaw = content.mind_map || content.mindMap || content.mindmap || content.concept_map;
  const mindMap = normalizeMindMap(mindMapRaw);

  // Extract image search keywords
  const imageKeywords = content.image_search_keywords || content.imageSearchKeywords ||
                        content.image_keywords || content.keywords || [];

  // Extract topic and title
  const topicRaw = content.topic || content.title;
  const topic = extractString(topicRaw, '');

  const titleRaw = content.title || content.topic;
  const title = extractString(titleRaw, '');

  // Extract summary
  const summaryRaw = content.summary || content.description || content.overview;
  const summary = extractString(summaryRaw, '');

  const normalized = {
    topic,
    title,
    summary,
    key_ideas: keyIdeas,
    examples: examples,
    flashcards: flashcards,
    quiz: quiz,
    mind_map: mindMap,
    image_search_keywords: ensureArray(imageKeywords).map(kw => extractString(kw, '')).filter(Boolean),
    // Preserve any other fields
    generatedAt: content.generatedAt,
    profile: content.profile
  };

  console.log('Normalized content:', normalized);
  return normalized;
}

export default normalizeLearningContent;
