/**
 * Structured Logger Service
 * Uses Pino for high-performance structured logging
 * Integrates with Sentry for error tracking
 * @module services/logger
 */

import pino from 'pino';
import * as Sentry from '@sentry/node';

/**
 * Log level from environment
 */
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Check if running in production
 */
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Initialize Sentry if DSN is configured
 */
const sentryDsn = process.env.SENTRY_DSN;
let sentryInitialized = false;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (!isProduction && !process.env.SENTRY_DEV_ENABLED) {
        return null;
      }
      return event;
    },
  });
  sentryInitialized = true;
}

/**
 * Custom log serializers
 */
const serializers = {
  req: (req) => ({
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    userId: req.user?.userId,
    traceId: req.traceId,
  }),
  res: (res) => ({
    statusCode: res.statusCode,
  }),
  err: pino.stdSerializers.err,
  error: (err) => {
    if (err instanceof Error) {
      return {
        type: err.constructor.name,
        message: err.message,
        stack: err.stack,
        code: err.code,
        statusCode: err.statusCode,
      };
    }
    return err;
  },
};

/**
 * Pino transport configuration
 */
const transport = isProduction
  ? undefined // Use default JSON output in production
  : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    };

/**
 * Create base Pino logger
 */
const baseLogger = pino({
  level: LOG_LEVEL,
  serializers,
  transport,
  base: {
    service: 'visualearn-backend',
    version: process.env.APP_VERSION || '1.0.0',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'apiKey',
      'api_key',
      'secret',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
    }),
  },
});

/**
 * Extended logger with Sentry integration
 */
class Logger {
  constructor(pinoInstance) {
    this.pino = pinoInstance;
    this._context = {};
  }

  /**
   * Create child logger with context
   * @param {Object} context - Additional context
   * @returns {Logger} Child logger
   */
  child(context) {
    const childPino = this.pino.child(context);
    const childLogger = new Logger(childPino);
    childLogger._context = { ...this._context, ...context };
    return childLogger;
  }

  /**
   * Set Sentry context
   * @param {Object} context - Context data
   */
  _setSentryContext(context) {
    if (!sentryInitialized) return;

    if (context.userId) {
      Sentry.setUser({ id: context.userId });
    }
    if (context.traceId) {
      Sentry.setTag('traceId', context.traceId);
    }
    if (context.requestId) {
      Sentry.setTag('requestId', context.requestId);
    }
  }

  /**
   * Log trace level
   */
  trace(objOrMsg, msg) {
    if (typeof objOrMsg === 'string') {
      this.pino.trace(objOrMsg);
    } else {
      this.pino.trace(objOrMsg, msg);
    }
  }

  /**
   * Log debug level
   */
  debug(objOrMsg, msg) {
    if (typeof objOrMsg === 'string') {
      this.pino.debug(objOrMsg);
    } else {
      this.pino.debug(objOrMsg, msg);
    }
  }

  /**
   * Log info level
   */
  info(objOrMsg, msg) {
    if (typeof objOrMsg === 'string') {
      this.pino.info(objOrMsg);
    } else {
      this.pino.info(objOrMsg, msg);
    }
  }

  /**
   * Log warn level
   */
  warn(objOrMsg, msg) {
    if (typeof objOrMsg === 'string') {
      this.pino.warn(objOrMsg);
      if (sentryInitialized) {
        Sentry.addBreadcrumb({
          category: 'warning',
          message: objOrMsg,
          level: 'warning',
        });
      }
    } else {
      this.pino.warn(objOrMsg, msg);
      if (sentryInitialized) {
        Sentry.addBreadcrumb({
          category: 'warning',
          message: msg || JSON.stringify(objOrMsg),
          level: 'warning',
          data: objOrMsg,
        });
      }
    }
  }

  /**
   * Log error level and report to Sentry
   */
  error(objOrMsg, msg) {
    if (typeof objOrMsg === 'string') {
      this.pino.error(objOrMsg);
      this._reportToSentry(new Error(objOrMsg));
    } else {
      this.pino.error(objOrMsg, msg);

      // Extract error from object
      const err = objOrMsg.error || objOrMsg.err;
      if (err instanceof Error) {
        this._reportToSentry(err, objOrMsg);
      } else if (msg) {
        this._reportToSentry(new Error(msg), objOrMsg);
      }
    }
  }

  /**
   * Log fatal level and report to Sentry
   */
  fatal(objOrMsg, msg) {
    if (typeof objOrMsg === 'string') {
      this.pino.fatal(objOrMsg);
      this._reportToSentry(new Error(objOrMsg), { fatal: true });
    } else {
      this.pino.fatal(objOrMsg, msg);

      const err = objOrMsg.error || objOrMsg.err || new Error(msg);
      this._reportToSentry(err, { ...objOrMsg, fatal: true });
    }
  }

  /**
   * Report error to Sentry
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   */
  _reportToSentry(error, context = {}) {
    if (!sentryInitialized) return;

    this._setSentryContext({ ...this._context, ...context });

    Sentry.withScope((scope) => {
      // Add extra context
      if (context) {
        const { error: _, err: __, ...extra } = context;
        scope.setExtras(extra);
      }

      // Set level
      scope.setLevel(context.fatal ? 'fatal' : 'error');

      // Capture exception
      Sentry.captureException(error);
    });
  }

  /**
   * Log LLM API call
   * @param {Object} params - Call parameters
   */
  llmCall(params) {
    const {
      provider,
      model,
      inputTokens,
      outputTokens,
      durationMs,
      success,
      error,
      userId,
      requestId,
    } = params;

    const logData = {
      type: 'llm_call',
      provider,
      model,
      inputTokens,
      outputTokens,
      totalTokens: (inputTokens || 0) + (outputTokens || 0),
      durationMs,
      success,
      userId,
      requestId,
    };

    if (success) {
      this.info(logData, `LLM call: ${provider}/${model}`);
    } else {
      this.error({ ...logData, error }, `LLM call failed: ${provider}/${model}`);
    }

    // Track in Sentry as breadcrumb
    if (sentryInitialized) {
      Sentry.addBreadcrumb({
        category: 'llm',
        message: `${provider}/${model}`,
        level: success ? 'info' : 'error',
        data: logData,
      });
    }
  }

  /**
   * Log agent execution
   * @param {Object} params - Execution parameters
   */
  agentExecution(params) {
    const {
      agentName,
      action,
      durationMs,
      success,
      error,
      userId,
      metadata,
    } = params;

    const logData = {
      type: 'agent_execution',
      agentName,
      action,
      durationMs,
      success,
      userId,
      ...metadata,
    };

    if (success) {
      this.info(logData, `Agent ${action}: ${agentName}`);
    } else {
      this.error({ ...logData, error }, `Agent ${action} failed: ${agentName}`);
    }
  }

  /**
   * Start a performance span
   * @param {string} name - Span name
   * @param {Object} data - Span data
   * @returns {Object} Span object with finish method
   */
  startSpan(name, data = {}) {
    const startTime = Date.now();

    return {
      name,
      data,
      startTime,
      setData: (key, value) => {
        data[key] = value;
      },
      finish: (status = 'ok') => {
        const duration = Date.now() - startTime;
        this.debug({
          type: 'span',
          span: name,
          durationMs: duration,
          status,
          ...data,
        }, `Span completed: ${name}`);

        return duration;
      },
    };
  }
}

/**
 * Create main logger instance
 */
export const logger = new Logger(baseLogger);

/**
 * Express request logger middleware creator
 * @returns {Function} Express middleware
 */
export function createRequestLogger() {
  return (req, res, next) => {
    const start = Date.now();

    // Attach logger to request
    req.log = logger.child({
      traceId: req.traceId,
      requestId: req.requestId,
    });

    // Log request start
    req.log.info({ req }, `${req.method} ${req.path}`);

    // Log response on finish
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        req,
        res,
        durationMs: duration,
        userId: req.user?.userId,
      };

      if (res.statusCode >= 500) {
        req.log.error(logData, `${req.method} ${req.path} - ${res.statusCode}`);
      } else if (res.statusCode >= 400) {
        req.log.warn(logData, `${req.method} ${req.path} - ${res.statusCode}`);
      } else {
        req.log.info(logData, `${req.method} ${req.path} - ${res.statusCode}`);
      }
    });

    next();
  };
}

/**
 * Get Sentry error handler middleware
 * @returns {Function} Sentry error handler
 */
export function getSentryErrorHandler() {
  if (!sentryInitialized) {
    return (err, req, res, next) => next(err);
  }
  return Sentry.expressErrorHandler();
}

/**
 * Get Sentry request handler middleware
 * @returns {Function} Sentry request handler
 */
export function getSentryRequestHandler() {
  if (!sentryInitialized) {
    return (req, res, next) => next();
  }
  return Sentry.expressRequestHandler();
}

/**
 * Flush Sentry events (call before process exit)
 */
export async function flushSentry(timeout = 2000) {
  if (sentryInitialized) {
    await Sentry.close(timeout);
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized() {
  return sentryInitialized;
}

export default logger;
