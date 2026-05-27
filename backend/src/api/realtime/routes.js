import { Router } from 'express';
import { REALTIME_CONFIG } from '../../services/realtime/config.js';
import realtimeClient, { createAzureRealtimeSocket } from '../../services/realtime/realtimeClient.js';
import realtimeSessionManager from '../../services/realtime/sessionManager.js';
import { sanitizeAssistantResponse } from '../../services/responseBehavior.js';
import { createSessionUpdateEvent } from '../../services/realtime/payloadValidator.js';
import { traceRealtime } from '../../services/realtime/realtimeTrace.js';

const router = Router();

function getUserId(req) {
  return req.user?.userId || req.body?.userId;
}

function parseRealtimeEvent(raw) {
  try {
    return JSON.parse(typeof raw === 'string' ? raw : raw?.toString?.() || '{}');
  } catch {
    return null;
  }
}

function waitForSocketOpen(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out connecting to Azure realtime.')), 12000);
    socket.once('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function waitForRealtimeEvent(socket, matcher, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for Azure realtime event.'));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('message', onMessage);
      socket.off('error', onError);
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onMessage = (raw) => {
      const event = parseRealtimeEvent(raw);
      if (!event) return;
      if (event.type === 'error') {
        cleanup();
        reject(new Error(event.error?.message || 'Azure realtime error.'));
        return;
      }
      if (matcher(event)) {
        cleanup();
        resolve(event);
      }
    };

    socket.on('message', onMessage);
    socket.once('error', onError);
  });
}

router.get('/status', (req, res) => {
  const status = realtimeClient.getStatus();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    configured: status.configured,
    missing: status.missing,
  });
});

router.get('/diagnostics', async (req, res) => {
  const mode = String(req.query.mode || 'connectionOnly');
  const startedAt = Date.now();
  let socket;

  try {
    socket = createAzureRealtimeSocket();
    await waitForSocketOpen(socket);
    traceRealtime({ stage: 'socketConnected', payload: { mode } });

    if (mode === 'connectionOnly') {
      socket.close();
      return res.json({ success: true, stage: mode, duration: Date.now() - startedAt });
    }

    const sessionUpdate = createSessionUpdateEvent({
      instructions: 'Realtime diagnostics. Reply briefly when asked.',
      type: 'realtime',
    });
    socket.send(JSON.stringify(sessionUpdate));
    traceRealtime({ stage: 'sessionUpdateSent', payload: sessionUpdate });

    await waitForRealtimeEvent(socket, event => event.type === 'session.updated');
    traceRealtime({ stage: 'sessionUpdated', duration: Date.now() - startedAt });

    if (mode === 'sessionOnly') {
      socket.close();
      return res.json({ success: true, stage: mode, duration: Date.now() - startedAt });
    }

    if (mode === 'audioOnly' || mode === 'full') {
      const silence = Buffer.alloc(2400).toString('base64');
      const audioEvent = { type: 'input_audio_buffer.append', audio: silence };
      socket.send(JSON.stringify(audioEvent));
      traceRealtime({ stage: 'audioChunkSent', payload: audioEvent });

      if (mode === 'audioOnly') {
        socket.close();
        return res.json({ success: true, stage: mode, duration: Date.now() - startedAt });
      }
    }

    const itemEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Say diagnostics ok.' }],
      },
    };
    socket.send(JSON.stringify(itemEvent));

    const responseEvent = {
      type: 'response.create',
    };
    socket.send(JSON.stringify(responseEvent));
    traceRealtime({ stage: 'responseCreate', payload: responseEvent });

    await waitForRealtimeEvent(
      socket,
      event => event.type === 'response.done' || event.type === 'response.output_text.delta',
    );
    traceRealtime({ stage: 'responseCompleted', duration: Date.now() - startedAt });

    socket.close();
    return res.json({ success: true, stage: mode, duration: Date.now() - startedAt });
  } catch (error) {
    try { socket?.close(); } catch {}
    traceRealtime({
      stage: mode,
      success: false,
      error: error.message,
      duration: Date.now() - startedAt,
    });
    return res.status(500).json({
      success: false,
      stage: mode,
      duration: Date.now() - startedAt,
      error: error.message,
    });
  }
});

router.post('/session', async (req, res) => {
  try {
    const userId = getUserId(req);
    const {
      conversationId = null,
      mode = 'chat',
      personaId = null,
      preferences = {},
      activeTopic = null,
      documentId = null,
      createIfMissing = true,
    } = req.body || {};

    const session = await realtimeSessionManager.createSession({
      userId,
      conversationId,
      mode,
      personaId,
      preferences,
      activeTopic,
      documentId,
      createIfMissing,
    });

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        conversationId: session.conversationId,
        mode: session.mode,
        activeTopic: session.activeTopic,
        realtimeConfigured: realtimeClient.isConfigured(),
        expiresAt: session.expiresAt,
        ttl: session.ttl,
        azureSession: session.azureSession,
      },
      limits: REALTIME_CONFIG,
    });
  } catch (error) {
    console.error('[Realtime] Session create failed:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to create realtime session.' });
  }
});

router.patch('/session/:sessionId', async (req, res) => {
  try {
    const session = await realtimeSessionManager.rebuildSession({
      sessionId: req.params.sessionId,
      userId: getUserId(req),
      currentText: req.body?.currentText || '',
      updates: req.body || {},
    });

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        conversationId: session.conversationId,
        mode: session.mode,
        activeTopic: session.activeTopic,
        realtimeConfigured: realtimeClient.isConfigured(),
        expiresAt: session.expiresAt,
        ttl: session.ttl,
      },
      limits: REALTIME_CONFIG,
    });
  } catch (error) {
    console.error('[Realtime] Session update failed:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to update realtime session.' });
  }
});

router.post('/session/:sessionId/text', async (req, res) => {
  try {
    const userId = getUserId(req);
    const text = String(req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'Text is required.' });
    }

    let { session, context } = realtimeSessionManager.getTurnContext({
      sessionId: req.params.sessionId,
      userId,
      currentText: text,
      updates: req.body || {},
    });
    const budgetBefore = await realtimeSessionManager.enforceTokenBudget(session);
    if (budgetBefore.summarized || budgetBefore.trimmed) {
      ({ session, context } = realtimeSessionManager.getTurnContext({
        sessionId: req.params.sessionId,
        userId,
        currentText: text,
        updates: req.body || {},
      }));
    }

    const assistantText = sanitizeAssistantResponse(await realtimeClient.generateTextTurn({
      instructions: session.instructions,
      messages: context.conversationHistory,
      input: text,
    }));

    const assistantMetadata = {
      realtime: true,
      mode: session.mode,
      activeTopic: context.topicContext,
      documentId: context.documentContext?.documentId || null,
      temporary: true,
    };

    const { userMessage, assistantMessage } = await realtimeSessionManager.appendTemporaryTurn({
      sessionId: session.sessionId,
      userText: text,
      assistantText,
      userMetadata: {
        realtime: true,
        mode: session.mode,
        documentId: context.documentContext?.documentId || null,
      },
      assistantMetadata,
    });

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        conversationId: session.conversationId,
        mode: session.mode,
        activeTopic: context.topicContext,
        realtimeConfigured: realtimeClient.isConfigured(),
        expiresAt: session.expiresAt,
        ttl: session.ttl,
      },
      limits: REALTIME_CONFIG,
      budget: {
        beforeTurn: budgetBefore,
        afterTurn: realtimeSessionManager.estimateSessionTokens(session),
      },
      userMessage,
      assistantMessage: {
        ...assistantMessage,
        metadata: assistantMetadata,
      },
      text: assistantText,
      persisted: false,
    });
  } catch (error) {
    console.error('[Realtime] Text turn failed:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to process realtime turn.' });
  }
});

router.post('/session/:sessionId/summary', async (req, res) => {
  try {
    const summaryMessage = await realtimeSessionManager.saveSummary({
      sessionId: req.params.sessionId,
      userId: getUserId(req),
    });

    res.json({
      success: true,
      message: summaryMessage,
    });
  } catch (error) {
    console.error('[Realtime] Summary save failed:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to save realtime summary.' });
  }
});

router.delete('/session/:sessionId', async (req, res) => {
  const deleted = realtimeSessionManager.deleteSession(req.params.sessionId, getUserId(req));
  if (!deleted) {
    return res.status(404).json({ error: 'Realtime session not found.' });
  }

  res.json({ success: true });
});

export default router;
