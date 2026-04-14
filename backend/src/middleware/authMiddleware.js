/**
 * Authentication Middleware
 * Express middleware for protecting routes with Supabase Auth
 * @module middleware/authMiddleware
 */

import { verifyToken, checkOwnership, AuthError } from '../services/auth.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware that requires a valid authentication token
 * Attaches user info to req.user on success
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Next middleware function
 */
export async function requireAuth(req, res, next) {
  try {
    const user = await verifyToken(req);

    // Attach user info to request
    req.user = {
      userId: user.userId,
      email: user.email,
    };

    logger.debug(`Authenticated request from user: ${user.userId.slice(0, 8)}...`);
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        error: 'Unauthorized',
        message: error.message,
        traceId: req.traceId,
      });
    }

    logger.error('Auth middleware error:', error.message);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed',
      traceId: req.traceId,
    });
  }
}

/**
 * Middleware that requires ownership of the resource
 * Must be used AFTER requireAuth middleware
 * Checks if req.params.id matches req.user.userId
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Next middleware function
 */
export function requireOwnership(req, res, next) {
  const requestedId = req.params.id || req.params.userId;

  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      traceId: req.traceId,
    });
  }

  if (!requestedId) {
    // No ID in params, skip ownership check
    return next();
  }

  if (!checkOwnership(req.user.userId, requestedId)) {
    logger.warn(`Ownership check failed: ${req.user.userId} tried to access ${requestedId}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to access this resource',
      traceId: req.traceId,
    });
  }

  next();
}

/**
 * Combined middleware: requireAuth + requireOwnership
 * Convenience function for routes with :id parameter
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Next middleware function
 */
export async function requireAuthAndOwnership(req, res, next) {
  try {
    const user = await verifyToken(req);

    req.user = {
      userId: user.userId,
      email: user.email,
    };

    const requestedId = req.params.id || req.params.userId;

    if (requestedId && !checkOwnership(user.userId, requestedId)) {
      logger.warn(`Ownership check failed: ${user.userId} tried to access ${requestedId}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
        traceId: req.traceId,
      });
    }

    next();
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        error: 'Unauthorized',
        message: error.message,
        traceId: req.traceId,
      });
    }

    logger.error('Auth middleware error:', error.message);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed',
      traceId: req.traceId,
    });
  }
}

/**
 * Optional auth middleware - attaches user if token exists, but doesn't require it
 * Useful for routes that work both authenticated and anonymous
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Next middleware function
 */
export async function optionalAuth(req, res, next) {
  try {
    const user = await verifyToken(req);
    req.user = {
      userId: user.userId,
      email: user.email,
    };
  } catch (error) {
    // Token is missing or invalid - continue without auth
    req.user = null;
  }

  next();
}

export default {
  requireAuth,
  requireOwnership,
  requireAuthAndOwnership,
  optionalAuth,
};
