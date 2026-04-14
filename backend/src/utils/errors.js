/**
 * Custom Error Classes
 * @module utils/errors
 */

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(message, status = 500, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'AppError';
  }
}

/**
 * Authentication error (401)
 */
export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message = 'Invalid input') {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500, 'DB_ERROR');
    this.name = 'DatabaseError';
  }
}

/**
 * AI Service error (502)
 */
export class AIServiceError extends AppError {
  constructor(message = 'AI service unavailable') {
    super(message, 502, 'AI_SERVICE_ERROR');
    this.name = 'AIServiceError';
  }
}

export default {
  AppError,
  AuthError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  AIServiceError,
};
