import { Router } from "express";
import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import { SHOW_WIDGET_TOOL, SYSTEM_PROMPT } from "../../services/anthropic/prompts.js";
import { analyzeUserProfile, getPersonalizationStrategy, getUserMetrics, explainAdaptiveDecision, getTopicHistory, adaptivePolicy } from "../../agents/personalization.js";
import {
  createBanditDecision,
  getBanditActionPrompt,
  getBanditDecisionEnvelope,
  getBanditMode,
  recordBanditInteraction,
} from "../../agents/personalization-bandit.js";
import { AdaptiveLearningEngine } from "../../agents/adaptive-learning-engine.js";
import { FactCheckerAgent } from "../../agents/fact-checker.js";

// Initialize engines
const adaptiveEngine = new AdaptiveLearningEngine();
const factChecker = new FactCheckerAgent();

const router = Router();

/**
 * Extract current topic from user query
 * @param {string} query - User's message
 * @returns {string|null} Detected topic
 */
function extractCurrentTopic(query = '') {
  const lowerQuery = query.toLowerCase();

  // Topic extraction patterns
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
 * Check if topic matches any in a list (fuzzy match)
 * @param {string} topic - Current topic
 * @param {string[]} topicList - List of topics to check
 * @returns {boolean}
 */
function topicMatches(topic, topicList = []) {
  if (!topic || !topicList.length) return false;
  return topicList.some(t =>
    topic.includes(t) || t.includes(topic)
  );
}

/**
 * Build personalized system prompt based on user strategy and topic strengths
 * @param {Object} strategy - from getPersonalizationStrategy()
 * @param {Object} profile - user profile with weak/strong topics
 * @param {string} currentTopic - detected topic from query
 * @returns {string} - personalized system prompt
 */
function buildPersonalizedPrompt(strategy, profile = {}, currentTopic = null) {
  const lengthInstructions = {
    short: "Keep responses concise and to the point. Use bullet points. Avoid lengthy explanations.",
    medium: "Provide balanced responses with enough detail to be helpful.",
    long: "Provide comprehensive, detailed explanations with examples and context.",
  };

  const styleInstructions = {
    simple: "Use simple language, avoid jargon, explain concepts as if to a beginner.",
    detailed: "Provide clear explanations with moderate technical detail.",
    technical: "Use precise technical terminology, assume familiarity with advanced concepts.",
  };

  const visualInstructions = strategy.force_visual
    ? "IMPORTANT: Strongly prefer using the show_widget tool to create interactive visualizations, diagrams, or charts for concepts. Visual learning is prioritized for this user."
    : "";

  const interactionInstructions = strategy.interaction_mode === "interactive"
    ? "When possible, create interactive elements that allow the user to explore and experiment with concepts hands-on."
    : "";

  const examplesInstructions = strategy.add_examples
    ? "IMPORTANT: Include real-world examples and analogies to aid understanding."
    : "";

  // Build topic-specific instructions
  let topicInstructions = "";
  const weakTopics = profile?.weak_topics || [];
  const strongTopics = profile?.strong_topics || [];

  if (currentTopic) {
    const isWeakTopic = topicMatches(currentTopic, weakTopics);
    const isStrongTopic = topicMatches(currentTopic, strongTopics);

    if (isWeakTopic && !isStrongTopic) {
      topicInstructions = `
TOPIC ALERT - WEAK AREA DETECTED ("${currentTopic}"):
- This user has struggled with this topic before
- Provide EXTRA explanation and context
- Add multiple examples to reinforce understanding
- Slow down the pace, break concepts into smaller steps
- Check for understanding before moving to advanced concepts`;
    } else if (isStrongTopic && !isWeakTopic) {
      topicInstructions = `
TOPIC ALERT - STRONG AREA DETECTED ("${currentTopic}"):
- This user has shown mastery in this topic
- Skip basic explanations they already know
- Focus on advanced insights, edge cases, and deeper understanding
- Move at a faster pace`;
    }
  }

  // Include topic awareness even without current topic detection
  let topicContext = "";
  if (weakTopics.length > 0 || strongTopics.length > 0) {
    topicContext = `
USER TOPIC HISTORY:
- Weak Topics (needs more help): ${weakTopics.join(", ") || "none identified"}
- Strong Topics (can go faster): ${strongTopics.join(", ") || "none identified"}`;
  }

  return `${SYSTEM_PROMPT}

---
PERSONALIZATION INSTRUCTIONS (adapt your responses accordingly):
- Explanation Style: ${strategy.explanation_style} — ${styleInstructions[strategy.explanation_style]}
- Response Length: ${strategy.response_length} — ${lengthInstructions[strategy.response_length]}
- Use Visuals: ${strategy.force_visual ? "YES - prioritize visual explanations" : "when helpful"}
- Interaction Mode: ${strategy.interaction_mode}
${visualInstructions}
${interactionInstructions}
${examplesInstructions}
${topicContext}
${topicInstructions}
---`;
}

/**
 * Build adaptive learning context for the system prompt
 * @param {Object} profile - User profile
 * @param {Object} metrics - User metrics
 * @param {string} topic - Current topic
 * @param {Object} sessionContext - Session context (attempts, last widget, etc)
 * @returns {Object} Adaptive learning decision and context
 */
async function getAdaptiveLearningContext(profile, metrics, topic, sessionContext = {}) {
  if (!topic) return null;

  try {
    const result = await adaptiveEngine.run(
      { query: topic, topic },
      {
        userProfile: {
          scores: profile?.detected_styles,
          weak_topics: profile?.weak_topics || [],
          strong_topics: profile?.strong_topics || [],
          confidence: profile?.confidence_score ?? 0.5,
          knowledge_level: profile?.knowledge_level || 'intermediate',
        },
        userMetrics: {
          engagement_score: metrics?.engagement?.score ?? 0.5,
          improvement_score: metrics?.improvement?.score ?? 0.5,
        },
        sessionContext: sessionContext,
        realtimeSignals: sessionContext.signals || {},
        optionalAnalytics: sessionContext.analytics || {},
      }
    );

    return result.success ? result.result : null;
  } catch (err) {
    console.error('Adaptive learning engine error:', err.message);
    return null;
  }
}

/**
 * Build enhanced system prompt with adaptive learning context
 * @param {string} basePrompt - Base personalized prompt
 * @param {Object} adaptiveContext - Adaptive learning context
 * @returns {string} Enhanced system prompt
 */
function enhancePromptWithAdaptive(basePrompt, adaptiveContext) {
  if (!adaptiveContext) return basePrompt;

  const { cognitive_state, reasoning, personalization_applied, escalation_applied } = adaptiveContext;

  const adaptiveInstructions = `
---
ADAPTIVE LEARNING ENGINE ANALYSIS:
- Cognitive State: ${cognitive_state}
- Engine Reasoning: ${reasoning}
- Recommended Widget: ${adaptiveContext.widget_type}
- Difficulty: ${personalization_applied?.difficulty || 'standard'}
- Pace: ${personalization_applied?.pace || 'normal'}
- Hints Enabled: ${personalization_applied?.hints_enabled ? 'Yes' : 'No'}
- Comprehension Check Required: ${personalization_applied?.comprehension_check_required ? 'Yes' : 'No'}
${escalation_applied?.level > 0 ? `- ESCALATION ACTIVE (Level ${escalation_applied.level}): ${escalation_applied.actions.join(', ')}` : ''}
---`;

  return basePrompt + adaptiveInstructions;
}

function buildBanditReason(selectedAction, context = {}) {
  const reasonMap = {
    visual_widget: "Adapting with a visual-first explanation for this learning state.",
    guided_steps: "Switching to guided steps because recent signals suggest the learner needs more support.",
    quiz_check: "Adding a quick check because the learner appears ready to confirm understanding.",
    text_explanation: "Using a clear text explanation to keep the response focused and stable.",
  };

  const contextNotes = [];
  if (context.cognitiveState) contextNotes.push(`state: ${context.cognitiveState}`);
  if (context.performanceTrend) contextNotes.push(`trend: ${context.performanceTrend}`);
  if (context.topicStatus) contextNotes.push(`topic: ${context.topicStatus}`);

  return `${reasonMap[selectedAction] || "Adapting based on recent performance."}${contextNotes.length ? ` (${contextNotes.join(', ')})` : ''}`;
}

const client = new AnthropicFoundry({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiVersion: "2023-06-01",
});

const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

function setupSSE(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("\n"); // Flush headers immediately
}

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function handleStream(messages, res) {
  let aborted = false;

  const stream = client.messages.stream({
    model,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages,
    tools: [SHOW_WIDGET_TOOL],
  });

  // Keep connection alive — send heartbeat every 15s
  const heartbeat = setInterval(() => {
    if (!aborted) res.write(":heartbeat\n\n");
  }, 15000);

  stream.on("text", (text) => {
    if (!aborted) sendSSE(res, { type: "text_delta", text });
  });

  stream.on("contentBlock", (block) => {
    if (block.type === "tool_use" && !aborted) {
      sendSSE(res, {
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: block.input,
      });
    }
  });

  stream.on("message", (message) => {
    if (!aborted) {
      sendSSE(res, {
        type: "message_complete",
        stop_reason: message.stop_reason,
        id: message.id,
      });
    }
  });

  stream.on("error", (error) => {
    console.error("Stream error:", error.message);
    if (!aborted) {
      sendSSE(res, { type: "error", error: error.message || "Stream error" });
      clearInterval(heartbeat);
      res.end();
      aborted = true;
    }
  });

  stream.on("end", () => {
    if (!aborted) {
      sendSSE(res, { type: "done" });
      clearInterval(heartbeat);
      res.end();
      aborted = true;
    }
  });

  req_cleanup(res, stream, heartbeat, () => { aborted = true; });

  // Catch any unhandled stream.done() rejections
  stream.done().catch(() => {});
}

function req_cleanup(res, stream, heartbeat, setAbort) {
  // Listen on the underlying socket for close
  const socket = res.socket || res.connection;
  if (socket) {
    socket.on("close", () => {
      setAbort();
      clearInterval(heartbeat);
      try { stream.abort(); } catch (e) {}
    });
  }
}

router.post("/chat", async (req, res) => {
  const { messages, userId, behavior = null, conversationId = null } = req.body;
  console.log("POST /api/chat", messages?.length, "messages", userId ? `user:${userId}` : "anonymous");

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  setupSSE(res);

  let aborted = false;

  try {
    // Extract last user message for topic detection and personalization
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const userQuery = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : '';
    const currentTopic = extractCurrentTopic(userQuery);

    // Fetch user profile and metrics
    const profile = await analyzeUserProfile(userId);
    const metrics = userId ? await getUserMetrics(userId) : null;

    // Generate personalization strategy with query context and metrics
    const strategy = getPersonalizationStrategy(profile, userQuery, metrics);
    let systemPrompt = buildPersonalizedPrompt(strategy, profile, currentTopic);

    // Get adaptive learning context if topic detected
    const adaptiveContext = await getAdaptiveLearningContext(profile, metrics, currentTopic, {
      signals: { incorrect_attempts: 0 },
      analytics: {},
    });

    // Enhance prompt with adaptive learning context
    systemPrompt = enhancePromptWithAdaptive(systemPrompt, adaptiveContext);

    console.log("Personalization strategy:", strategy, "Topic:", currentTopic);
    if (adaptiveContext) {
      console.log("Adaptive context:", adaptiveContext.cognitive_state, adaptiveContext.widget_type);
    }

    // Get topic history for explanation
    const topicHistory = currentTopic && userId ? await getTopicHistory(userId, currentTopic) : null;

    // Run bandit alongside the existing policy first; control can be enabled via env flag.
    const banditMode = getBanditMode();
    const banditEnvelope = getBanditDecisionEnvelope({
      userId,
      conversationId,
      topic: currentTopic,
      profile,
      metrics,
      adaptiveContext,
      topicHistory,
      behavior,
    });
    const banditDecision = createBanditDecision({
      userId,
      conversationId,
      topicKey: banditEnvelope.topicInfo.topicKey,
      topicLabel: banditEnvelope.topicInfo.topicLabel,
      context: banditEnvelope.context,
      selectedAction: banditEnvelope.selection.selectedAction,
      decisionSource: banditEnvelope.selection.decisionSource,
      confidenceLevel: banditEnvelope.selection.confidenceLevel,
      epsilonUsed: banditEnvelope.selection.epsilonUsed,
      shadow: !banditMode.controlEnabled,
    });

    if (banditMode.controlEnabled) {
      systemPrompt += getBanditActionPrompt(banditDecision);
    }

    // Run adaptive policy for decision context
    const policyDecision = adaptivePolicy({
      cognitiveState: adaptiveContext?.cognitive_state || 'flow',
      effectivenessScore: metrics?.overall?.score ? metrics.overall.score / 100 : 0.5,
      engagementScore: metrics?.engagement?.score ? metrics.engagement.score / 100 : 0.5,
      topicHistory,
      learningStyle: profile?.dominant_style || 'visual',
    });

    // Generate explanation for transparency
    const explanation = explainAdaptiveDecision({
      profile,
      cognitiveState: adaptiveContext?.cognitive_state || 'flow',
      topic: currentTopic,
      policyDecision,
      topicHistory,
    });
    explanation.reasons = Array.isArray(explanation.reasons) ? explanation.reasons : [];
    explanation.reasons.unshift(buildBanditReason(banditDecision.selectedAction, banditEnvelope.context));

    // Send personalization metadata at start of stream
    sendSSE(res, {
      type: "personalization_meta",
      explanation,
      cognitiveState: adaptiveContext?.cognitive_state || 'flow',
      topic: banditEnvelope.topicInfo.topicLabel || currentTopic,
      topicKey: banditEnvelope.topicInfo.topicKey,
      strategy: {
        force_visual: strategy.force_visual,
        response_length: strategy.response_length,
        explanation_style: strategy.explanation_style,
        interaction_mode: strategy.interaction_mode,
      },
      decisionId: banditDecision.id,
      selectedAction: banditDecision.selectedAction,
      decisionSource: banditDecision.decisionSource,
      confidenceLevel: banditDecision.confidenceLevel,
      banditMode: banditMode.controlEnabled ? "control" : "shadow",
      adaptationReason: buildBanditReason(banditDecision.selectedAction, banditEnvelope.context),
    });

    const stream = client.messages.stream({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      tools: [SHOW_WIDGET_TOOL],
    });

    const heartbeat = setInterval(() => {
      if (!aborted) {
        try { res.write(":heartbeat\n\n"); } catch(e) {}
      }
    }, 15000);

    // Collect response text for fact-checking
    let responseText = "";
    // Store retrieved chunks for fact-checking (passed via request or context)
    const retrievedChunks = req.body.retrievedChunks || [];

    stream.on("text", (text) => {
      if (!aborted) {
        responseText += text;
        sendSSE(res, { type: "text_delta", text });
      }
    });

    stream.on("contentBlock", (block) => {
      if (block.type === "tool_use" && !aborted) {
        sendSSE(res, {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
    });

    stream.on("message", (message) => {
      if (!aborted) {
        sendSSE(res, {
          type: "message_complete",
          stop_reason: message.stop_reason,
          id: message.id,
        });
      }
    });

    stream.on("error", (error) => {
      console.error("Stream error:", error.message);
      if (!aborted) {
        sendSSE(res, { type: "error", error: error.message || "Stream error" });
        clearInterval(heartbeat);
        res.end();
        aborted = true;
      }
    });

    stream.on("end", async () => {
      if (!aborted) {
        // Run fact-checking on the collected response
        try {
          if (responseText.length > 50) {
            const factCheckResult = await factChecker.execute({
              answer: responseText,
              retrievedChunks: retrievedChunks,
              query: userQuery,
            });
            sendSSE(res, { type: "fact_check", ...factCheckResult });
          }
        } catch (err) {
          console.error("Fact check error:", err.message);
          // Send a minimal fact check result on error
          sendSSE(res, {
            type: "fact_check",
            confidence: 0.5,
            summary: "Fact checking unavailable",
            sources: [],
            error: true,
          });
        }

        sendSSE(res, { type: "done" });
        clearInterval(heartbeat);
        res.end();
        aborted = true;
      }
    });

    // Clean up on client disconnect
    req.on("close", () => {
      if (!aborted) {
        console.log("Client disconnected");
        aborted = true;
        clearInterval(heartbeat);
        try { stream.abort(); } catch (e) {}
      }
    });

    stream.done().catch(() => {});

  } catch (error) {
    console.error("Chat error:", error.message);
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
    conversationId = null,
    bandit = null,
  } = req.body;
  console.log("POST /api/tool-result", messages?.length, "messages", userId ? `user:${userId}` : "anonymous");

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  setupSSE(res);

  let aborted = false;

  try {
    // Extract last user message for topic detection
    const lastUserMessage = messages.filter(m => m.role === 'user' && typeof m.content === 'string').pop();
    const userQuery = lastUserMessage?.content || '';
    const currentTopic = extractCurrentTopic(userQuery);

    // Fetch user profile and metrics
    const profile = await analyzeUserProfile(userId);
    const metrics = userId ? await getUserMetrics(userId) : null;

    // Generate personalization strategy with query context and metrics
    const strategy = getPersonalizationStrategy(profile, userQuery, metrics);
    let systemPrompt = buildPersonalizedPrompt(strategy, profile, currentTopic);
    const banditMode = getBanditMode();
    if (banditMode.controlEnabled && bandit?.selectedAction) {
      systemPrompt += getBanditActionPrompt({
        selectedAction: bandit.selectedAction,
      });
    }

    if (bandit?.decisionId && bandit?.interactionData) {
      recordBanditInteraction({
        decisionId: bandit.decisionId,
        interactionType: bandit.interactionType || 'tool_result',
        data: bandit.interactionData,
        source: 'tool_result',
        eventId: bandit.eventId || null,
      });
    }

    const stream = client.messages.stream({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      tools: [SHOW_WIDGET_TOOL],
    });

    const heartbeat = setInterval(() => {
      if (!aborted) {
        try { res.write(":heartbeat\n\n"); } catch(e) {}
      }
    }, 15000);

    // Collect response text for fact-checking
    let responseText = "";
    const retrievedChunks = req.body.retrievedChunks || [];

    stream.on("text", (text) => {
      if (!aborted) {
        responseText += text;
        sendSSE(res, { type: "text_delta", text });
      }
    });

    stream.on("contentBlock", (block) => {
      if (block.type === "tool_use" && !aborted) {
        sendSSE(res, {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
    });

    stream.on("message", (message) => {
      if (!aborted) {
        sendSSE(res, {
          type: "message_complete",
          stop_reason: message.stop_reason,
          id: message.id,
        });
      }
    });

    stream.on("error", (error) => {
      console.error("Tool-result stream error:", error.message);
      if (!aborted) {
        sendSSE(res, { type: "error", error: error.message || "Stream error" });
        clearInterval(heartbeat);
        res.end();
        aborted = true;
      }
    });

    stream.on("end", async () => {
      if (!aborted) {
        // Run fact-checking on the collected response
        try {
          if (responseText.length > 50) {
            const factCheckResult = await factChecker.execute({
              answer: responseText,
              retrievedChunks: retrievedChunks,
              query: userQuery,
            });
            sendSSE(res, { type: "fact_check", ...factCheckResult });
          }
        } catch (err) {
          console.error("Fact check error (tool-result):", err.message);
        }

        sendSSE(res, { type: "done" });
        clearInterval(heartbeat);
        res.end();
        aborted = true;
      }
    });

    req.on("close", () => {
      if (!aborted) {
        console.log("Client disconnected (tool-result)");
        aborted = true;
        clearInterval(heartbeat);
        try { stream.abort(); } catch (e) {}
      }
    });

    stream.done().catch(() => {});

  } catch (error) {
    console.error("Tool-result error:", error.message);
    if (!aborted) {
      sendSSE(res, { type: "error", error: error.message || "Failed to continue" });
      res.end();
    }
  }
});

export default router;
