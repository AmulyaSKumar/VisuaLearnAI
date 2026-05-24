/**
 * VisuaLearn Backend Server
 * Main Express application with modular architecture
 * @module server
 */

import http from 'http';
import express from 'express';

import { config } from './config/environment.js';
import { setupMiddleware, setupErrorHandler } from './middleware/index.js';
import { registerRoutes } from './api/index.js';
import { logger, createRequestLogger, getSentryRequestHandler, getSentryErrorHandler, flushSentry } from './services/logger.js';
import { traceMiddleware } from './middleware/traceMiddleware.js';
import { supabase } from './database/client.js';
import { agentRegistry } from './agents/index.js';
import { scheduleDailyReset } from './services/costTracker.js';
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
 * Native HTTP server with SSE support
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

  // Everything else goes through Express (including /api/chat and /api/tool-result)
  app(req, res);
});

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

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off('listening', onListening);
        reject(error);
      };

      const onListening = () => {
        server.off('error', onError);
        logger.info(`VisuaLearn backend starting on http://localhost:${PORT}`);
        logger.info({ model: config.azure.chatDeployment }, 'Chat model configured');
        logger.info({ connected: supabaseOk }, 'Supabase status');
        logger.info({ count: agentRegistry.agents.size }, 'Agents registered');
        logger.info({ redis: cacheStats.isRedisAvailable }, 'Cache status');
        logger.info('Auth: Supabase JWT verification enabled');
        logger.info('Rate limiting: enabled');
        logger.info(`Server ready. Try: curl http://localhost:${PORT}/api/health`);
        resolve();
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(PORT);
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
    if (error?.code === 'EADDRINUSE') {
      logger.error({ err: error, port: PORT }, `Port ${PORT} is already in use. Stop the existing backend process or use a different PORT.`);
    } else {
      logger.error({ err: error }, 'Failed to start server');
    }
    process.exit(1);
  }
}

/**
 * Export for testing
 */
export { app, server };

export default server;
