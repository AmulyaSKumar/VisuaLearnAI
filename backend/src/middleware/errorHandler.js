/**
 * Global Error Handler Middleware
 * Catches and formats all errors
 * @module middleware/errorHandler
 */

import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Express error handling middleware
 * Must be registered last (after all routes)
 */
export function errorHandler(err, req, res, next) {
  // Log error with full details
  logger.error('Request error:', {
    message: err?.message || 'Unknown error',
    name: err?.name || 'Error',
    status: err?.status || 500,
    code: err?.code,
    method: req.method,
    path: req.path,
    stack: err?.stack,
  });

  // Handle known errors
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
    });
  }

  // Handle Supabase errors
  if (err.message && err.message.includes('PGRST')) {
    return res.status(400).json({
      error: 'Database error',
      code: 'DB_ERROR',
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.message,
      code: 'VALIDATION_ERROR',
    });
  }

  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { debug: err.message }),
  });
}

export default errorHandler;
