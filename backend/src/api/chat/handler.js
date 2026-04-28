import { Router } from "express";
import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import { SHOW_WIDGET_TOOL, SYSTEM_PROMPT } from "../../services/anthropic/prompts.js";
import { analyzeUserProfile, getUserMetrics, getTopicHistory } from "../../agents/personalization.js";
import {
  bandit,
  getBanditDecision,
  recordRewardFromInteraction,
  enforceAction,
  getActionInstructions,
  FAILSAFE_ACTION,
} from "../../bandit/index.js";
import { getCognitiveState } from "../../services/learningState.js";
import { FactCheckerAgent } from "../../agents/fact-checker.js";

// Initialize engines
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
 * Build system prompt using ONLY bandit decision - no style-based personalization
 * Context (cognitive state, topic status, engagement) is used by bandit internally
 * @param {Object} banditDecision - Decision from contextual bandit
 * @returns {string} - System prompt with bandit action instructions
 */
function buildBanditSystemPrompt(banditDecision) {
  // Base system prompt + bandit action instructions (no style-based personalization)
  const actionInstructions = getActionInstructions(banditDecision.selectedAction);

  return `${SYSTEM_PROMPT}

## Response Format Requirement (CRITICAL)
${actionInstructions}`;
}

/**
 * Get cognitive state for bandit context
 * @param {string} userId - User ID
 * @param {string} topic - Current topic
 * @returns {string} Cognitive state
 */
async function getCognitiveStateForBandit(userId, topic) {
  try {
    const result = await getCognitiveState(userId, topic);
    return result?.cognitiveState || 'flow';
  } catch (err) {
    console.error('Error getting cognitive state:', err.message);
    return 'flow';
  }
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
    // Initialize bandit if not ready
    if (!bandit.isReady()) {
      await bandit.initialize();
    }

    // Extract last user message for topic detection
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const userQuery = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : '';
    const currentTopic = extractCurrentTopic(userQuery);

    // Fetch user profile and metrics (used as CONTEXT for bandit, not for prompt shaping)
    const profile = await analyzeUserProfile(userId);
    const metrics = userId ? await getUserMetrics(userId) : null;

    // Get cognitive state for bandit context
    const cognitiveState = await getCognitiveStateForBandit(userId, currentTopic);

    // BANDIT IS AUTHORITATIVE - Get decision using new LinUCB-based system
    const banditDecision = await getBanditDecision({
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

    // Build system prompt using ONLY bandit decision (no style-based personalization)
    const systemPrompt = buildBanditSystemPrompt(banditDecision);

    console.log("Bandit decision:", banditDecision.selectedAction, "Topic:", currentTopic, "Source:", banditDecision.decisionSource, "Context:", banditDecision.context?.contextKey);

    // Build explanation for transparency (bandit-based only)
    const explanation = {
      summary: buildBanditReason(banditDecision.selectedAction, banditDecision.context || {}),
      reasons: [buildBanditReason(banditDecision.selectedAction, banditDecision.context || {})],
    };

    // Send bandit decision metadata at start of stream
    sendSSE(res, {
      type: "personalization_meta",
      explanation,
      cognitiveState: banditDecision.context?.labels?.cognitiveState || cognitiveState,
      topic: currentTopic,
      topicKey: banditDecision.topicKey,
      decisionId: banditDecision.id,
      selectedAction: banditDecision.selectedAction,
      decisionSource: banditDecision.decisionSource,
      coldStart: banditDecision.coldStart,
      banditMode: banditDecision.isBaseline ? "baseline" : "control",
      adaptationReason: buildBanditReason(banditDecision.selectedAction, banditDecision.context || {}),
      context: banditDecision.context?.labels || {
        cognitiveState,
        engagementLevel: 'medium',
        topicStatus: 'neutral',
        performanceTrend: 'stable',
      },
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

    // Collect response text and tool calls for enforcement
    let responseText = "";
    const toolCalls = [];
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
        // Collect tool calls for enforcement validation
        toolCalls.push({ name: block.name, id: block.id, input: block.input });
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
        // ENFORCEMENT: Validate response matches selected action
        const enforcement = enforceAction(
          banditDecision.id,
          banditDecision.selectedAction,
          responseText,
          toolCalls
        );

        // Send enforcement result to client
        sendSSE(res, {
          type: "enforcement_result",
          decisionId: banditDecision.id,
          originalAction: banditDecision.selectedAction,
          enforced: enforcement.enforced,
          violations: enforcement.violations || [],
          fallback: enforcement.fallback || null,
        });

        if (!enforcement.enforced) {
          console.warn("Enforcement failed:", enforcement.violations);
        }

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
    bandit: banditData = null,
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

    // Record bandit interaction if provided (reward signal)
    if (banditData?.decisionId && banditData?.interactionData) {
      try {
        await recordRewardFromInteraction(
          banditData.decisionId,
          banditData.interactionType || 'tool_result',
          banditData.interactionData,
          null // topicHistory - could be fetched if needed
        );
      } catch (err) {
        console.warn("Failed to record bandit interaction:", err.message);
      }
    }

    // Build system prompt using ONLY bandit action (no style-based personalization)
    // If bandit action was passed from original request, use it; otherwise use base prompt
    let systemPrompt = SYSTEM_PROMPT;
    if (banditData?.selectedAction) {
      const actionInstructions = getActionInstructions(banditData.selectedAction);
      systemPrompt += `\n\n## Response Format Requirement (CRITICAL)\n${actionInstructions}`;
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
