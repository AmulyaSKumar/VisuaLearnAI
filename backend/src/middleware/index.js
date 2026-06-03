/**
 * Middleware Module
 * Express middleware stack
 * @module middleware
 */

import express from 'express';
import cors from 'cors';
import errorHandler from './errorHandler.js';
import { config, isAllowedCorsOrigin } from '../config/environment.js';
import { logger } from '../utils/logger.js';

/**
 * Register all middleware (except error handlers)
 * @param {express.Application} app - Express app instance
 */
export function setupMiddleware(app) {
  // CORS
  app.use(cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }));

  // JSON parsing
  app.use(express.json({ limit: '25mb' }));

  // Logging
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get(['/status', '/api/status'], (req, res) => {
    res.json({
      status: 'ok',
      service: 'VisuaLearn backend',
      environment: config.env,
      frontendUrl: config.frontendUrl,
      backendPublicUrl: config.backendPublicUrl,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // NOTE: Error handler should be registered AFTER routes in server.js
}

/**
 * Register error handler middleware (must be called AFTER all routes)
 * @param {express.Application} app - Express app instance
 */
export function setupErrorHandler(app) {
  app.use(errorHandler);
}

export { errorHandler };
export default setupMiddleware;
