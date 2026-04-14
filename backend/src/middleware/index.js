/**
 * Middleware Module
 * Express middleware stack
 * @module middleware
 */

import express from 'express';
import cors from 'cors';
import errorHandler from './errorHandler.js';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

/**
 * Register all middleware
 * @param {express.Application} app - Express app instance
 */
export function setupMiddleware(app) {
  // CORS
  app.use(cors({
    origin: config.cors.origin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // JSON parsing
  app.use(express.json({ limit: '10mb' }));

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

  // Error handling (must be last)
  app.use(errorHandler);
}

export { errorHandler };
export default setupMiddleware;
