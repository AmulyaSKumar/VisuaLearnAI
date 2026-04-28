import { Router } from "express";
import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import { SHOW_WIDGET_TOOL, SYSTEM_PROMPT } from "../src/services/anthropic/prompts.js";
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

const router = Router();

// Cache TTL for profiles (5 min)
const PROFILE_CACHE_TTL = 300;

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

const client = new AnthropicFoundry({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiVersion: "2023-06-01",
});

const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

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
    logger.error({ error }, "Stream error");
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
  const { messages, userId, behavior, conversationId = null } = req.body;
  logger.info({ messageCount: messages?.length, userId: userId?.slice(0,8) }, "POST /api/chat");

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
    const currentTopic = extractCurrentTopic(userQuery);

    // Fetch user profile and metrics (used as CONTEXT for bandit, not for prompt shaping)
    const profile = await getCachedProfile(userId);
    const metrics = userId ? await getUserMetrics(userId) : null;
    const cognitiveState = await getCognitiveStateForBandit(userId, currentTopic);

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

    // Build system prompt using ONLY bandit action (no style-based personalization)
    const actionInstructions = getActionInstructions(banditDecision.selectedAction);
    const systemPrompt = `${SYSTEM_PROMPT}\n\n## Response Format Requirement (CRITICAL)\n${actionInstructions}`;

    logger.info({ selectedAction: banditDecision.selectedAction, topic: currentTopic, source: banditDecision.decisionSource }, "Bandit decision");

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
      logger.error({ error }, "Stream error");
      if (!aborted) {
        sendSSE(res, { type: "error", error: error.message || "Stream error" });
        clearInterval(heartbeat);
        res.end();
        aborted = true;
      }
    });

    stream.on("end", () => {
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
          logger.warn({ violations: enforcement.violations }, "Enforcement failed");
        }

        sendSSE(res, { type: "done" });
        clearInterval(heartbeat);
        res.end();
        aborted = true;
      }
    });

    // Clean up on actual client disconnect (use res.on('close') instead of req)
    res.on("close", () => {
      if (!aborted) {
        logger.debug("Response closed, aborting stream");
        aborted = true;
        clearInterval(heartbeat);
        try { stream.abort(); } catch (e) {}
      }
    });

    stream.done().catch(() => {});

  } catch (error) {
    logger.error({ error }, "Chat error");
    if (!aborted) {
      sendSSE(res, { type: "error", error: error.message || "Failed to connect to AI" });
      res.end();
    }
  }
});

router.post("/tool-result", async (req, res) => {
  const { messages, userId, bandit: banditData = null } = req.body;
  logger.info({ messageCount: messages?.length, userId: userId?.slice(0,8) }, "POST /api/tool-result");

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

    // Build system prompt using ONLY bandit action (no profile-based personalization)
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
      logger.error({ error }, "Tool-result stream error");
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

    res.on("close", () => {
      if (!aborted) {
        logger.debug("Response closed (tool-result), aborting stream");
        aborted = true;
        clearInterval(heartbeat);
        try { stream.abort(); } catch (e) {}
      }
    });

    stream.done().catch(() => {});

  } catch (error) {
    logger.error({ error }, "Tool-result error");
    if (!aborted) {
      sendSSE(res, { type: "error", error: error.message || "Failed to continue" });
      res.end();
    }
  }
});

export default router;
