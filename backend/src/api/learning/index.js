/**
 * Learning Content API
 * Generates comprehensive structured learning content
 * Works alongside chat API for enhanced learning experience
 * Supports RAG (Retrieval-Augmented Generation) from uploaded documents
 */
import { Router } from 'express';
import { learningContentAgent, regenerateBlockAgent } from '../../agents/learning-content.js';
import { learningOrchestrator } from '../../agents/learning-orchestrator.js';
import { analyzeUserProfile, getUserMetrics } from '../../agents/personalization.js';
import {
  bandit,
  getBanditDecision,
  recordReward,
  recordRewardFromInteraction,
  enforceLearningContentAction,
  getActionInstructions,
} from '../../bandit/index.js';
import { getCognitiveState } from '../../services/learningState.js';
import {
  getDocument,
  retrieveChunks,
  formatChunksAsContext,
} from '../../services/rag/index.js';
import { processPdfFromStorage } from '../../services/rag/pdfProcessor.js';
import { classifySimulationIntent, mightBeSimulationRelated } from '../../simulation/classifier.js';
import { saveLearningResource, RESOURCE_TYPES } from '../../database/client.js';
import { searchForLearning } from '../../services/webSearch.js';

const router = Router();

// Cache for learning content (TTL: 10 min)
const contentCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function getCacheKey(query, userId) {
  const normalizedQuery = query.toLowerCase().trim().slice(0, 100);
  return `${userId || 'anon'}-${normalizedQuery}`;
}

function buildFallbackLearningContent(query, profile = {}, error = null) {
  const level = profile.comprehension_level || profile.knowledge_level || 'intermediate';
  const topic = query.trim();

  return {
    topic,
    title: `Understanding ${topic}`,
    summary: `Here is a simplified overview of ${topic}. A richer structured version could not be generated, so this fallback keeps the lesson available.`,
    key_ideas: [
      {
        id: 'idea_1',
        title: 'Core concept',
        explanation: `${topic} can be understood by breaking it into smaller ideas and studying how they connect.`,
        difficulty: 'foundational',
        analogy: `Think of ${topic} like building blocks - each piece connects to form a larger picture.`,
        emoji: '🧩'
      },
      {
        id: 'idea_2',
        title: 'How to study it',
        explanation: `Start with the basics, review one example, then practice recalling the main points in your own words.`,
        difficulty: 'medium',
        analogy: `It's like learning a new language - start simple and build up gradually.`,
        emoji: '📚'
      },
      {
        id: 'idea_3',
        title: 'Practical applications',
        explanation: `Understanding ${topic} enables you to apply this knowledge in real-world scenarios.`,
        difficulty: 'high',
        analogy: `Like a chef who knows recipes can improvise new dishes, mastering ${topic} lets you solve new problems.`,
        emoji: '🚀'
      }
    ],
    examples: [
      {
        id: 'ex_1',
        title: 'Starter example',
        description: `A beginner asks for a simple explanation of ${topic}.`,
        real_world_context: `The best first step is to explain the key terms, then connect them to a familiar real-world example.`,
        icon: '💡',
        involves_ai: false
      },
      {
        id: 'ex_2',
        title: 'Practical application',
        description: `How ${topic} is used in professional settings.`,
        real_world_context: `Professionals apply ${topic} daily to solve problems and make decisions.`,
        icon: '🔧',
        involves_ai: false
      },
      {
        id: 'ex_3',
        title: 'Learning scenario',
        description: `A student studying ${topic} for an exam.`,
        real_world_context: `Breaking down ${topic} into smaller parts makes it easier to understand and remember.`,
        icon: '📖',
        involves_ai: false
      },
      {
        id: 'ex_4',
        title: 'AI-enhanced learning',
        description: `Using AI tools to better understand ${topic}.`,
        real_world_context: `AI can help explain complex aspects of ${topic} and provide personalized examples.`,
        icon: '🤖',
        involves_ai: true
      }
    ],
    quiz: [
      {
        question: `What is the best approach to learning ${topic}?`,
        options: [
          'Break it into smaller parts and practice regularly',
          'Memorize everything at once',
          'Skip the basics and jump to advanced topics',
          'Only read about it without practicing'
        ],
        correct: 'A',
        explanation: 'Breaking complex topics into smaller parts and practicing regularly is the most effective learning strategy.'
      },
      {
        question: `Why are examples important when learning ${topic}?`,
        options: [
          'They make the material longer',
          'They connect abstract concepts to real-world applications',
          'They are not important',
          'They replace the need to understand theory'
        ],
        correct: 'B',
        explanation: 'Examples help connect abstract concepts to real-world applications, making them easier to understand and remember.'
      }
    ],
    flashcards: [
      // Beginner cards (6)
      { front: `What is ${topic}?`, back: `${topic} is a concept that involves understanding key principles and their applications.`, difficulty: 'beginner' },
      { front: `Why is ${topic} important?`, back: `It forms the foundation for more advanced concepts and has practical applications.`, difficulty: 'beginner' },
      { front: `What are the basic components of ${topic}?`, back: `The basic components include fundamental elements that work together to form the concept.`, difficulty: 'beginner' },
      { front: `Who uses ${topic}?`, back: `Professionals, students, and enthusiasts who work in related fields.`, difficulty: 'beginner' },
      { front: `Where is ${topic} commonly applied?`, back: `In education, industry, and everyday problem-solving scenarios.`, difficulty: 'beginner' },
      { front: `When should you learn ${topic}?`, back: `When you want to build a foundation for understanding related topics.`, difficulty: 'beginner' },
      // Intermediate cards (8)
      { front: `How do you apply ${topic} in practice?`, back: `By understanding the core principles and practicing with real-world examples.`, difficulty: 'intermediate' },
      { front: `What is the best way to learn ${topic}?`, back: `Break it into smaller parts, study examples, and practice regularly.`, difficulty: 'intermediate' },
      { front: `How do you know you understand ${topic}?`, back: `When you can explain it in your own words and apply it to new situations.`, difficulty: 'intermediate' },
      { front: `What are common misconceptions about ${topic}?`, back: `Many people oversimplify it or confuse it with related concepts.`, difficulty: 'intermediate' },
      { front: `How does ${topic} relate to other concepts?`, back: `It connects to broader topics and builds upon foundational knowledge.`, difficulty: 'intermediate' },
      { front: `What skills are needed to master ${topic}?`, back: `Critical thinking, practice, and the ability to connect theory to application.`, difficulty: 'intermediate' },
      { front: `What are the key principles of ${topic}?`, back: `Core principles include understanding fundamentals, practicing regularly, and applying knowledge.`, difficulty: 'intermediate' },
      { front: `How has ${topic} evolved over time?`, back: `It has developed through research, practical application, and technological advances.`, difficulty: 'intermediate' },
      // Advanced cards (6)
      { front: `What are the limitations of ${topic}?`, back: `Like any concept, it has boundaries and edge cases where it may not apply directly.`, difficulty: 'advanced' },
      { front: `How do you troubleshoot problems with ${topic}?`, back: `By analyzing root causes, testing hypotheses, and applying systematic debugging.`, difficulty: 'advanced' },
      { front: `What advanced techniques exist for ${topic}?`, back: `Advanced techniques include optimization, edge case handling, and integration with other systems.`, difficulty: 'advanced' },
      { front: `How do you evaluate mastery of ${topic}?`, back: `Through practical application, teaching others, and solving novel problems.`, difficulty: 'advanced' },
      { front: `What are future trends in ${topic}?`, back: `Emerging trends include AI integration, automation, and cross-disciplinary applications.`, difficulty: 'advanced' },
      { front: `How do you contribute to the field of ${topic}?`, back: `Through research, sharing knowledge, building tools, and mentoring others.`, difficulty: 'advanced' }
    ],
    mind_map: {
      root: topic,
      branches: [
        { label: 'Fundamentals', children: ['Core Concepts', 'Basic Principles'] },
        { label: 'Applications', children: ['Real-world Uses', 'Practical Examples'] },
        { label: 'Advanced Topics', children: ['Deep Dive', 'Extensions'] }
      ]
    },
    image_search_keywords: [
      `${topic} concept diagram`,
      `${topic} illustration`,
      `${topic} education`
    ],
    generatedAt: new Date().toISOString(),
    profile: {
      level,
      style: profile.learning_style || 'visual',
      pace: profile.pace_preference || 'normal',
    },
    degraded: true,
    warning: error ? `Fallback content used: ${error}` : 'Fallback content used.',
  };
}

/**
 * Build type-specific fallback content for lazy loading
 */
function buildFallbackForContentType(query, contentType, profile = {}) {
  const topic = query.trim();

  switch (contentType) {
    case 'learn':
      return {
        topic,
        title: `Understanding ${topic}`,
        summary: `A simplified overview of ${topic}.`,
        key_ideas: [
          {
            id: 'idea_1',
            title: 'Core Concept',
            subtitle: 'Foundation of the topic',
            difficulty: 'foundational',
            blocks: [
              { type: 'concept', title: 'Overview', content: `${topic} involves understanding key principles.` }
            ]
          }
        ],
        degraded: true
      };

    case 'examples':
      return {
        examples: [
          {
            id: 'ex_1',
            title: `Basic ${topic} Example`,
            description: `A starter example for ${topic}.`,
            scenario: `Learn the basics of ${topic} with this simple example.`,
            code: `// ${topic} example\nconsole.log("Hello, ${topic}!");`,
            language: 'javascript',
            explanation: 'A simple starting point.',
            involves_ai: false
          }
        ],
        degraded: true
      };

    case 'quiz':
      return {
        quiz: [
          {
            type: 'mcq',
            question: `What is the best approach to learning ${topic}?`,
            options: ['Practice regularly', 'Skip the basics', 'Memorize without understanding', 'Avoid examples'],
            correct: 'A',
            explanation: 'Regular practice is key to mastering any topic.'
          }
        ],
        degraded: true
      };

    case 'flashcards-mindmap':
      return {
        flashcards: [
          { front: `What is ${topic}?`, back: `${topic} is a concept worth understanding.`, difficulty: 'beginner' },
          { front: `Why learn ${topic}?`, back: `It provides foundational knowledge for related topics.`, difficulty: 'beginner' }
        ],
        mind_map: {
          root: topic,
          branches: [
            { label: 'Basics', children: ['Definition', 'Core Concepts'] },
            { label: 'Applications', children: ['Use Cases', 'Examples'] }
          ]
        },
        degraded: true
      };

    default:
      return { degraded: true, error: `Unknown content type: ${contentType}` };
  }
}

/**
 * POST /api/learning-content
 * Generate comprehensive learning content for a topic
 * Supports lazy loading via contentType parameter:
 * - 'learn': key_ideas + summary
 * - 'examples': examples only
 * - 'flashcards-mindmap': flashcards + mind_map
 * - 'quiz': quiz questions only
 * - undefined: all content (legacy behavior)
 */
router.post('/learning-content', async (req, res) => {
  const { query, userId, forceRefresh = false, contentType, preferences, documentId, conversationId, messageId, webSearch = false } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  const typeLabel = contentType ? ` (${contentType})` : ' (all)';
  const docLabel = documentId ? ` [doc:${documentId.slice(0, 8)}]` : '';
  const webLabel = webSearch ? ' [web]' : '';
  console.log(`[LearningContent] Generating${typeLabel}${docLabel}${webLabel} for: "${query.slice(0, 50)}..."`);
  if (preferences) {
    console.log(`[LearningContent] Preferences:`, preferences);
  }

  try {
    // Initialize bandit if not ready
    if (!bandit.isReady()) {
      await bandit.initialize();
    }

    // Build cache key that includes contentType, preferences, and documentId for proper caching
    const baseCacheKey = getCacheKey(query, userId);
    const prefKey = preferences ? `${preferences.mode || 'balanced'}-${preferences.style || 'visual'}` : 'default';
    const docKey = documentId ? `:doc-${documentId}` : '';
    const cacheKey = contentType
      ? `${baseCacheKey}:${contentType}:${prefKey}${docKey}`
      : `${baseCacheKey}:${prefKey}${docKey}`;

    if (!forceRefresh) {
      const cached = contentCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[LearningContent] Returning cached content${typeLabel}`);
        return res.json({ success: true, content: cached.content, cached: true, banditDecision: cached.banditDecision });
      }
    }

    // Get user profile and metrics for bandit context
    let profile = {};
    let metrics = {};
    let cognitiveState = 'flow';
    if (userId) {
      try {
        profile = await analyzeUserProfile(userId) || {};
        metrics = await getUserMetrics(userId) || {};
        const cogState = await getCognitiveState(userId, query);
        cognitiveState = cogState?.cognitiveState || 'flow';
      } catch (e) {
        console.warn('[LearningContent] Could not fetch profile/metrics:', e.message);
      }
    }

    // STEP 1: Create bandit decision FIRST (before any content generation)
    const banditDecision = await getBanditDecision({
      userId,
      topic: query,
      profile,
      adaptiveContext: { cognitive_state: cognitiveState },
      metrics: {
        engagementLevel: metrics?.engagementLevel || 'medium',
        topicStatus: metrics?.topicStatus || 'neutral',
        performanceTrend: metrics?.performanceTrend || 'stable',
      },
    });

    console.log(`[LearningContent] Bandit decision: ${banditDecision.selectedAction} (source: ${banditDecision.decisionSource})`);

    // Merge preferences into profile for agent access
    const mergedProfile = {
      ...profile,
      mode: preferences?.mode || profile.mode || 'balanced',
      style: preferences?.style || profile.style || 'visual',
    };

    // RAG: Retrieve context from document if documentId is provided
    let contextChunks = null;
    let documentContext = null;
    if (documentId) {
      try {
        // Verify document exists and is ready
        let document = await getDocument(documentId);
        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }
        if (document.user_id !== userId) {
          return res.status(403).json({ error: 'Access denied to document' });
        }
        if (document.status === 'ready' && (document.chunk_count || 0) === 0 && document.storage_path) {
          console.warn(`[LearningContent] RAG: Repairing unindexed ready document ${documentId}`);
          await processPdfFromStorage(documentId, document.storage_path);
          document = await getDocument(documentId);
        }
        if (document.status !== 'ready' || (document.chunk_count || 0) === 0) {
          return res.status(400).json({
            error: 'Document not ready',
            status: document.status,
            message: document.status === 'processing'
              ? 'Document is still being processed. Please wait.'
              : 'Document has not been indexed successfully yet.',
          });
        }

        // Retrieve relevant chunks
        const chunks = await retrieveChunks(documentId, query, 5);
        if (chunks && chunks.length > 0) {
          contextChunks = chunks;
          documentContext = formatChunksAsContext(chunks);
          console.log(`[LearningContent] RAG: Retrieved ${chunks.length} chunks from document`);
          console.log(`[LearningContent] RAG: Chunk previews:`, chunks.map((c, i) => `[${i+1}] ${c.text.slice(0, 100)}...`));
        } else {
          console.warn(`[LearningContent] RAG: NO CHUNKS FOUND for query "${query.slice(0, 50)}..."`);
          console.warn(`[LearningContent] RAG: Model will be told document has no relevant info`);
        }
      } catch (e) {
        console.error('[LearningContent] RAG retrieval failed:', e.message);
        // Continue without context - but mark documentId so agents know a doc was selected
      }
    }

    // WEB SEARCH: Perform web search if enabled and no document context
    let webSearchContext = null;
    let webSearchResults = null;
    if (webSearch && !documentId) {
      try {
        console.log(`[LearningContent] Performing web search for: "${query.slice(0, 50)}..."`);
        const searchResult = await searchForLearning(query);

        if (searchResult.success && searchResult.results.length > 0) {
          webSearchContext = searchResult.formattedContext;
          webSearchResults = {
            answer: searchResult.answer,
            sources: searchResult.results.map(r => ({
              title: r.title,
              url: r.url,
              publishedDate: r.publishedDate,
            })),
          };
          console.log(`[LearningContent] Web search: Found ${searchResult.results.length} sources`);
        } else {
          console.warn(`[LearningContent] Web search: No results found`);
        }
      } catch (webErr) {
        console.error('[LearningContent] Web search failed:', webErr.message);
        // Continue without web context
      }
    }

    // STEP 2: Generate learning content with bandit action
    // IMPORTANT: Pass banditAction so content matches the selected approach
    // For 'learn' content type, use the adaptive orchestrator
    console.log(`[LearningContent] Starting generation with action: ${banditDecision.selectedAction}...`);
    const startTime = Date.now();

    // Get action-specific instructions for content generation
    const actionInstructions = getActionInstructions(banditDecision.selectedAction);

    // Determine which agent to use based on content type
    // For 'learn' or unspecified contentType, use the orchestrator for adaptive responses
    // For other types (examples, quiz, flashcards), use the standard agent
    const useOrchestrator = !contentType || contentType === 'learn';

    const agentToUse = useOrchestrator ? learningOrchestrator : learningContentAgent;
    console.log(`[LearningContent] Using ${useOrchestrator ? 'learningOrchestrator' : 'learningContentAgent'}`);

    const result = await agentToUse.run({
      query,
      profile: mergedProfile,
      contentType,
      documentId,       // Pass ID so agents know a document was selected
      documentContext,  // RAG context (formatted text)
      contextChunks,    // Raw chunks for reference
      webSearchContext, // Web search context (if enabled)
      webSearchEnabled: webSearch,  // Flag indicating web search was requested
      banditAction: banditDecision.selectedAction,  // NEW: Pass bandit action
      actionInstructions,                            // NEW: Instructions for action
      decisionId: banditDecision.id,                 // NEW: For reward tracking
    });

    const elapsed = Date.now() - startTime;
    console.log(`[LearningContent] Generation complete in ${elapsed}ms:`, {
      success: result.success,
      hasResult: !!result.result,
      contentType,
      error: result.error || null
    });

    // Run simulation detection using new dynamic simulation engine
    // Only run for 'learn' content type or when no contentType specified (full content)
    let simulationDetection = null;
    if (!contentType || contentType === 'learn') {
      try {
        // Quick pre-filter to avoid unnecessary LLM calls
        if (mightBeSimulationRelated(query)) {
          const classification = await classifySimulationIntent(query);
          simulationDetection = {
            supported: classification.simulatable,
            type: classification.type,
            algorithm: classification.algorithm,
            generatorKey: classification.generatorKey || classification.algorithm,
            confidence: classification.confidence,
            suggestedInputs: classification.inputs,
            inputSchema: classification.inputSchema,
            reason: classification.reason
          };
          console.log(`[LearningContent] Simulation detection:`, {
            query: query.slice(0, 30),
            supported: simulationDetection?.supported,
            type: simulationDetection?.type,
            algorithm: simulationDetection?.algorithm,
            confidence: simulationDetection?.confidence,
            cached: classification.cached
          });
        } else {
          simulationDetection = { supported: false, reason: 'Query not simulation related' };
        }
      } catch (detectErr) {
        console.warn('[LearningContent] Simulation detection failed:', detectErr.message);
        // Non-blocking - continue without detection
      }
    }

    if (!result.success || !result.result) {
      // For specific content types, return type-specific fallback
      if (contentType) {
        const fallback = buildFallbackForContentType(query, contentType, profile);
        return res.json({
          success: true,
          content: fallback,
          degraded: true,
          banditDecision: { id: banditDecision.id, action: banditDecision.selectedAction },
        });
      }

      const fallbackContent = buildFallbackLearningContent(query, profile, result.error);
      contentCache.set(cacheKey, {
        content: fallbackContent,
        timestamp: Date.now(),
        banditDecision: { id: banditDecision.id, action: banditDecision.selectedAction },
      });

      return res.json({
        success: true,
        content: fallbackContent,
        degraded: true,
        banditDecision: { id: banditDecision.id, action: banditDecision.selectedAction },
      });
    }

    // STEP 3: Enforce action on generated content
    const enforcement = enforceLearningContentAction(
      banditDecision.id,
      banditDecision.selectedAction,
      contentType || 'learn',
      result.result
    );

    if (!enforcement.enforced) {
      console.warn(`[LearningContent] Enforcement failed:`, enforcement.violations);
    }

    // Cache the result with bandit decision
    contentCache.set(cacheKey, {
      content: result.result,
      timestamp: Date.now(),
      banditDecision: { id: banditDecision.id, action: banditDecision.selectedAction },
    });

    // Cleanup old cache entries
    if (contentCache.size > 100) {
      const oldestKey = contentCache.keys().next().value;
      contentCache.delete(oldestKey);
    }

    // Save learning resources to database for persistence (if conversationId provided)
    if (conversationId) {
      try {
        // Determine which resource type(s) to save based on contentType
        const resourcesToSave = [];

        if (!contentType || contentType === 'learn') {
          // Save learn content
          resourcesToSave.push({
            type: RESOURCE_TYPES.LEARN,
            content: {
              topic: result.result.topic,
              title: result.result.title,
              summary: result.result.summary,
              key_ideas: result.result.key_ideas,
              difficulty_level: result.result.difficulty_level,
              estimated_time: result.result.estimated_time,
              prerequisites: result.result.prerequisites,
              skill_areas: result.result.skill_areas,
              next_topics: result.result.next_topics,
              image_search_keywords: result.result.image_search_keywords,
            },
          });
        }

        if (!contentType && result.result.examples?.length > 0) {
          resourcesToSave.push({
            type: RESOURCE_TYPES.EXAMPLES,
            content: { examples: result.result.examples },
          });
        }

        if (contentType === 'examples' && result.result.examples?.length > 0) {
          resourcesToSave.push({
            type: RESOURCE_TYPES.EXAMPLES,
            content: { examples: result.result.examples },
          });
        }

        if (!contentType && result.result.quiz?.length > 0) {
          resourcesToSave.push({
            type: RESOURCE_TYPES.QUIZ,
            content: { quiz: result.result.quiz },
          });
        }

        if (contentType === 'quiz' && result.result.quiz?.length > 0) {
          resourcesToSave.push({
            type: RESOURCE_TYPES.QUIZ,
            content: { quiz: result.result.quiz },
          });
        }

        if (!contentType && result.result.flashcards?.length > 0) {
          resourcesToSave.push({
            type: RESOURCE_TYPES.FLASHCARDS,
            content: { flashcards: result.result.flashcards },
          });
        }

        if (!contentType && result.result.mind_map) {
          resourcesToSave.push({
            type: RESOURCE_TYPES.MINDMAP,
            content: { mind_map: result.result.mind_map },
          });
        }

        if (contentType === 'flashcards-mindmap') {
          if (result.result.flashcards?.length > 0) {
            resourcesToSave.push({
              type: RESOURCE_TYPES.FLASHCARDS,
              content: { flashcards: result.result.flashcards },
            });
          }
          if (result.result.mind_map) {
            resourcesToSave.push({
              type: RESOURCE_TYPES.MINDMAP,
              content: { mind_map: result.result.mind_map },
            });
          }
        }

        // Save simulation detection result if applicable
        if (simulationDetection?.supported) {
          resourcesToSave.push({
            type: RESOURCE_TYPES.SIMULATION,
            content: {
              detection: simulationDetection,
              // Simulation data will be saved when actually generated
            },
          });
        }

        // Save all resources in parallel
        await Promise.all(
          resourcesToSave.map(r =>
            saveLearningResource(conversationId, messageId, r.type, query, r.content)
          )
        );

        console.log(`[LearningContent] Saved ${resourcesToSave.length} resources for conversation ${conversationId.slice(0, 8)}`);
      } catch (saveErr) {
        console.warn('[LearningContent] Failed to save resources:', saveErr.message);
        // Non-blocking - continue with response
      }
    }

    // Extract responseMode and intent classification from result
    const responseMode = result.result?.responseMode || 'deep_learn';
    const intentClassification = result.result?._orchestration || null;

    // Remove internal orchestration metadata from the content sent to frontend
    const contentToSend = { ...result.result };
    delete contentToSend._orchestration;

    res.json({
      success: true,
      content: contentToSend,
      // NEW: Include response mode and intent classification for frontend
      responseMode,
      intentClassification,
      simulationDetection, // Include detection result for frontend tiered UI
      executionTime: result.executionTime,
      // Include bandit decision for reward tracking
      banditDecision: {
        id: banditDecision.id,
        action: banditDecision.selectedAction,
        source: banditDecision.decisionSource,
        coldStart: banditDecision.coldStart,
      },
      enforcement: {
        enforced: enforcement.enforced,
        violations: enforcement.violations || [],
      },
      // Include saved resource info
      resourcesSaved: conversationId ? true : false,
      // Include web search sources if used
      webSearchSources: webSearchResults?.sources || null,
    });

  } catch (error) {
    console.error('[LearningContent] Error:', error.message);

    // For specific content types, return type-specific fallback
    if (contentType) {
      const fallback = buildFallbackForContentType(query, contentType, {});
      return res.json({
        success: true,
        content: fallback,
        degraded: true,
      });
    }

    const fallbackContent = buildFallbackLearningContent(query, {}, error.message);
    res.json({
      success: true,
      content: fallbackContent,
      degraded: true,
    });
  }
});

/**
 * POST /api/learning-content/quiz-answer
 * Process quiz answer and return feedback
 */
router.post('/learning-content/quiz-answer', async (req, res) => {
  const { questionId, selectedAnswer, correctAnswer, userId, decisionId = null } = req.body;

  const isCorrect = selectedAnswer === correctAnswer;

  // Record reward for the bandit decision
  if (decisionId) {
    try {
      await recordReward(decisionId, {
        correctness: isCorrect ? 1.0 : 0.0,
        engagement: 0.7, // Quiz attempt shows engagement
        completion: 1.0, // Completed the quiz question
        retention: null, // Unknown at this point
      }, {
        source: 'quiz_answer',
        questionId,
        isCorrect,
      });
    } catch (err) {
      console.warn('[LearningContent] Failed to record quiz reward:', err.message);
    }
  }

  // Could update user's weak/strong topics here
  // For now, just return the result
  res.json({
    success: true,
    isCorrect,
    questionId,
    decisionId,
  });
});

/**
 * POST /api/learning-content/track-interaction
 * Track user interactions with learning content
 */
router.post('/learning-content/track-interaction', async (req, res) => {
  const { userId, interactionType, data = {}, decisionId = null } = req.body;

  // Log interaction for analytics
  console.log(`[LearningContent] Interaction: ${interactionType}`, data);

  const resolvedDecisionId = decisionId || data.decisionId;

  if (resolvedDecisionId) {
    try {
      // Record interaction as reward using the new bandit module
      await recordRewardFromInteraction(
        resolvedDecisionId,
        interactionType,
        data,
        null // topicHistory - could be fetched if needed
      );
    } catch (err) {
      console.warn('[LearningContent] Failed to record interaction reward:', err.message);
    }
  }

  // Could store in database for adaptive learning
  res.json({ success: true, decisionId: resolvedDecisionId || null });
});

/**
 * POST /api/learning-content/regenerate-block
 * Regenerate a single content block with a different explanation style
 */
router.post('/learning-content/regenerate-block', async (req, res) => {
  const { query, block, preferences } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  if (!block || !block.type) {
    return res.status(400).json({ error: 'Block with type is required' });
  }

  console.log(`[LearningContent] Regenerating block for: "${query.slice(0, 50)}..."`);

  try {
    const result = await regenerateBlockAgent.run({
      query,
      block,
      profile: preferences || {}
    });

    if (!result.success || !result.result) {
      return res.status(500).json({
        error: result.error || 'Failed to regenerate block',
        success: false
      });
    }

    res.json({
      success: true,
      block: result.result,
      executionTime: result.executionTime
    });

  } catch (error) {
    console.error('[LearningContent] Regenerate block error:', error.message);
    res.status(500).json({
      error: 'Failed to regenerate block',
      success: false
    });
  }
});

export default router;
