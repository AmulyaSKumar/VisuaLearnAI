/**
 * Trace Middleware
 * Adds trace IDs and request IDs for distributed tracing
 * @module middleware/traceMiddleware
 */

import { randomUUID } from 'crypto';

/**
 * Header names for trace propagation
 */
const TRACE_ID_HEADER = 'x-trace-id';
const REQUEST_ID_HEADER = 'x-request-id';
const PARENT_SPAN_HEADER = 'x-parent-span-id';

/**
 * Generate a short unique ID
 * @returns {string} Short ID
 */
function shortId() {
  return randomUUID().split('-')[0];
}

/**
 * Trace middleware
 * Attaches traceId and requestId to each request
 * Propagates trace context from incoming headers
 */
export function traceMiddleware(req, res, next) {
  // Extract or generate trace ID (for distributed tracing across services)
  const traceId = req.headers[TRACE_ID_HEADER] || randomUUID();

  // Generate unique request ID for this request
  const requestId = req.headers[REQUEST_ID_HEADER] || `${shortId()}-${Date.now()}`;

  // Extract parent span if present
  const parentSpanId = req.headers[PARENT_SPAN_HEADER];

  // Attach to request object
  req.traceId = traceId;
  req.requestId = requestId;
  req.parentSpanId = parentSpanId;

  // Create span ID for this request
  req.spanId = shortId();

  // Add trace context to response headers
  res.setHeader(TRACE_ID_HEADER, traceId);
  res.setHeader(REQUEST_ID_HEADER, requestId);
  res.setHeader('x-span-id', req.spanId);

  // Track request timing
  req.startTime = Date.now();

  // Add timing header on response finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    // Note: Headers may already be sent, this is best effort
    try {
      if (!res.headersSent) {
        res.setHeader('x-response-time', `${duration}ms`);
      }
    } catch {
      // Ignore if headers already sent
    }
  });

  next();
}

/**
 * Create trace context object for downstream services
 * @param {Object} req - Express request
 * @returns {Object} Trace context headers
 */
export function getTraceContext(req) {
  return {
    [TRACE_ID_HEADER]: req.traceId,
    [REQUEST_ID_HEADER]: req.requestId,
    [PARENT_SPAN_HEADER]: req.spanId,
  };
}

/**
 * Create a child span context
 * @param {Object} parentContext - Parent trace context
 * @param {string} spanName - Name for the child span
 * @returns {Object} Child span context
 */
export function createChildSpan(parentContext, spanName) {
  return {
    traceId: parentContext.traceId || parentContext[TRACE_ID_HEADER],
    parentSpanId: parentContext.spanId || parentContext[PARENT_SPAN_HEADER],
    spanId: shortId(),
    spanName,
    startTime: Date.now(),
  };
}

/**
 * Timing middleware for specific routes
 * Records timing metrics for route patterns
 */
export function timingMiddleware(routeName) {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      // Could send to metrics service here
      if (req.log) {
        req.log.debug({
          type: 'route_timing',
          route: routeName,
          method: req.method,
          statusCode: res.statusCode,
          durationMs: duration,
        }, `Route timing: ${routeName}`);
      }
    });

    next();
  };
}

export default traceMiddleware;
