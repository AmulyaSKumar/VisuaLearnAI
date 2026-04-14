/**
 * Circuit Breaker Service
 * Prevents cascading failures by temporarily disabling failing services
 * @module services/circuitBreaker
 */

import { logger } from './logger.js';

/**
 * Circuit breaker states
 */
export const CircuitState = {
  CLOSED: 'CLOSED',     // Normal operation, requests pass through
  OPEN: 'OPEN',         // Circuit tripped, requests fail immediately
  HALF_OPEN: 'HALF_OPEN', // Testing if service recovered
};

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG = {
  failureThreshold: 5,      // Number of failures before opening circuit
  successThreshold: 2,      // Number of successes in half-open to close circuit
  timeout: 60000,           // Time in ms before attempting to close circuit
  volumeThreshold: 5,       // Minimum requests before circuit can open
};

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    this.requestCount = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
  }

  /**
   * Check if a request can be executed
   * @returns {boolean} True if request can proceed
   */
  canExecute() {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if timeout has elapsed
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.config.timeout) {
        // Transition to half-open
        this._transitionTo(CircuitState.HALF_OPEN);
        return true;
      }
      return false;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      // Allow limited requests in half-open state
      return true;
    }

    return false;
  }

  /**
   * Get time until circuit can be retried (for OPEN state)
   * @returns {number} Milliseconds until retry, 0 if not OPEN
   */
  getRetryAfter() {
    if (this.state !== CircuitState.OPEN || !this.lastFailureTime) {
      return 0;
    }
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.config.timeout - elapsed);
  }

  /**
   * Record a successful execution
   */
  recordSuccess() {
    this.requestCount++;
    this.totalSuccesses++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        // Service recovered, close circuit
        this._transitionTo(CircuitState.CLOSED);
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed execution
   */
  recordFailure() {
    this.requestCount++;
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery test, reopen circuit
      this._transitionTo(CircuitState.OPEN);
      this.successCount = 0;
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      if (
        this.requestCount >= this.config.volumeThreshold &&
        this.failureCount >= this.config.failureThreshold
      ) {
        this._transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Transition to a new state
   * @param {string} newState - Target state
   */
  _transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    logger.info({
      circuitBreaker: this.name,
      oldState,
      newState,
      failureCount: this.failureCount,
      successCount: this.successCount,
    }, `Circuit breaker ${this.name}: ${oldState} → ${newState}`);
  }

  /**
   * Force reset the circuit breaker
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    logger.info({ circuitBreaker: this.name }, `Circuit breaker ${this.name} manually reset`);
  }

  /**
   * Get circuit breaker status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      retryAfter: this.getRetryAfter(),
      config: this.config,
    };
  }
}

/**
 * Circuit Breaker Registry
 * Manages circuit breakers for all agents
 */
class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create a circuit breaker for an agent
   * @param {string} agentName - Agent name
   * @param {Object} config - Optional configuration override
   * @returns {CircuitBreaker} Circuit breaker instance
   */
  getBreaker(agentName, config = {}) {
    if (!this.breakers.has(agentName)) {
      this.breakers.set(agentName, new CircuitBreaker(agentName, config));
    }
    return this.breakers.get(agentName);
  }

  /**
   * Check if an agent can execute
   * @param {string} agentName - Agent name
   * @returns {boolean} True if agent can execute
   */
  canExecute(agentName) {
    const breaker = this.breakers.get(agentName);
    if (!breaker) return true; // No breaker means no restrictions
    return breaker.canExecute();
  }

  /**
   * Record success for an agent
   * @param {string} agentName - Agent name
   */
  recordSuccess(agentName) {
    const breaker = this.breakers.get(agentName);
    if (breaker) {
      breaker.recordSuccess();
    }
  }

  /**
   * Record failure for an agent
   * @param {string} agentName - Agent name
   */
  recordFailure(agentName) {
    const breaker = this.breakers.get(agentName);
    if (breaker) {
      breaker.recordFailure();
    }
  }

  /**
   * Get status of all circuit breakers
   * @returns {Object[]} Array of circuit breaker statuses
   */
  getAllStatus() {
    const statuses = [];
    for (const [name, breaker] of this.breakers) {
      statuses.push(breaker.getStatus());
    }
    return statuses;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  /**
   * Reset a specific circuit breaker
   * @param {string} agentName - Agent name
   */
  reset(agentName) {
    const breaker = this.breakers.get(agentName);
    if (breaker) {
      breaker.reset();
    }
  }
}

// Export singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// Export classes for testing
export { CircuitBreaker, CircuitBreakerRegistry };

export default circuitBreakerRegistry;
