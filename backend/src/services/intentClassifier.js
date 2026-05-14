/**
 * Intent Classifier Service
 * Lightweight LLM-powered intent classification for learning queries
 * Used to route queries to appropriate response modes
 */
import { createTextCompletion } from './openai/azure-client.js';

// Intent types
export const INTENT_TYPES = {
  QUICK_EXPLAIN: 'quick_explain',
  DEEP_LEARN: 'deep_learn',
  CODING_HELP: 'coding_help',
  SIMULATION: 'simulation',
  CONCEPTUAL_NONCS: 'conceptual_noncs',
};

// Complexity levels
export const COMPLEXITY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
};

// Domains
export const DOMAINS = {
  CS: 'cs',
  NON_CS: 'non_cs',
};

// Suggested depth
export const DEPTH_LEVELS = {
  MINIMAL: 'minimal',
  MODERATE: 'moderate',
  COMPREHENSIVE: 'comprehensive',
};

// Cache for recent classifications (TTL: 5 minutes)
const classificationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(query) {
  return query.toLowerCase().trim().slice(0, 200);
}

/**
 * Quick heuristic pre-classification to avoid LLM calls for obvious cases
 * Returns null if uncertain, otherwise returns the classification
 */
function quickHeuristicClassify(query) {
  const lowerQuery = query.toLowerCase().trim();

  // Coding help patterns (errors, debugging, fixing)
  const codingPatterns = [
    /fix\s+(this|my|the)\s+(code|bug|error|issue)/i,
    /why\s+(is|does|am)\s+.*(error|fail|crash|break)/i,
    /debug\s+/i,
    /not\s+working/i,
    /getting\s+(an?\s+)?error/i,
    /how\s+to\s+fix/i,
    /what('s|s)\s+wrong\s+with/i,
  ];

  for (const pattern of codingPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        intent: INTENT_TYPES.CODING_HELP,
        confidence: 0.9,
        fromHeuristic: true,
      };
    }
  }

  // Quick explain patterns
  const quickExplainPatterns = [
    /^what\s+is\s+/i,
    /^explain\s+.{0,30}\s*simply/i,
    /^simply\s+explain/i,
    /^quick(ly)?\s+explain/i,
    /^in\s+simple\s+terms/i,
    /^briefly\s+explain/i,
    /^what\s+does\s+.{0,30}\s+mean/i,
    /^define\s+/i,
  ];

  for (const pattern of quickExplainPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        intent: INTENT_TYPES.QUICK_EXPLAIN,
        confidence: 0.85,
        fromHeuristic: true,
      };
    }
  }

  // Deep learn patterns
  const deepLearnPatterns = [
    /teach\s+me/i,
    /full\s+(course|tutorial|guide)/i,
    /learn\s+.*(from\s+scratch|completely|thoroughly)/i,
    /master\s+/i,
    /in[-\s]depth/i,
    /comprehensive/i,
    /deep\s+dive/i,
    /everything\s+about/i,
  ];

  for (const pattern of deepLearnPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        intent: INTENT_TYPES.DEEP_LEARN,
        confidence: 0.85,
        fromHeuristic: true,
      };
    }
  }

  // Simulation-first patterns (sorting algorithms, data structures, etc.)
  const simulationPatterns = [
    /\b(bubble|quick|merge|heap|insertion|selection)\s*sort/i,
    /\bsorting\s+algorithm/i,
    /\bbinary\s+(search|tree)/i,
    /\blinked\s+list/i,
    /\bstack\s+(and|&)\s+queue/i,
    /\bgraph\s+traversal/i,
    /\b(bfs|dfs)\b/i,
    /\bdijkstra/i,
    /\ba\*\s+algorithm/i,
  ];

  for (const pattern of simulationPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        intent: INTENT_TYPES.SIMULATION,
        confidence: 0.8,
        fromHeuristic: true,
      };
    }
  }

  // Non-CS conceptual patterns
  const nonCSPatterns = [
    /how\s+(does|do)\s+(an?\s+)?(engine|motor|car|plane|rocket|heart|brain|body|cell)/i,
    /\b(biology|chemistry|physics|anatomy|geology|astronomy)\b/i,
    /\b(photosynthesis|mitosis|meiosis|evolution|gravity|magnetism)\b/i,
    /\b(world\s+war|history|geography|economics|politics)\b/i,
    /\b(music\s+theory|art\s+history|philosophy)\b/i,
    /how\s+.*(work|function)/i,
  ];

  // Only apply non-CS if it matches AND doesn't have CS indicators
  const csIndicators = [
    /\b(code|programming|algorithm|function|class|method|api|database|server|frontend|backend|javascript|python|java|react|node)\b/i,
    /\b(variable|loop|array|object|string|integer|boolean)\b/i,
  ];

  const hasNonCSPattern = nonCSPatterns.some(p => p.test(lowerQuery));
  const hasCSIndicator = csIndicators.some(p => p.test(lowerQuery));

  if (hasNonCSPattern && !hasCSIndicator) {
    return {
      intent: INTENT_TYPES.CONCEPTUAL_NONCS,
      confidence: 0.75,
      fromHeuristic: true,
    };
  }

  // No clear heuristic match - need LLM
  return null;
}

/**
 * Classify a learning query into an intent type
 * @param {string} query - The user's learning query
 * @param {object} options - Classification options
 * @returns {Promise<object>} Classification result
 */
export async function classifyLearningIntent(query, options = {}) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }

  const normalizedQuery = query.trim();
  const cacheKey = getCacheKey(normalizedQuery);

  // Check cache first
  const cached = classificationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[IntentClassifier] Cache hit for:', normalizedQuery.slice(0, 50));
    return { ...cached.result, cached: true };
  }

  // Try quick heuristic first
  const heuristicResult = quickHeuristicClassify(normalizedQuery);
  if (heuristicResult && heuristicResult.confidence >= 0.8) {
    console.log('[IntentClassifier] Heuristic match:', heuristicResult.intent, 'confidence:', heuristicResult.confidence);

    // Fill in full classification based on heuristic
    const fullResult = buildFullClassification(normalizedQuery, heuristicResult);

    // Cache the result
    classificationCache.set(cacheKey, {
      result: fullResult,
      timestamp: Date.now(),
    });

    return fullResult;
  }

  // Fall back to LLM classification
  console.log('[IntentClassifier] Using LLM for:', normalizedQuery.slice(0, 50));

  try {
    const text = await createTextCompletion({
      maxTokens: 500,
      system: `You are an intent classifier for an educational platform. Classify learning queries into intent types.

INTENT TYPES:
- quick_explain: Simple "what is X", "explain X simply", brief explanations (1-2 paragraphs sufficient)
- deep_learn: "teach me X", "full course on X", comprehensive learning requests
- coding_help: "fix this code", "why does this error happen", debugging/fixing requests
- simulation: Algorithms like sorting, searching, graph traversal (visual simulation is ideal)
- conceptual_noncs: Non-CS topics like "how engine works", biology, physics (no code needed)

Respond with ONLY valid JSON, no markdown fences:
{
  "intent": "quick_explain|deep_learn|coding_help|simulation|conceptual_noncs",
  "complexity": "beginner|intermediate|advanced",
  "domain": "cs|non_cs",
  "needsCode": true|false,
  "suggestedDepth": "minimal|moderate|comprehensive",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`,
      messages: [{
        role: 'user',
        content: `Classify this learning query: "${normalizedQuery}"`
      }]
    });

    const result = JSON.parse(text.trim());

    // Validate and normalize result
    const normalizedResult = {
      intent: Object.values(INTENT_TYPES).includes(result.intent)
        ? result.intent
        : INTENT_TYPES.QUICK_EXPLAIN,
      complexity: Object.values(COMPLEXITY_LEVELS).includes(result.complexity)
        ? result.complexity
        : COMPLEXITY_LEVELS.INTERMEDIATE,
      domain: Object.values(DOMAINS).includes(result.domain)
        ? result.domain
        : DOMAINS.CS,
      needsCode: typeof result.needsCode === 'boolean' ? result.needsCode : true,
      suggestedDepth: Object.values(DEPTH_LEVELS).includes(result.suggestedDepth)
        ? result.suggestedDepth
        : DEPTH_LEVELS.MODERATE,
      confidence: typeof result.confidence === 'number'
        ? Math.min(1, Math.max(0, result.confidence))
        : 0.7,
      reason: result.reason || 'LLM classification',
      cached: false,
      fromHeuristic: false,
    };

    // Cache the result
    classificationCache.set(cacheKey, {
      result: normalizedResult,
      timestamp: Date.now(),
    });

    // Cleanup old cache entries
    if (classificationCache.size > 200) {
      const oldestKey = classificationCache.keys().next().value;
      classificationCache.delete(oldestKey);
    }

    return normalizedResult;

  } catch (error) {
    console.error('[IntentClassifier] LLM classification failed:', error.message);

    // Return default classification on error
    const defaultResult = {
      intent: INTENT_TYPES.QUICK_EXPLAIN,
      complexity: COMPLEXITY_LEVELS.INTERMEDIATE,
      domain: DOMAINS.CS,
      needsCode: true,
      suggestedDepth: DEPTH_LEVELS.MODERATE,
      confidence: 0.5,
      reason: 'Default classification (LLM error)',
      cached: false,
      fromHeuristic: false,
      error: error.message,
    };

    return defaultResult;
  }
}

/**
 * Build full classification from heuristic match
 */
function buildFullClassification(query, heuristicResult) {
  const lowerQuery = query.toLowerCase();

  // Determine domain
  const csKeywords = ['code', 'programming', 'algorithm', 'function', 'api', 'database',
    'javascript', 'python', 'java', 'react', 'node', 'css', 'html'];
  const hasCSKeyword = csKeywords.some(kw => lowerQuery.includes(kw));
  const domain = hasCSKeyword ? DOMAINS.CS : DOMAINS.NON_CS;

  // Determine complexity from query
  const advancedKeywords = ['advanced', 'complex', 'deep', 'optimization', 'performance'];
  const beginnerKeywords = ['basic', 'beginner', 'simple', 'introduction', 'intro'];

  let complexity = COMPLEXITY_LEVELS.INTERMEDIATE;
  if (advancedKeywords.some(kw => lowerQuery.includes(kw))) {
    complexity = COMPLEXITY_LEVELS.ADVANCED;
  } else if (beginnerKeywords.some(kw => lowerQuery.includes(kw))) {
    complexity = COMPLEXITY_LEVELS.BEGINNER;
  }

  // Map intent to suggested depth
  const depthMapping = {
    [INTENT_TYPES.QUICK_EXPLAIN]: DEPTH_LEVELS.MINIMAL,
    [INTENT_TYPES.DEEP_LEARN]: DEPTH_LEVELS.COMPREHENSIVE,
    [INTENT_TYPES.CODING_HELP]: DEPTH_LEVELS.MODERATE,
    [INTENT_TYPES.SIMULATION]: DEPTH_LEVELS.MODERATE,
    [INTENT_TYPES.CONCEPTUAL_NONCS]: DEPTH_LEVELS.MODERATE,
  };

  // Determine if code is needed
  const needsCode = domain === DOMAINS.CS &&
    heuristicResult.intent !== INTENT_TYPES.CONCEPTUAL_NONCS;

  return {
    intent: heuristicResult.intent,
    complexity,
    domain,
    needsCode,
    suggestedDepth: depthMapping[heuristicResult.intent] || DEPTH_LEVELS.MODERATE,
    confidence: heuristicResult.confidence,
    reason: 'Heuristic pattern match',
    cached: false,
    fromHeuristic: true,
  };
}

/**
 * Clear the classification cache
 */
export function clearClassificationCache() {
  classificationCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: classificationCache.size,
    maxSize: 200,
  };
}

export default classifyLearningIntent;
