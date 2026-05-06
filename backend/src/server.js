/**
 * VisuaLearn Backend Server
 * Main Express application with modular architecture
 * @module server
 */

import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

import { config } from './config/environment.js';
import { setupMiddleware, setupErrorHandler } from './middleware/index.js';
import { registerRoutes } from './api/index.js';
import { logger, createRequestLogger, getSentryRequestHandler, getSentryErrorHandler, flushSentry } from './services/logger.js';
import { traceMiddleware } from './middleware/traceMiddleware.js';
import { supabase } from './database/client.js';
import { agentRegistry } from './agents/index.js';
import { createRealtimeProxy } from './websocket/realtime-proxy.js';
import { scheduleDailyReset } from './services/costTracker.js';
import { verifyWebSocketToken } from './services/auth.js';
import { cache } from './services/cache.js';

// Initialize Express app
const app = express();

// Sentry request handler (must be first)
app.use(getSentryRequestHandler());

// Trace middleware for distributed tracing
app.use(traceMiddleware);

// Request logging
app.use(createRequestLogger());

// Setup middleware
setupMiddleware(app);

// Register API routes
registerRoutes(app);

// Error handlers (must be AFTER all routes)
setupErrorHandler(app);  // Application error handler
app.use(getSentryErrorHandler());  // Sentry error handler (if enabled)

/**
 * Native HTTP server with SSE & WebSocket support
 */
const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS' && req.url?.startsWith('/api/')) {
    const origin = req.headers.origin;
    if (config.cors.origin.includes(origin)) {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      });
    }
    return res.end();
  }

  // Everything else → Express (including /api/chat and /api/tool-result)
  app(req, res);
});

/**
 * WebSocket Server (for real-time voice)
 */
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (req, socket, head) => {
  const sanitizedUrl = (() => {
    if (!req.url) return req.url;
    try {
      const urlObj = new URL(req.url, 'ws://localhost');
      if (urlObj.searchParams.has('token')) {
        const rawToken = urlObj.searchParams.get('token') || '';
        urlObj.searchParams.set('token', `[${rawToken.length} chars]`);
      }
      return `${urlObj.pathname}${urlObj.search}`;
    } catch {
      return req.url.replace(/token=[^&]+/i, 'token=[redacted]');
    }
  })();

  logger.info({ url: sanitizedUrl }, 'WebSocket upgrade request received');

  // Only handle /ws/realtime path
  if (!req.url?.startsWith('/ws/realtime')) {
    logger.warn({ url: req.url }, 'WebSocket upgrade rejected: wrong path');
    socket.destroy();
    return;
  }

  // Extract token from query parameter
  try {
    const urlObj = new URL(req.url, 'ws://localhost');
    const token = urlObj.searchParams.get('token');

    // Log auth params WITHOUT the actual token (security)
    const safeParams = {};
    for (const [key, value] of urlObj.searchParams.entries()) {
      safeParams[key] = key === 'token' ? `[${value.length} chars]` : value;
    }
    logger.info({ hasToken: !!token, params: safeParams }, 'WebSocket auth params');

    if (!token) {
      logger.warn('WebSocket connection rejected: missing token');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Verify the token
    logger.info('Verifying WebSocket token...');
    const user = await verifyWebSocketToken(token);
    logger.info({ userId: user.userId?.slice(0, 8) }, 'WebSocket token verified');
    req.user = user;

    wss.handleUpgrade(req, socket, head, (ws) => {
      logger.info('WebSocket upgrade successful');
      wss.emit('connection', ws, req);
    });
  } catch (error) {
    logger.warn({ error: error.message, stack: error.stack }, 'WebSocket auth failed');
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});

wss.on('connection', (clientWs, req) => {
  const userId = req.user?.userId || 'anonymous';
  logger.info(`🎙️ Voice client connected (user: ${userId.slice(0, 8)}...)`);

  // Create personalized realtime proxy connection
  // Fetches user profile, metrics, and injects personalization
  createRealtimeProxy(clientWs, req.url, req.user);
});

/**
 * Start server
 */
const PORT = config.port;

export async function startServer() {
  try {
    // Test Supabase connection
    const { data: user, error } = await supabase.auth.getUser();
    const supabaseOk = !error;

    // Start daily cost reset scheduler
    scheduleDailyReset();

    // Get cache status
    const cacheStats = cache.getStats();

    server.listen(PORT, () => {
      logger.info(`VisuaLearn backend starting on http://localhost:${PORT}`);
      logger.info({ model: config.anthropic.model }, 'Chat model configured');
      logger.info({ connected: supabaseOk }, 'Supabase status');
      logger.info({ count: agentRegistry.agents.size }, 'Agents registered');
      logger.info({ redis: cacheStats.isRedisAvailable }, 'Cache status');
      logger.info('Auth: Supabase JWT verification enabled');
      logger.info('Rate limiting: enabled');
      logger.info(`Server ready. Try: curl http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info({ signal }, 'Shutdown signal received');

      server.close(async () => {
        logger.info('HTTP server closed');

        // Flush Sentry events
        await flushSentry();

        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

/**
 * Export for testing
 */
export { app, server, wss };

export default server;
