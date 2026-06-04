import { Router } from "express";
import {
  SHOW_WIDGET_TOOL,
  createSystemPrompt,
  mergePersonaWithOverride,
} from "../src/services/openai/prompts.js";
import { analyzeUserProfile, getUserMetrics } from "../src/agents/personalization.js";
import {
  bandit,
  getBanditDecision,
  recordRewardFromInteraction,
  enforceAction,
  getActionInstructions,
} from "../src/bandit/index.js";
import { getCognitiveState } from "../src/services/learningState.js";
import { cache } from "../src/services/cache.js";
import { logger } from "../src/services/logger.js";
import {
  getPersona,
  getDefaultSystemPersona,
  getUserDefaultPersona,
} from "../src/database/client.js";
import {
  getAzureTextClient,
  getAzureTextModel,
  normalizeAzureError,
  toOpenAIMessages,
  toOpenAITools,
} from "../src/services/openai/azure-client.js";
import {
  getDocument,
  retrieveChunks,
  formatChunksAsContext,
} from "../src/services/rag/index.js";
import { processPdfFromStorage } from "../src/services/rag/pdfProcessor.js";
import {
  LearningOrchestratorDecision,
} from "../src/services/learningOrchestratorDecision.js";
import { buildResponseBehavior, sanitizeAssistantResponse } from "../src/services/responseBehavior.js";

const router = Router();

// Cache TTL for profiles (5 min)
const PROFILE_CACHE_TTL = 300;
// Cache TTL for personas (5 min)
const PERSONA_CACHE_TTL = 300;

/**
 * Extract current topic from user query
 */
function extractCurrentTopic(query = '') {
  const lowerQuery = query.toLowerCase();
  const patterns = [
    /(?:about|learn|understand|explain|help with|studying|topic:?)\s+([a-z\s]{3,30})/i,
    /(?:what is|how does|why does|how do|can you explain)\s+([a-z\s]{3,30})/i,
    /\b(math|mathematics|algebra|calculus|geometry|physics|chemistry|biology|history|programming|javascript|python|react|css|html|database|sql|machine learning|ai|data science)\b/i,
  ];
  for (const pattern of patterns) {
    const match = lowerQuery.match(pattern);
    if (match && match[1]) {
      return match[1].trim().toLowerCase();
    }
  }
  return null;
}

/**
 * Get cached user profile using Redis
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User profile
 */
async function getCachedProfile(userId) {
  if (!userId) return null;

  const cacheKey = `profile:${userId}`;

  try {
    const { value, fromCache } = await cache.getOrSet(
      cacheKey,
      () => analyzeUserProfile(userId),
      PROFILE_CACHE_TTL
    );

    if (fromCache) {
      logger.debug({ userId, source: 'cache' }, 'Profile from cache');
    }

    return value;
  } catch (err) {
    logger.error({ error: err, userId }, 'Failed to get cached profile');
    return analyzeUserProfile(userId);
  }
}

/**
 * Get cognitive state for bandit context
 */
async function getCognitiveStateForBandit(userId, topic) {
  try {
    const result = await getCognitiveState(userId, topic);
    return result?.cognitiveState || 'flow';
  } catch (err) {
    return 'flow';
  }
}

/**
 * Get cached persona with graceful fallback
 * CRITICAL: Persona MUST be fetched on EVERY request. Models don't remember.
 * @param {string|null} personaId - Specific persona ID to fetch
 * @param {string|null} userId - User ID for fallback to user's default
 * @returns {Promise<Object|null>} Persona object or null
 */
async function getCachedPersona(personaId, userId) {
  try {
    // If specific personaId provided, fetch it
    if (personaId) {
      const cacheKey = `persona:${personaId}`;
      const { value, fromCache } = await cache.getOrSet(
        cacheKey,
        () => getPersona(personaId),
        PERSONA_CACHE_TTL
      );

      if (value) {
        if (fromCache) {
          logger.debug({ personaId, source: 'cache' }, 'Persona from cache');
        }
        return value;
      }
      // Persona not found, fall through to defaults
      logger.warn({ personaId }, 'Persona not found, using fallback');
    }

    // Try user's default persona
    if (userId) {
      try {
        const userDefault = await getUserDefaultPersona(userId);
        if (userDefault) {
          return userDefault;
        }
      } catch (err) {
        logger.debug({ error: err }, 'No user default persona');
      }
    }

    // Fall back to system default (Friendly Tutor)
    const systemDefault = await getDefaultSystemPersona();
    return systemDefault;
  } catch (err) {
    logger.error({ error: err, personaId, userId }, 'Failed to get persona');
    return null;
  }
}

const client = getAzureTextClient();
const model = getAzureTextModel();
const VISUAL_SPEC_VERSION = '1.0';
const VISUAL_SPEC_TYPES = new Set(['timeline', 'chart', 'network', 'flow', 'matrix', 'sequence', 'comparison', 'graph']);
const VISUAL_SPEC_CONTROLS = new Set(['play', 'pause', 'restart', 'step', 'speed', 'fullscreen']);
const EXECUTABLE_OUTPUT_PATTERN = /<\s*\/?\s*(html|head|body|style|script|svg|canvas|iframe|object|embed|link|meta|div|span|button)\b|```|(?:document|window|globalThis|parent|top|process|fs)\s*\.|\b(import|require|eval|Function|XMLHttpRequest|WebSocket|fetch|npm|npx|yarn|pnpm)\b|on(?:click|load|error|mouseover)\s*=|javascript:/i;

function setupSSE(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(":ok\n\n"); // Flush immediately
}

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function stripUnsafeStrings(value, fallback = '') {
  const text = String(value ?? fallback).trim();
  if (!text || EXECUTABLE_OUTPUT_PATTERN.test(text)) return fallback;
  return text.slice(0, 240);
}

function sanitizeSpecValue(value, depth = 0) {
  if (depth > 6) return null;
  if (value == null) return value;
  if (typeof value === 'string') return stripUnsafeStrings(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 150).map(item => sanitizeSpecValue(item, depth + 1)).filter(item => item !== null);
  if (typeof value === 'object') {
    const output = {};
    for (const [key, nested] of Object.entries(value).slice(0, 40)) {
      const safeKey = stripUnsafeStrings(key, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
      if (!safeKey) continue;
      output[safeKey] = sanitizeSpecValue(nested, depth + 1);
    }
    return output;
  }
  return null;
}

function fallbackVisualSpec(title = 'Visual explanation', rejectionReason = 'fallback_visual_spec', validationRuleTriggered = null) {
  return {
    version: VISUAL_SPEC_VERSION,
    title: stripUnsafeStrings(title, 'Visual explanation'),
    spec_type: 'flow',
    objects: [
      { id: 'idea', type: 'node', label: 'Key idea', x: 20, y: 45 },
      { id: 'process', type: 'node', label: 'Process', x: 50, y: 45 },
      { id: 'result', type: 'node', label: 'Result', x: 80, y: 45 },
    ],
    animations: [
      { type: 'highlight', target: 'idea', step: 0 },
      { type: 'highlight', target: 'process', step: 1 },
      { type: 'highlight', target: 'result', step: 2 },
    ],
    controls: ['play', 'pause', 'restart', 'step', 'speed'],
    explanation: 'A safe declarative visual spec was used because executable visual content is not allowed.',
    telemetry: {
      rejection_reason: rejectionReason,
      validation_rule_triggered: validationRuleTriggered,
      fallback_used: true,
    },
  };
}

function sanitizeWidgetInput(input = {}) {
  const raw = JSON.stringify(input || {});
  if (EXECUTABLE_OUTPUT_PATTERN.test(raw)) {
    logger.warn({ title: input?.title }, "Rejected executable visual tool output");
    return fallbackVisualSpec(input?.title, 'executable_output_rejected', 'executable_output_pattern');
  }

  const normalized = input?.spec && typeof input.spec === 'object'
    ? { ...input.spec, title: input.title || input.spec.title, spec_type: input.spec_type || input.spec.type || input.spec.spec_type }
    : input;

  const specType = VISUAL_SPEC_TYPES.has(normalized?.spec_type)
    ? normalized.spec_type
    : VISUAL_SPEC_TYPES.has(normalized?.type)
      ? normalized.type
      : null;

  if (!specType) {
    logger.warn({ specType: normalized?.spec_type || normalized?.type }, "Rejected unsupported visual spec type");
    return fallbackVisualSpec(normalized?.title, 'unsupported_spec', 'renderer_capability_check');
  }

  const objects = Array.isArray(normalized?.objects)
    ? sanitizeSpecValue(normalized.objects).slice(0, 150)
    : [];

  if (objects.length === 0) {
    return fallbackVisualSpec(normalized?.title, 'empty_objects_rejected', 'objects_required');
  }

  const controls = Array.isArray(normalized?.controls)
    ? normalized.controls.filter(control => VISUAL_SPEC_CONTROLS.has(control)).slice(0, 6)
    : ['play', 'pause', 'restart', 'step', 'speed'];

  return {
    version: stripUnsafeStrings(normalized.version, VISUAL_SPEC_VERSION) || VISUAL_SPEC_VERSION,
    title: stripUnsafeStrings(normalized.title, 'Visual spec'),
    spec_type: specType,
    objects,
    animations: Array.isArray(normalized?.animations) ? sanitizeSpecValue(normalized.animations).slice(0, 150) : [],
    controls,
    explanation: stripUnsafeStrings(normalized.explanation, ''),
    telemetry: {
      rejection_reason: null,
      validation_rule_triggered: null,
      fallback_used: false,
    },
  };
}

function parseToolArguments(rawArgs = '') {
  if (!rawArgs) return {};
  try {
    return JSON.parse(rawArgs);
  } catch (error) {
    logger.warn({ error: error.message, preview: rawArgs.slice(0, 200) }, "Failed to parse tool arguments");
    return {};
  }
}

async function buildDocumentGrounding({ documentId, userId, query }) {
  if (!documentId) {
    return { context: null, chunks: [], document: null };
  }

  let document = await getDocument(documentId);
  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  if (document.user_id !== userId) {
    const error = new Error('Access denied to document');
    error.statusCode = 403;
    throw error;
  }

  if (document.status === 'ready' && (document.chunk_count || 0) === 0 && document.storage_path) {
    logger.warn({ documentId }, 'Chat RAG document has no chunks, attempting repair');
    await processPdfFromStorage(documentId, document.storage_path);
    document = await getDocument(documentId);
  }

  if (document.status !== 'ready' || (document.chunk_count || 0) === 0) {
    const error = new Error(
      document.status === 'processing'
        ? 'Document is still being processed. Please wait.'
        : 'Document has not been indexed successfully yet.'
    );
    error.statusCode = 400;
    error.documentStatus = document.status;
    throw error;
  }

  const chunks = await retrieveChunks(documentId, query, 6);
  const context = formatChunksAsContext(chunks);

  return { context, chunks, document };
}

async function streamOpenAIChat({
  messages,
  system,
  tools = [],
  abortedRef,
  onText,
  onTool,
  onComplete,
}) {
  const request = {
    model,
    max_completion_tokens: 8192,
    stream: true,
    messages: toOpenAIMessages(messages, system),
  };

  if (tools.length > 0) {
    request.tools = toOpenAITools(tools);
  }

  let stream;
  try {
    stream = await client.chat.completions.create(request);
  } catch (error) {
    throw normalizeAzureError(error);
  }

  const toolCalls = new Map();
  let completionId = null;
  let finishReason = null;

  try {
    for await (const chunk of stream) {
      if (abortedRef.aborted) break;
      completionId = completionId || chunk.id;
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }

      const delta = choice.delta || {};
      if (delta.content) {
        onText?.(delta.content);
      }

      for (const toolDelta of delta.tool_calls || []) {
        const index = toolDelta.index ?? 0;
        const current = toolCalls.get(index) || {
          id: toolDelta.id || `call_${Date.now()}_${index}`,
          name: '',
          arguments: '',
        };

        if (toolDelta.id) current.id = toolDelta.id;
        if (toolDelta.function?.name) current.name += toolDelta.function.name;
        if (toolDelta.function?.arguments) current.arguments += toolDelta.function.arguments;
        toolCalls.set(index, current);
      }
    }
  } catch (error) {
    throw normalizeAzureError(error);
  }

  for (const call of toolCalls.values()) {
    if (abortedRef.aborted) break;
    onTool?.({
      id: call.id,
      name: call.name,
      input: sanitizeWidgetInput(parseToolArguments(call.arguments)),
    });
  }

  if (!abortedRef.aborted) {
    onComplete?.({ id: completionId, stop_reason: finishReason || 'stop' });
  }
}

router.post("/chat", async (req, res) => {
  const {
    messages,
    userId,
    behavior,
    conversationId = null,
    personaId = null,
    temporaryStyle = null,
    documentId = null,
    learningAction = null,
    preferences = {},
    mode = preferences?.mode || 'chat',
    conversationState = {},
  } = req.body;
  logger.info({ messageCount: messages?.length, userId: userId?.slice(0,8), personaId: personaId?.slice(0,8), documentId: documentId?.slice(0,8) }, "POST /api/chat");

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  setupSSE(res);

  let aborted = false;
  let banditDecision = null;

  try {
    // Initialize bandit if not ready
    if (!bandit.isReady()) {
      await bandit.initialize();
    }

    // Extract topic from last user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const userQuery = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : '';
    const requestedArtifact = learningAction || preferences?.requestedArtifact || null;
    let orchestrationDecision = LearningOrchestratorDecision({
      query: userQuery,
      mode,
      conversationState,
      requestedArtifact,
    });

    const guardQuery = orchestrationDecision.activeTopic || orchestrationDecision.resolvedQuery || userQuery;
    if (orchestrationDecision.simulation?.needed) {
      try {
        orchestrationDecision = await applySimulationSupportGuard(orchestrationDecision, guardQuery);
      } catch (guardError) {
        logger.warn({ error: guardError.message, query: guardQuery }, 'Simulation support guard failed');
        orchestrationDecision = {
          ...orchestrationDecision,
          simulation: {
            ...orchestrationDecision.simulation,
            needed: orchestrationDecision.simulation.explicit,
            fallback: !orchestrationDecision.simulation.explicit,
          },
        };
      }
    }

    const currentTopic = orchestrationDecision.activeTopic || extractCurrentTopic(userQuery);
    const responseBehavior = buildResponseBehavior({
      query: userQuery,
      decision: orchestrationDecision,
    });
    const documentGrounding = await buildDocumentGrounding({ documentId, userId, query: userQuery });
    const intentionalLearningAction = requestedArtifact;

    // Fetch user profile and metrics (used as CONTEXT for bandit, not for prompt shaping)
    const profile = await getCachedProfile(userId);
    const metrics = userId ? await getUserMetrics(userId) : null;
    const cognitiveState = await getCognitiveStateForBandit(userId, currentTopic);

    // CRITICAL: Fetch persona on EVERY request (models don't remember)
    const basePersona = await getCachedPersona(personaId, userId);

    // Apply temporary style override if present (merge, don't replace)
    const effectivePersona = mergePersonaWithOverride(basePersona, temporaryStyle);

    // Log persona info
    if (effectivePersona) {
      logger.debug({
        personaName: effectivePersona.name,
        personaId: effectivePersona.id,
        hasTemporaryStyle: !!temporaryStyle,
      }, 'Using persona');
    }

    // BANDIT IS AUTHORITATIVE - Get decision using new LinUCB-based system
    banditDecision = await getBanditDecision({
      userId,
      topic: currentTopic,
      profile,
      adaptiveContext: { cognitive_state: cognitiveState },
      metrics: {
        engagementLevel: metrics?.engagementLevel || 'medium',
        topicStatus: metrics?.topicStatus || 'neutral',
        performanceTrend: metrics?.performanceTrend || 'stable',
      },
      conversationId,
    });

    // Build system prompt with PERSONA (fetched every request)
    const actionInstructions = getActionInstructions(banditDecision.selectedAction);

    // Build personalized system prompt with persona
    // Use createSystemPrompt which handles persona injection at the start
    const basePrompt = createSystemPrompt(profile, {}, effectivePersona);

    // Normal chat must stay conversational. Structured learning behavior is only
    // enabled when the user explicitly chooses a plus-menu learning action.
    const ragInstructions = documentGrounding.context
      ? `\n\n## Uploaded Document Context (RAG)\nThe learner selected the document "${documentGrounding.document.original_name}". Answer using the excerpts below as the primary source. If the excerpts do not contain enough information, say what is missing instead of inventing details.\n\n${documentGrounding.context}`
      : documentId
        ? '\n\n## Uploaded Document Context (RAG)\nA document was selected, but no relevant excerpts were retrieved. Tell the learner that the document did not contain enough matching information for this question.'
        : '';

    const responseModeInstructions = intentionalLearningAction
      ? `\n\n## Response Format Requirement\n${actionInstructions}`
      : `\n\n## Response Mode\nRespond as VisuaLearn, an adaptive learning tutor, not a generic chatbot. Keep simple definitions short. For process or algorithm concepts, use a vivid hook, short concept explanation, small step-by-step story, real example, and one key takeaway. Do not create long walls of text.\n\nForbidden chatbot phrases: do not use "Oh yeah", "No worries", "Of course", "I can help you with", "If you want", "Glad to help", "Happy to help", or "Let me know". Avoid conversational filler and start directly with the answer or concept title.\n\nForbidden endings: never end with "If you want...", "Would you like...", "I can also explain...", "Want me to...", or any follow-up question. Suggested next actions are rendered by the app as buttons, not by you.\n\nDo not create learning tabs, quizzes, flashcards, mind maps, raw HTML, CSS, JavaScript, canvas, iframe, executable code, JSON, or SimulationSpec objects. If a simulation is needed, explain the concept in text only; the renderer will handle the visual separately through internal simulationData. 3D scene generation is handled only by the separate /api/visual3d backend endpoints until UI integration is added.\n\nCurrent topic: ${currentTopic || 'none'}.\nResponse kind: ${responseBehavior.responseKind}.`;

    const systemPrompt = `${basePrompt}${ragInstructions}${responseModeInstructions}`;

    // Send persona info to client if temporary style was applied
    if (temporaryStyle) {
      sendSSE(res, {
        type: "temporary_style_active",
        style: temporaryStyle,
        persona: effectivePersona ? {
          id: effectivePersona.id,
          name: effectivePersona.name,
          tone: effectivePersona.tone,
          verbosity: effectivePersona.verbosity,
        } : null,
      });
    }

    sendSSE(res, {
      type: 'orchestration_decision',
      decision: orchestrationDecision,
      activeTopic: orchestrationDecision.activeTopic,
      conversationState: orchestrationDecision.conversationState,
      suggestedActions: responseBehavior.suggestedActions,
      adaptiveExplanation: responseBehavior.adaptiveExplanation,
      responseKind: responseBehavior.responseKind,
    });

    logger.info({
      selectedAction: banditDecision.selectedAction,
      learningAction: intentionalLearningAction,
      topic: currentTopic,
      orchestration: {
        mode: orchestrationDecision.mode,
        simulation: orchestrationDecision.simulation,
        scene3D: orchestrationDecision.scene3D,
        artifacts: orchestrationDecision.artifacts,
      },
      source: banditDecision.decisionSource,
    }, "Bandit decision");

    // Normal conversation mode is text-only. Sandbox simulations are rendered by
    // /api/simulation/debug, not by the old show_widget tool.
    const tools = !intentionalLearningAction || intentionalLearningAction === 'simulation' || intentionalLearningAction === 'video'
      ? []
      : [SHOW_WIDGET_TOOL];

    const heartbeat = setInterval(() => {
      if (!aborted) {
        try { res.write(":heartbeat\n\n"); } catch(e) {}
      }
    }, 15000);

    // Collect response text and tool calls for enforcement
    let responseText = "";
    let streamedText = "";
    const toolCalls = [];

    const abortedRef = {
      get aborted() {
        return aborted;
      },
    };

    res.on("close", () => {
      if (!aborted) {
        logger.debug("Response closed, aborting stream");
        aborted = true;
        clearInterval(heartbeat);
      }
    });

    await streamOpenAIChat({
      messages,
      system: systemPrompt,
      tools,
      abortedRef,
      onText: (text) => {
        responseText += text;
        const sanitizedText = sanitizeAssistantResponse(responseText);
        const nextDelta = sanitizedText.slice(streamedText.length);
        streamedText = sanitizedText;
        if (nextDelta) {
          sendSSE(res, { type: "text_delta", text: nextDelta });
        }
      },
      onTool: (toolCall) => {
        toolCalls.push({ name: toolCall.name, id: toolCall.id, input: toolCall.input });
        sendSSE(res, {
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.input,
        });
      },
      onComplete: (message) => {
        sendSSE(res, {
          type: "message_complete",
          stop_reason: message.stop_reason,
          id: message.id,
        });

        if (intentionalLearningAction) {
          // ENFORCEMENT: Validate response matches selected action only in Learn Mode.
          const enforcement = enforceAction(
            banditDecision.id,
            banditDecision.selectedAction,
            responseText,
            toolCalls
          );

          sendSSE(res, {
            type: "enforcement_result",
            decisionId: banditDecision.id,
            originalAction: banditDecision.selectedAction,
            enforced: enforcement.enforced,
            violations: enforcement.violations || [],
            fallback: enforcement.fallback || null,
          });

          if (!enforcement.enforced) {
            logger.warn({ violations: enforcement.violations }, "Enforcement failed");
          }
        }

        sendSSE(res, { type: "done" });
        clearInterval(heartbeat);
        res.end();
        aborted = true;
      },
    });

  } catch (error) {
    logger.error({ error }, "Chat error");
    if (!aborted) {
      sendSSE(res, { type: "error", error: error.message || "Failed to connect to AI" });
      res.end();
    }
  }
});

router.post("/tool-result", async (req, res) => {
  const {
    messages,
    userId,
    bandit: banditData = null,
    personaId = null,
    temporaryStyle = null,
  } = req.body;
  logger.info({ messageCount: messages?.length, userId: userId?.slice(0,8), personaId: personaId?.slice(0,8) }, "POST /api/tool-result");

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  setupSSE(res);

  let aborted = false;

  try {
    // Record bandit interaction if provided (reward signal)
    if (banditData?.decisionId && banditData?.interactionData) {
      try {
        await recordRewardFromInteraction(
          banditData.decisionId,
          banditData.interactionType || 'tool_result',
          banditData.interactionData,
          null // topicHistory
        );
      } catch (err) {
        logger.warn({ error: err }, "Failed to record bandit interaction");
      }
    }

    // CRITICAL: Fetch persona on EVERY request (models don't remember)
    const basePersona = await getCachedPersona(personaId, userId);
    const effectivePersona = mergePersonaWithOverride(basePersona, temporaryStyle);

    // Fetch profile for context
    const profile = await getCachedProfile(userId);

    // Build system prompt with persona
    let systemPrompt = createSystemPrompt(profile, {}, effectivePersona);
    if (banditData?.selectedAction) {
      const actionInstructions = getActionInstructions(banditData.selectedAction);
      systemPrompt += `\n\n## Response Format Requirement (CRITICAL)\n${actionInstructions}`;
    }

    const heartbeat = setInterval(() => {
      if (!aborted) {
        try { res.write(":heartbeat\n\n"); } catch(e) {}
      }
    }, 15000);

    const abortedRef = {
      get aborted() {
        return aborted;
      },
    };
    let responseText = "";
    let streamedText = "";

    res.on("close", () => {
      if (!aborted) {
        logger.debug("Response closed (tool-result), aborting stream");
        aborted = true;
        clearInterval(heartbeat);
      }
    });

    const followupTools = banditData?.selectedAction === 'simulation' ? [] : [SHOW_WIDGET_TOOL];

    await streamOpenAIChat({
      messages,
      system: systemPrompt,
      tools: followupTools,
      abortedRef,
      onText: (text) => {
        responseText += text;
        const sanitizedText = sanitizeAssistantResponse(responseText);
        const nextDelta = sanitizedText.slice(streamedText.length);
        streamedText = sanitizedText;
        if (nextDelta) {
          sendSSE(res, { type: "text_delta", text: nextDelta });
        }
      },
      onTool: (toolCall) => {
        sendSSE(res, {
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.input,
        });
      },
      onComplete: (message) => {
        sendSSE(res, {
          type: "message_complete",
          stop_reason: message.stop_reason,
          id: message.id,
        });

        sendSSE(res, { type: "done" });
        clearInterval(heartbeat);
        res.end();
        aborted = true;
      },
    });

  } catch (error) {
    logger.error({ error }, "Tool-result error");
    if (!aborted) {
      sendSSE(res, { type: "error", error: error.message || "Failed to continue" });
      res.end();
    }
  }
});

export default router;
