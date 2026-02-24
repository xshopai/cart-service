/**
 * Operational Controller - Health, readiness, and info handlers
 */
import { Request, Response } from 'express';
import config from '../core/config.js';

/**
 * GET /info - Service information
 */
export const getInfo = (req: Request, res: Response): void => {
  res.json({
    service: config.service.name,
    version: config.service.version,
    environment: config.service.nodeEnv,
    dapr: {
      stateStore: config.dapr.stateStoreName,
      pubsub: config.dapr.pubsubName,
      appId: config.dapr.appId,
    },
    cart: {
      maxItems: config.cart.maxItems,
      ttlDays: config.cart.ttlDays,
      guestTtlDays: config.cart.guestTtlDays,
    },
  });
};

/**
 * GET /health/ready - Readiness probe
 */
export const getReadiness = (req: Request, res: Response): void => {
  res.json({
    status: 'ready',
    service: config.service.name,
    version: config.service.version,
    timestamp: new Date().toISOString(),
  });
};

/**
 * GET /health/live - Liveness probe
 */
export const getLiveness = (req: Request, res: Response): void => {
  res.json({
    status: 'live',
    service: config.service.name,
    timestamp: new Date().toISOString(),
  });
};

/**
 * GET /metrics - Metrics endpoint
 */
export const getMetrics = (req: Request, res: Response): void => {
  res.json({
    service: config.service.name,
    version: config.service.version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
};
