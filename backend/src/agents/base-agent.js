import { logger } from '../services/logger.js';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * HTTP status codes and error codes that are retryable
 */
const RETRYABLE_ERRORS = [429, 500, 502, 503, 529, 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'];

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is retryable
 */
function isRetryable(error) {
  // Check HTTP status code
  if (error.status && RETRYABLE_ERRORS.includes(error.status)) {
    return true;
  }

  // Check error code (network errors)
  if (error.code && RETRYABLE_ERRORS.includes(error.code)) {
    return true;
  }

  // Check for rate limit messages
  if (error.message && (
    error.message.includes('rate limit') ||
    error.message.includes('too many requests') ||
    error.message.includes('overloaded')
  )) {
    return true;
  }

  return false;
}

/**
 * Calculate backoff delay with jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
function calculateBackoff(attempt, baseDelay = 1000, maxDelay = 10000) {
  // Exponential backoff: baseDelay * 2^attempt + random jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 100;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep for a given duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * BaseAgent: Abstract base class for all specialized agents
 * Provides lifecycle hooks, error handling, retry logic, and metadata
 *
 * Subclasses implement execute() for their specific task
 */
export class BaseAgent {
  /**
   * Retry configuration - override in subclasses
   * @type {{ maxRetries: number, baseDelayMs?: number, maxDelayMs?: number }}
   */
  static retryConfig = DEFAULT_RETRY_CONFIG;

  constructor(name, description, version = '1.0.0') {
    this.name = name;
    this.description = description;
    this.version = version;
    this.createdAt = new Date().toISOString();
    this.executionCount = 0;
    this.lastExecution = null;
    this.avgExecutionTime = 0;
    this.executionTimes = [];
    this.retryCount = 0;
    this.totalRetries = 0;
  }

  /**
   * Get retry configuration for this agent
   * @returns {{ maxRetries: number, baseDelayMs: number, maxDelayMs: number }}
   */
  getRetryConfig() {
    const config = this.constructor.retryConfig || DEFAULT_RETRY_CONFIG;
    return {
      maxRetries: config.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries,
      baseDelayMs: config.baseDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelayMs,
      maxDelayMs: config.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs,
    };
  }

  /**
   * Get agent metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      createdAt: this.createdAt,
      executionCount: this.executionCount,
      lastExecution: this.lastExecution,
      avgExecutionTime: this.avgExecutionTime,
      totalRetries: this.totalRetries,
    };
  }

  /**
   * Lifecycle hook: Before execution
   * Override in subclasses for custom pre-processing
   */
  async beforeExecute(input, context) {
    logger.debug({ agent: this.name, action: 'start' }, `Agent ${this.name} starting execution`);
    return { input, context };
  }

  /**
   * Abstract: Execute agent logic
   * Must be overridden in subclasses
   */
  async execute(input, context) {
    throw new Error(`execute() not implemented in ${this.name}`);
  }

  /**
   * Lifecycle hook: After execution
   * Override in subclasses for custom post-processing
   */
  async afterExecute(result, context) {
    logger.debug({ agent: this.name, action: 'complete' }, `Agent ${this.name} execution completed`);
    return result;
  }

  /**
   * Lifecycle hook: On error (called after all retries exhausted)
   * Override in subclasses for custom error handling
   */
  async onError(error, input, context) {
    logger.error({ agent: this.name, error, action: 'error' }, `Agent ${this.name} execution error after all retries`);
    throw error;
  }

  /**
   * Execute with retry logic
   * @param {any} input - Processed input
   * @param {Object} context - Processed context
   * @returns {Promise<any>} Execution result
   * @throws {Error} After all retries exhausted
   */
  async _executeWithRetry(input, context) {
    const { maxRetries, baseDelayMs, maxDelayMs } = this.getRetryConfig();
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Execute the agent logic
        const result = await this.execute(input, context);

        // If we had retries, log success
        if (attempt > 0) {
          logger.info({
            agent: this.name,
            attempt,
            totalAttempts: attempt + 1,
          }, `Agent ${this.name} succeeded after ${attempt} retries`);
        }

        return result;
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (attempt < maxRetries && isRetryable(error)) {
          const delay = calculateBackoff(attempt, baseDelayMs, maxDelayMs);

          logger.warn({
            agent: this.name,
            attempt: attempt + 1,
            maxRetries,
            delayMs: Math.round(delay),
            errorCode: error.code || error.status,
            errorMessage: error.message,
          }, `Agent ${this.name} retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);

          this.retryCount++;
          this.totalRetries++;

          // Wait before retrying
          await sleep(delay);
        } else {
          // Not retryable or max retries reached
          if (attempt > 0) {
            logger.error({
              agent: this.name,
              totalAttempts: attempt + 1,
              errorCode: error.code || error.status,
              errorMessage: error.message,
              retryable: isRetryable(error),
            }, `Agent ${this.name} failed after ${attempt + 1} attempts`);
          }
          throw error;
        }
      }
    }

    // Should not reach here, but just in case
    throw lastError;
  }

  /**
   * Main entry point: Runs full lifecycle with retry support
   * Handles timing, error wrapping, retries, and logging
   */
  async run(input, context = {}) {
    const startTime = Date.now();
    this.retryCount = 0;

    try {
      // Before hook
      const processed = await this.beforeExecute(input, context);
      const { input: processedInput, context: processedContext } = processed;

      // Execute with retry logic
      const result = await this._executeWithRetry(processedInput, processedContext);

      // After hook
      const finalResult = await this.afterExecute(result, processedContext);

      // Track metrics
      const executionTime = Date.now() - startTime;
      this._trackExecution(executionTime);

      return {
        success: true,
        result: finalResult,
        executionTime,
        agent: this.name,
        retries: this.retryCount,
      };
    } catch (error) {
      // Error hook (called after all retries exhausted)
      try {
        await this.onError(error, input, context);
      } catch (hookError) {
        // If error hook throws, continue with original error
        logger.warn({ agent: this.name, error: hookError }, `Agent ${this.name} error hook failed`);
      }

      const executionTime = Date.now() - startTime;
      this._trackExecution(executionTime, true);

      return {
        success: false,
        error: error.message,
        errorCode: error.code || error.status,
        executionTime,
        agent: this.name,
        retries: this.retryCount,
      };
    }
  }

  /**
   * Track execution metrics for monitoring
   */
  _trackExecution(executionTime, isError = false) {
    this.executionCount += 1;
    this.lastExecution = new Date().toISOString();
    this.executionTimes.push(executionTime);

    // Keep last 100 execution times for average calculation
    if (this.executionTimes.length > 100) {
      this.executionTimes.shift();
    }

    // Calculate rolling average
    this.avgExecutionTime =
      this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length;

    // Log agent execution metrics
    logger.agentExecution({
      agentName: this.name,
      action: isError ? 'failed' : 'completed',
      durationMs: executionTime,
      success: !isError,
      metadata: {
        executionCount: this.executionCount,
        avgExecutionTime: Math.round(this.avgExecutionTime),
        retries: this.retryCount,
        totalRetries: this.totalRetries,
      },
    });
  }

  /**
   * Utility: Validate input schema
   * Subclasses can call this for basic validation
   */
  validateInput(input, requiredFields = []) {
    if (!input || typeof input !== 'object') {
      throw new Error(`Input must be an object, got ${typeof input}`);
    }

    const missing = requiredFields.filter(field => !(field in input));
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    return true;
  }

  /**
   * Utility: Get execution stats
   */
  getStats() {
    return {
      name: this.name,
      executions: this.executionCount,
      avgTime: this.avgExecutionTime.toFixed(0) + 'ms',
      lastRun: this.lastExecution,
      minTime: this.executionTimes.length > 0 ? Math.min(...this.executionTimes) : 0,
      maxTime: this.executionTimes.length > 0 ? Math.max(...this.executionTimes) : 0,
      totalRetries: this.totalRetries,
    };
  }
}

// Export utilities for testing
export { isRetryable, calculateBackoff, RETRYABLE_ERRORS };

export default BaseAgent;
