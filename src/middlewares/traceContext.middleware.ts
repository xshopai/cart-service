/**
 * Trace Context Middleware
 * Extracts and propagates W3C Trace Context headers
 */
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request to include trace properties
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      spanId?: string;
      parentSpanId?: string;
    }
  }
}

/**
 * Extract trace context from headers and attach to request
 */
export const traceContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Extract from W3C traceparent header
  const traceparent = req.headers['traceparent'] as string;

  if (traceparent) {
    // Format: version-traceId-parentSpanId-flags
    const parts = traceparent.split('-');
    if (parts.length >= 4) {
      req.traceId = parts[1];
      req.parentSpanId = parts[2];
    }
  }

  // Fallback to custom headers or generate new
  req.traceId = req.traceId || (req.headers['x-trace-id'] as string) || uuidv4().replace(/-/g, '');
  req.spanId = uuidv4().replace(/-/g, '').substring(0, 16);

  // Set response headers for propagation
  res.setHeader('x-trace-id', req.traceId);
  res.setHeader('x-span-id', req.spanId);

  next();
};

export default traceContextMiddleware;
