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

function normalizeContentBlock(block, index) {
  if (!block || typeof block !== 'object') {
    return null;
  }

  const type = extractString(block.type, 'concept').toLowerCase();
  const title = extractString(block.title, '');

  const normalized = {
    type,
    title,
  };

  // Preserve type-specific fields
  switch (type) {
    case 'concept':
    case 'insight':
      normalized.content = extractString(block.content || block.text || block.body, '');
      break;
    case 'code':
      normalized.code = extractString(block.code, '');
      normalized.language = extractString(block.language, 'javascript');
      normalized.explanation = extractString(block.explanation, '');
      break;
    case 'mistake':
      normalized.wrong = extractString(block.wrong || block.incorrect, '');
      normalized.right = extractString(block.right || block.correct, '');
      normalized.why = extractString(block.why || block.explanation, '');
      break;
    case 'comparison':
      normalized.items = ensureArray(block.items);
      break;
    case 'challenge':
      normalized.prompt = extractString(block.prompt || block.question, '');
      normalized.starter_code = extractString(block.starter_code || block.starterCode, '');
      normalized.solution = extractString(block.solution, '');
      normalized.hints = ensureArray(block.hints);
      break;
    default:
      // Preserve any content field
      normalized.content = extractString(block.content || block.text || block.body, '');
  }

  return normalized;
}

function normalizeKeyIdea(idea, index) {
  if (!idea || typeof idea !== 'object') {
    return {
      id: `idea_${index}`,
      title: extractString(idea, `Key idea ${index + 1}`),
      subtitle: '',
      explanation: '',
      difficulty: 'foundational',
      analogy: '',
      time_estimate: 3,
      blocks: []
    };
  }

  // Extract title with fallbacks, using extractString for each possibility
  const titleRaw = idea.title || idea.name || idea.concept;
  const title = extractString(titleRaw, `Key idea ${index + 1}`);

  // Extract subtitle
  const subtitleRaw = idea.subtitle || idea.hook || idea.tagline;
  const subtitle = extractString(subtitleRaw, '');

  // Extract explanation with fallbacks (for legacy content without blocks)
  const explanationRaw = idea.explanation || idea.description || idea.content || idea.text;
  const explanation = extractString(explanationRaw, '');

  // Extract analogy
  const analogyRaw = idea.analogy || idea.think_of_it_like;
  const analogy = extractString(analogyRaw, '');

  // Extract difficulty
  const difficultyRaw = idea.difficulty || idea.importance || idea.level;
  let difficulty = extractString(difficultyRaw, 'foundational').toLowerCase();
  // Normalize difficulty values
  if (!['foundational', 'medium', 'high', 'beginner', 'intermediate', 'advanced'].includes(difficulty)) {
    difficulty = 'foundational';
  }

  // Extract time estimate
  const timeEstimate = idea.time_estimate || idea.timeEstimate || idea.duration || 3;

  // IMPORTANT: Extract and normalize blocks array
  const blocksRaw = idea.blocks || idea.content_blocks || idea.contentBlocks || [];
  const blocks = ensureArray(blocksRaw)
    .map(normalizeContentBlock)
    .filter(Boolean);

  return {
    id: idea.id || `idea_${index}`,
    title,
    subtitle,
    explanation,
    difficulty,
    analogy,
    time_estimate: typeof timeEstimate === 'number' ? timeEstimate : parseInt(timeEstimate, 10) || 3,
    blocks
  };
}

function normalizeExample(example, index) {
  if (!example || typeof example !== 'object') {
    return {
      id: `ex_${index}`,
      title: extractString(example, `Example ${index + 1}`),
      description: '',
      scenario: '',
      code: '',
      language: 'javascript',
      explanation: '',
      real_world_context: '',
      search_keywords: [],
      involves_ai: false,
      buggy_version: '',
      bug_explanation: '',
      challenge_question: '',
      challenge_options: []
    };
  }

  // Extract title
  const titleRaw = example.title || example.name;
  const title = extractString(titleRaw, `Example ${index + 1}`);

  // Extract description
  const descRaw = example.description || example.summary;
  const description = extractString(descRaw, '');

  // Extract scenario (the full context story)
  const scenarioRaw = example.scenario || example.context || example.story;
  const scenario = extractString(scenarioRaw, '');

  // Extract code
  const codeRaw = example.code || example.codeExample || example.code_example;
  const code = extractString(codeRaw, '');

  // Extract language
  const language = extractString(example.language, 'javascript');

  // Extract explanation
  const explanationRaw = example.explanation || example.codeExplanation;
  const explanation = extractString(explanationRaw, '');

  // Extract real world context
  const contextRaw = example.real_world_context || example.realWorldContext || example.context_description;
  const real_world_context = extractString(contextRaw, '');

  // Extract search keywords
  const searchKeywordsRaw = example.search_keywords || example.searchKeywords || example.keywords;
  const search_keywords = ensureArray(searchKeywordsRaw).map(kw => extractString(kw, '')).filter(Boolean);

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

  // Extract buggy version for "Spot the Bug" game
  const buggyVersionRaw = example.buggy_version || example.buggyVersion || example.buggy_code;
  const buggy_version = extractString(buggyVersionRaw, '');

  // Extract bug explanation
  const bugExplanationRaw = example.bug_explanation || example.bugExplanation || example.bug_fix;
  const bug_explanation = extractString(bugExplanationRaw, '');

  // Extract challenge question for case study
  const challengeQuestionRaw = example.challenge_question || example.challengeQuestion;
  const challenge_question = extractString(challengeQuestionRaw, '');

  // Extract challenge options
  const challengeOptionsRaw = example.challenge_options || example.challengeOptions;
  const challenge_options = ensureArray(challengeOptionsRaw).map(opt => extractString(opt, '')).filter(Boolean);

  return {
    id: example.id || `ex_${index}`,
    title,
    description,
    scenario,
    code,
    language,
    explanation,
    real_world_context,
    search_keywords,
    involves_ai,
    buggy_version,
    bug_explanation,
    challenge_question,
    challenge_options
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

  // Extract question type (mcq, fill_blank, true_false, output_prediction, code_sandbox)
  const type = extractString(question.type, 'mcq').toLowerCase();

  // Base normalized question
  const normalized = {
    type,
    explanation: extractString(question.explanation || question.hint, ''),
    why_it_matters: extractString(question.why_it_matters || question.whyItMatters, ''),
  };

  // Handle type-specific fields
  switch (type) {
    case 'mcq':
    default: {
      // Extract question text
      const questionRaw = question.question || question.text || question.q;
      normalized.question = extractString(questionRaw, `Question ${index + 1}`);

      // Extract options - handle both array of strings and array of objects
      const optionsRaw = question.options || question.choices || question.answers;
      const optionsArray = ensureArray(optionsRaw);
      normalized.options = optionsArray.map(opt => extractString(opt, ''));

      // Handle correct answer - convert index to letter if needed
      let correct = question.correct || question.correctAnswer || question.answer || 'A';
      if (typeof correct === 'number') {
        correct = String.fromCharCode(65 + correct); // 0 -> 'A', 1 -> 'B', etc.
      } else if (typeof correct === 'object') {
        correct = extractString(correct, 'A');
      }
      normalized.correct = correct;
      break;
    }

    case 'fill_blank': {
      normalized.question = extractString(question.question || question.text, `Question ${index + 1}`);
      normalized.correct_answer = extractString(question.correct_answer || question.correctAnswer || question.answer, '');
      normalized.blank_position = extractString(question.blank_position || question.blankPosition, 'middle');
      normalized.hint = extractString(question.hint, '');
      break;
    }

    case 'true_false': {
      normalized.statement = extractString(question.statement || question.question || question.text, '');
      // Handle boolean correct value
      const correctVal = question.correct ?? question.answer ?? true;
      normalized.correct = typeof correctVal === 'boolean' ? correctVal :
        (String(correctVal).toLowerCase() === 'true');
      break;
    }

    case 'output_prediction': {
      normalized.code = extractString(question.code, '');
      normalized.language = extractString(question.language, 'javascript');

      // Extract options
      const optionsRaw = question.options || question.choices;
      const optionsArray = ensureArray(optionsRaw);
      normalized.options = optionsArray.map(opt => extractString(opt, ''));

      // Extract correct - could be an option string or index
      normalized.correct = extractString(question.correct || question.answer, '');
      break;
    }

    case 'code_sandbox': {
      normalized.task = extractString(question.task || question.prompt || question.question, '');
      normalized.language = extractString(question.language, 'javascript');
      normalized.starter_code = extractString(question.starter_code || question.starterCode, '');
      normalized.solution = extractString(question.solution, '');
      normalized.validation_keywords = ensureArray(question.validation_keywords || question.validationKeywords);
      normalized.hints = ensureArray(question.hints);
      break;
    }
  }

  return normalized;
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
    responseMode: content.responseMode || content.response_mode || null,
    answer: extractString(content.answer, ''),
    answer_type: extractString(content.answer_type || content.answerType, ''),
    explanation: extractString(content.explanation, ''),
    analogy: content.analogy || null,
    example: content.example || null,
    key_takeaway: extractString(content.key_takeaway || content.keyTakeaway, ''),
    complexity_note: extractString(content.complexity_note || content.complexityNote, ''),
    next_step: extractString(content.next_step || content.nextStep, ''),
    // Preserve any other fields
    generatedAt: content.generatedAt,
    profile: content.profile
  };

  console.log('Normalized content:', normalized);
  return normalized;
}

export default normalizeLearningContent;
