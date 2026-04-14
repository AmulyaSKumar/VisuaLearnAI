/**
 * Logger Utility
 * Re-exports from services/logger.js for backward compatibility
 * @module utils/logger
 */

// Re-export everything from the main logger service
export {
  logger,
  createRequestLogger,
  getSentryErrorHandler,
  getSentryRequestHandler,
  flushSentry,
  isSentryInitialized,
} from '../services/logger.js';

// Default export
export { default } from '../services/logger.js';
