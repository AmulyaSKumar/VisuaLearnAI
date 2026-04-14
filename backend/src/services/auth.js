/**
 * Authentication Service
 * Supabase Auth integration for token verification
 * @module services/auth
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

/**
 * Supabase client for auth verification
 * Uses service key for server-side token validation
 */
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey
);

/**
 * Authentication error class
 */
export class AuthError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Extract Bearer token from Authorization header
 * @param {import('express').Request} req - Express request object
 * @returns {string|null} JWT token or null if not found
 */
export function extractToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and plain token formats
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
}

/**
 * Verify a Supabase JWT token and return user info
 * @param {import('express').Request} req - Express request object
 * @returns {Promise<{userId: string, email: string}>} User information
 * @throws {AuthError} If token is invalid or missing
 */
export async function verifyToken(req) {
  const token = extractToken(req);

  if (!token) {
    throw new AuthError('Missing authorization token', 401);
  }

  try {
    // Verify the token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      logger.warn('Token verification failed:', error.message);
      throw new AuthError('Invalid or expired token', 401);
    }

    if (!user) {
      throw new AuthError('User not found', 401);
    }

    return {
      userId: user.id,
      email: user.email || '',
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    logger.error('Token verification error:', error.message);
    throw new AuthError('Authentication failed', 401);
  }
}

/**
 * Verify a token from WebSocket query parameter
 * @param {string} token - JWT token from query param
 * @returns {Promise<{userId: string, email: string}>} User information
 * @throws {AuthError} If token is invalid or missing
 */
export async function verifyWebSocketToken(token) {
  if (!token) {
    throw new AuthError('Missing authentication token', 401);
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      logger.warn('WebSocket token verification failed:', error.message);
      throw new AuthError('Invalid or expired token', 401);
    }

    if (!user) {
      throw new AuthError('User not found', 401);
    }

    return {
      userId: user.id,
      email: user.email || '',
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    logger.error('WebSocket token verification error:', error.message);
    throw new AuthError('Authentication failed', 401);
  }
}

/**
 * Check if a userId matches the authenticated user
 * @param {string} authenticatedUserId - User ID from token
 * @param {string} requestedUserId - User ID from request params
 * @returns {boolean} True if IDs match
 */
export function checkOwnership(authenticatedUserId, requestedUserId) {
  return authenticatedUserId === requestedUserId;
}

export default {
  verifyToken,
  verifyWebSocketToken,
  extractToken,
  checkOwnership,
  AuthError,
};
