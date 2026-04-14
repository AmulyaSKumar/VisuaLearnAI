/**
 * Agent Registry
 * Central registry for all specialized agents
 * Manages agent lifecycle, discovery, orchestration, and circuit breaking
 */

import { logger } from '../services/logger.js';
import { circuitBreakerRegistry, CircuitState } from '../services/circuitBreaker.js';

/**
 * Circuit breaker configuration per agent type
 */
const AGENT_CIRCUIT_CONFIG = {
  planner: { failureThreshold: 5, timeout: 60000 },
  'visual-intelligence': { failureThreshold: 3, timeout: 45000 },
  'image-generator': { failureThreshold: 3, timeout: 45000 },
  'fact-checker': { failureThreshold: 5, timeout: 30000 },
  personalization: { failureThreshold: 5, timeout: 30000 },
  'adaptive-learning': { failureThreshold: 5, timeout: 30000 },
  default: { failureThreshold: 5, timeout: 60000 },
};

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitOpenError extends Error {
  constructor(agentName, retryAfter) {
    super(`Service temporarily unavailable: ${agentName}`);
    this.name = 'CircuitOpenError';
    this.agentName = agentName;
    this.retryAfter = retryAfter;
    this.statusCode = 503;
  }
}

class AgentRegistry {
  constructor() {
    this.agents = new Map();
    this.initialized = false;
  }

  /**
   * Get circuit config for an agent
   * @param {string} agentName - Agent name
   * @returns {Object} Circuit breaker configuration
   */
  _getCircuitConfig(agentName) {
    const normalizedName = agentName.toLowerCase();
    return AGENT_CIRCUIT_CONFIG[normalizedName] || AGENT_CIRCUIT_CONFIG.default;
  }

  /**
   * Register an agent in the registry
   */
  registerAgent(agent) {
    if (!agent || !agent.name) {
      throw new Error('Agent must have a name property');
    }

    if (this.agents.has(agent.name)) {
      logger.warn({ agent: agent.name }, `Agent '${agent.name}' already registered, updating...`);
    }

    this.agents.set(agent.name, agent);

    // Initialize circuit breaker for this agent
    const circuitConfig = this._getCircuitConfig(agent.name);
    circuitBreakerRegistry.getBreaker(agent.name, circuitConfig);

    logger.info({ agent: agent.name }, `Registered agent: ${agent.name}`);
    return agent;
  }

  /**
   * Get agent by name
   */
  getAgent(name) {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent '${name}' not found in registry`);
    }
    return agent;
  }

  /**
   * Check if agent exists
   */
  hasAgent(name) {
    return this.agents.has(name);
  }

  /**
   * List all registered agents
   */
  listAgents() {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.name,
      description: agent.description,
      version: agent.version,
    }));
  }

  /**
   * Get detailed stats for all agents
   */
  getStats() {
    const stats = {};
    this.agents.forEach((agent, name) => {
      const agentStats = agent.getStats();
      const circuitStatus = circuitBreakerRegistry.getBreaker(name).getStatus();
      stats[name] = {
        ...agentStats,
        circuitBreaker: {
          state: circuitStatus.state,
          failureCount: circuitStatus.failureCount,
          retryAfter: circuitStatus.retryAfter,
        },
      };
    });
    return stats;
  }

  /**
   * Check if an agent can execute (circuit breaker check)
   * @param {string} name - Agent name
   * @returns {boolean} True if agent can execute
   */
  canExecute(name) {
    const breaker = circuitBreakerRegistry.getBreaker(name);
    return breaker.canExecute();
  }

  /**
   * Execute an agent by name with circuit breaker protection
   * @throws {CircuitOpenError} If circuit breaker is open
   */
  async runAgent(name, input, context = {}) {
    const agent = this.getAgent(name);
    const breaker = circuitBreakerRegistry.getBreaker(name);

    // Check circuit breaker
    if (!breaker.canExecute()) {
      const retryAfter = Math.ceil(breaker.getRetryAfter() / 1000);
      logger.warn({
        agent: name,
        circuitState: breaker.state,
        retryAfter,
      }, `Circuit breaker OPEN for agent ${name}, rejecting request`);

      throw new CircuitOpenError(name, retryAfter);
    }

    try {
      const result = await agent.run(input, context);

      // Record success/failure based on result
      if (result.success) {
        breaker.recordSuccess();
      } else {
        breaker.recordFailure();
      }

      return result;
    } catch (error) {
      // Record failure on exception
      breaker.recordFailure();
      throw error;
    }
  }

  /**
   * Execute an agent with graceful fallback
   * @param {string} name - Agent name
   * @param {any} input - Input data
   * @param {Object} context - Execution context
   * @param {any} fallbackResult - Result to return if agent fails
   * @returns {Object} Agent result or fallback
   */
  async runAgentWithFallback(name, input, context = {}, fallbackResult = null) {
    try {
      const result = await this.runAgent(name, input, context);
      return {
        ...result,
        degraded: false,
      };
    } catch (error) {
      logger.warn({
        agent: name,
        error: error.message,
        isCircuitOpen: error instanceof CircuitOpenError,
      }, `Agent ${name} failed, using fallback`);

      return {
        success: true, // Graceful degradation is "success" from user perspective
        result: fallbackResult,
        degraded: true,
        degradedAgent: name,
        degradedReason: error instanceof CircuitOpenError
          ? 'circuit_open'
          : 'agent_error',
        error: error.message,
        agent: name,
      };
    }
  }

  /**
   * Execute agents in sequence (await each)
   */
  async runSequential(agentNames, input, context = {}) {
    const results = [];
    let currentInput = input;
    const degradedAgents = [];

    for (const agentName of agentNames) {
      try {
        const result = await this.runAgent(agentName, currentInput, context);
        results.push(result);

        if (!result.success) {
          logger.error({ agent: agentName }, `Sequential execution stopped at ${agentName}`);
          break;
        }

        // Use agent output as input for next agent (if applicable)
        currentInput = result.result;
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          degradedAgents.push(agentName);
          results.push({
            success: false,
            agent: agentName,
            error: error.message,
            circuitOpen: true,
            retryAfter: error.retryAfter,
          });
        } else {
          results.push({
            success: false,
            agent: agentName,
            error: error.message,
          });
        }
        break;
      }
    }

    return {
      agents: agentNames,
      results,
      success: results.every(r => r.success),
      degraded: degradedAgents.length > 0,
      degradedAgents,
    };
  }

  /**
   * Execute agents in parallel
   */
  async runParallel(agentNames, input, context = {}) {
    const promises = agentNames.map(name =>
      this.runAgent(name, input, context).catch(error => ({
        success: false,
        agent: name,
        error: error.message,
        circuitOpen: error instanceof CircuitOpenError,
        retryAfter: error instanceof CircuitOpenError ? error.retryAfter : undefined,
      }))
    );

    const results = await Promise.all(promises);
    const degradedAgents = results
      .filter(r => r.circuitOpen)
      .map(r => r.agent);

    return {
      agents: agentNames,
      results: results.map((r, i) => ({
        agent: agentNames[i],
        ...r,
      })),
      success: results.every(r => r.success),
      degraded: degradedAgents.length > 0,
      degradedAgents,
    };
  }

  /**
   * Get circuit breaker status for all agents
   * @returns {Object[]} Array of circuit breaker statuses
   */
  getCircuitBreakerStatus() {
    return circuitBreakerRegistry.getAllStatus();
  }

  /**
   * Reset circuit breaker for an agent
   * @param {string} name - Agent name
   */
  resetCircuitBreaker(name) {
    circuitBreakerRegistry.reset(name);
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers() {
    circuitBreakerRegistry.resetAll();
  }

  /**
   * Clear all agents (for testing)
   */
  clear() {
    this.agents.clear();
    this.initialized = false;
    circuitBreakerRegistry.resetAll();
  }

  /**
   * Get registry summary
   */
  summary() {
    return {
      totalAgents: this.agents.size,
      agents: this.listAgents(),
      stats: this.getStats(),
      circuitBreakers: this.getCircuitBreakerStatus(),
    };
  }
}

// Export singleton instance
export const agentRegistry = new AgentRegistry();

// Export class and error for extending/testing
export { AgentRegistry };

export default agentRegistry;
