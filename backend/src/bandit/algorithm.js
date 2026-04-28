/**
 * LinUCB Algorithm Implementation
 * Contextual bandit with Upper Confidence Bound exploration
 */

import { CONTEXT_VERSION, CONTEXT_DIM, normalizeContextVector } from './context.js';
import { logger } from '../utils/logger.js';

// Available actions
export const ACTIONS = ['visual_widget', 'guided_steps', 'quiz_check', 'text_explanation'];

// Failsafe action when bandit fails
export const FAILSAFE_ACTION = 'guided_steps';

// Configuration
const CONFIG = {
  alpha: parseFloat(process.env.BANDIT_LINUCB_ALPHA || '1.0'), // Exploration parameter
  regularization: 1e-6, // For matrix regularization
};

/**
 * Create identity matrix of size n×n
 */
function identityMatrix(n) {
  const matrix = [];
  for (let i = 0; i < n; i++) {
    const row = new Array(n).fill(0);
    row[i] = 1;
    matrix.push(row);
  }
  return matrix;
}

/**
 * Create zero vector of size n
 */
function zeroVector(n) {
  return new Array(n).fill(0);
}

/**
 * Matrix addition
 */
function matrixAdd(A, B) {
  return A.map((row, i) => row.map((val, j) => val + B[i][j]));
}

/**
 * Outer product of two vectors: x * x^T
 */
function outerProduct(x, y) {
  return x.map(xi => y.map(yj => xi * yj));
}

/**
 * Vector addition
 */
function vectorAdd(a, b) {
  return a.map((val, i) => val + b[i]);
}

/**
 * Scalar multiplication of vector
 */
function vectorScale(v, scalar) {
  return v.map(val => val * scalar);
}

/**
 * Dot product of two vectors
 */
function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

/**
 * Matrix-vector multiplication
 */
function matrixVectorMultiply(M, v) {
  return M.map(row => dotProduct(row, v));
}

/**
 * Matrix inversion using Gaussian elimination
 * For small matrices (4×4), this is efficient enough
 */
function invertMatrix(M) {
  const n = M.length;
  const augmented = M.map((row, i) => {
    const identity = new Array(n).fill(0);
    identity[i] = 1;
    return [...row, ...identity];
  });

  // Forward elimination
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }

    // Swap rows
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    // Check for singular matrix
    if (Math.abs(augmented[col][col]) < 1e-10) {
      throw new Error('Matrix is singular or nearly singular');
    }

    // Scale pivot row
    const pivot = augmented[col][col];
    for (let j = 0; j < 2 * n; j++) {
      augmented[col][j] /= pivot;
    }

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = augmented[row][col];
        for (let j = 0; j < 2 * n; j++) {
          augmented[row][j] -= factor * augmented[col][j];
        }
      }
    }
  }

  // Extract inverse
  return augmented.map(row => row.slice(n));
}

/**
 * Matrix inversion with regularization (adds small identity for stability)
 */
function invertMatrixRegularized(M, lambda = 1e-6) {
  const n = M.length;
  const regularized = M.map((row, i) =>
    row.map((val, j) => val + (i === j ? lambda : 0))
  );
  return invertMatrix(regularized);
}

/**
 * Serialize matrix for storage
 */
export function serializeMatrix(M) {
  return JSON.stringify(M);
}

/**
 * Deserialize matrix from storage
 */
export function deserializeMatrix(str) {
  return JSON.parse(str);
}

/**
 * Serialize vector for storage
 */
export function serializeVector(v) {
  return JSON.stringify(v);
}

/**
 * Deserialize vector from storage
 */
export function deserializeVector(str) {
  return JSON.parse(str);
}

/**
 * LinUCB Bandit Class
 * Implements contextual bandit with linear upper confidence bound
 */
export class LinUCBBandit {
  constructor(actions = ACTIONS, contextDim = CONTEXT_DIM, alpha = CONFIG.alpha) {
    this.actions = actions;
    this.d = contextDim;
    this.alpha = alpha;
    this.parameters = {};
    this.initialized = false;
  }

  /**
   * Initialize or load parameters from store
   */
  async initialize(store) {
    for (const action of this.actions) {
      try {
        const saved = await store.loadLinUCBParameters(action);

        if (saved && saved.version === CONTEXT_VERSION) {
          this.parameters[action] = {
            A: saved.A,
            b: saved.b,
            invA: null, // Will be calculated on demand
            invAStale: true,
            updateCount: saved.updateCount || 0,
          };
          logger.debug({ action, updateCount: saved.updateCount }, 'LinUCB params loaded');
        } else {
          // Initialize fresh
          this.parameters[action] = {
            A: identityMatrix(this.d),
            b: zeroVector(this.d),
            invA: identityMatrix(this.d),
            invAStale: false,
            updateCount: 0,
          };
          logger.debug({ action }, 'LinUCB params initialized fresh');
        }
      } catch (error) {
        logger.warn({ error, action }, 'LinUCB load failed - initializing fresh');
        this.parameters[action] = {
          A: identityMatrix(this.d),
          b: zeroVector(this.d),
          invA: identityMatrix(this.d),
          invAStale: false,
          updateCount: 0,
        };
      }
    }
    this.initialized = true;
    logger.info({ actions: this.actions, dim: this.d, alpha: this.alpha }, 'LinUCB bandit initialized');
  }

  /**
   * Calculate inverse of A matrix for an action (lazy, cached)
   */
  _getInverse(action) {
    const params = this.parameters[action];

    if (params.invAStale || !params.invA) {
      try {
        params.invA = invertMatrix(params.A);
        params.invAStale = false;
      } catch (e) {
        logger.warn({ action, error: e.message }, 'Matrix inversion failed, using regularized inverse');
        params.invA = invertMatrixRegularized(params.A, CONFIG.regularization);
        params.invAStale = false;
      }
    }

    return params.invA;
  }

  /**
   * Select action using LinUCB
   * @param {number[]} contextVector - Numeric context vector
   * @returns {Object} Decision with scores
   */
  selectAction(contextVector) {
    if (!this.initialized) {
      throw new Error('LinUCB not initialized - call initialize() first');
    }

    // Normalize context for better numerical stability
    const x = normalizeContextVector(contextVector);

    let bestAction = null;
    let bestScore = -Infinity;
    const scores = {};

    for (const action of this.actions) {
      const params = this.parameters[action];
      const invA = this._getInverse(action);

      // θ_a = A_a^{-1} b_a (estimated parameters)
      const theta = matrixVectorMultiply(invA, params.b);

      // UCB score = θ^T x + α * sqrt(x^T A^{-1} x)
      const exploitation = dotProduct(theta, x);
      const uncertainty = Math.sqrt(dotProduct(x, matrixVectorMultiply(invA, x)));
      const exploration = this.alpha * uncertainty;
      const score = exploitation + exploration;

      scores[action] = {
        exploitation,
        exploration,
        uncertainty,
        total: score,
        updateCount: params.updateCount,
      };

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    // Determine source (exploit if exploitation dominates, else explore)
    const bestScores = scores[bestAction];
    const source = bestScores.exploitation > bestScores.exploration ? 'exploit' : 'explore';

    return {
      selectedAction: bestAction,
      scores,
      source,
      alpha: this.alpha,
    };
  }

  /**
   * Update parameters after receiving reward
   * @param {string} action - Action that was taken
   * @param {number[]} contextVector - Context when action was taken
   * @param {number} reward - Received reward [0, 1]
   * @param {Object} store - Persistence store
   */
  async update(action, contextVector, reward, store) {
    if (!this.initialized) {
      throw new Error('LinUCB not initialized');
    }

    if (!this.parameters[action]) {
      logger.warn({ action }, 'Unknown action, skipping update');
      return;
    }

    const params = this.parameters[action];
    const x = normalizeContextVector(contextVector);

    // A_a = A_a + x x^T (outer product update)
    const xxT = outerProduct(x, x);
    params.A = matrixAdd(params.A, xxT);

    // b_a = b_a + r x
    params.b = vectorAdd(params.b, vectorScale(x, reward));

    // Mark inverse as stale
    params.invAStale = true;
    params.updateCount++;

    // Persist atomically
    try {
      await store.saveLinUCBParameters(action, {
        A: params.A,
        b: params.b,
        updateCount: params.updateCount,
        version: CONTEXT_VERSION,
      });
    } catch (error) {
      // Log but don't crash - in-memory params are still valid
      logger.error({ error, action }, 'LinUCB persistence failed');
    }

    logger.debug({
      action,
      reward,
      updateCount: params.updateCount,
    }, 'LinUCB parameters updated');
  }

  /**
   * Get total sample count for cold start detection
   */
  getTotalSampleCount() {
    return Object.values(this.parameters).reduce((sum, p) => sum + p.updateCount, 0);
  }

  /**
   * Get sample count for specific action
   */
  getActionSampleCount(action) {
    return this.parameters[action]?.updateCount || 0;
  }

  /**
   * Get statistics for monitoring
   */
  getStats() {
    const stats = {};
    for (const action of this.actions) {
      const params = this.parameters[action];
      stats[action] = {
        updateCount: params.updateCount,
        isInitialized: params.updateCount > 0,
      };
    }
    return {
      totalSamples: this.getTotalSampleCount(),
      byAction: stats,
      alpha: this.alpha,
      dimension: this.d,
    };
  }
}

/**
 * Cold start configuration
 */
export const COLD_START_CONFIG = {
  explorationBoost: 0.2,        // Extra exploration for cold start
  minSamplesForExploit: 10,     // Minimum samples before pure exploit
  initialPriors: {
    visual_widget: 0.5,
    guided_steps: 0.5,
    quiz_check: 0.5,
    text_explanation: 0.5,
  },
};

/**
 * Select action with cold start handling
 * Uses boosted exploration when samples are low
 */
export function selectActionWithColdStart(bandit, contextVector, userId = null) {
  const totalSamples = bandit.getTotalSampleCount();

  if (totalSamples < COLD_START_CONFIG.minSamplesForExploit) {
    // Boost alpha for more exploration during cold start
    const originalAlpha = bandit.alpha;
    bandit.alpha = originalAlpha + COLD_START_CONFIG.explorationBoost;
    const decision = bandit.selectAction(contextVector);
    bandit.alpha = originalAlpha; // Restore

    return {
      ...decision,
      source: 'cold_start_explore',
      coldStart: true,
      totalSamples,
    };
  }

  return {
    ...bandit.selectAction(contextVector),
    coldStart: false,
    totalSamples,
  };
}

/**
 * Safe action selection with failsafe
 */
export function selectActionSafe(bandit, contextVector) {
  try {
    if (!bandit.initialized) {
      logger.warn('Bandit not initialized, using failsafe');
      return { selectedAction: FAILSAFE_ACTION, source: 'failsafe', error: 'not_initialized' };
    }

    const decision = selectActionWithColdStart(bandit, contextVector);

    if (!decision || !ACTIONS.includes(decision.selectedAction)) {
      logger.warn({ decision }, 'Bandit produced invalid output, using failsafe');
      return { selectedAction: FAILSAFE_ACTION, source: 'failsafe', error: 'invalid_action' };
    }

    return decision;
  } catch (error) {
    logger.error({ error }, 'Bandit selection failed, using failsafe');
    return { selectedAction: FAILSAFE_ACTION, source: 'failsafe', error: error.message };
  }
}
