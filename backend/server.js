/**
 * VisuaLearn Backend Entry Point
 * Delegates to modular src/server.js
 *
 * This file is the entry point that:
 * 1. Loads environment variables
 * 2. Starts the server from src/server.js
 * 3. Handles graceful shutdown
 */

import 'dotenv/config';
import { startServer } from './src/server.js';
import { logger } from './src/utils/logger.js';

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Start the server
const server = await startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
