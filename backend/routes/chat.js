import { Router } from "express";
import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import { SHOW_WIDGET_TOOL, SYSTEM_PROMPT, createSystemPrompt } from "../src/services/anthropic/prompts.js";
import {
  analyzeUserProfile,
  updateLearningStyle,
  detectKnowledgeLevel,
} from "../src/agents/personalization.js";
import { cache } from "../src/services/cache.js";
import { logger } from "../src/services/logger.js";

const router = Router();

// Cache TTL for profiles (5 min)
const PROFILE_CACHE_TTL = 300;

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
    // Fallback to direct fetch
    return analyzeUserProfile(userId);
  }
}

/**
 * Invalidate profile cache
 * @param {string} userId - User ID
 */
async function invalidateProfileCache(userId) {
  if (!userId) return;
  await cache.del(`profile:${userId}`);
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
  const { messages, userId, behavior, preferences = {} } = req.body;
  logger.info({ messageCount: messages?.length, userId: userId?.slice(0,8), preferences }, "POST /api/chat");

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  setupSSE(res);

  let aborted = false;
  let widgetCount = 0; // Track widgets for behavior update

  try {
    // Fetch user profile (fast, cached)
    const profile = await getCachedProfile(userId);

    // Merge per-query preferences with profile
    const mergedProfile = {
      ...profile,
      preferences: {
        ...profile?.preferences,
        mode: preferences.mode || profile?.preferences?.mode || 'balanced',
        style: preferences.style || profile?.preferences?.style || 'visual',
      }
    };

    const systemPrompt = createSystemPrompt(mergedProfile, preferences);

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
        // Track widget generation
        if (block.name === "show_widget") widgetCount++;

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

        // Update learning style async (non-blocking)
        if (userId) {
          const behaviorData = {
            widgetInteractions: widgetCount,
            avgMessageLength: behavior?.avgMessageLength || 0,
            followUpCount: behavior?.followUpCount || 0,
          };
          // Fire and forget - don't await
          updateLearningStyle(userId, messages, behaviorData).catch(() => {});
          // Invalidate cache so next request gets fresh profile
          invalidateProfileCache(userId).catch(() => {});
        }
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
  const { messages, userId } = req.body;
  logger.info({ messageCount: messages?.length, userId: userId?.slice(0,8) }, "POST /api/tool-result");

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  setupSSE(res);

  let aborted = false;

  try {
    // Use same personalized prompt as /chat
    const profile = await getCachedProfile(userId);
    const systemPrompt = createSystemPrompt(profile);

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
