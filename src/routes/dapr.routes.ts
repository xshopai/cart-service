/**
 * Dapr Routes - Dapr-specific endpoints (subscriptions, etc.)
 */
import { Router, Request, Response } from 'express';
import config from '../core/config.js';
import logger from '../core/logger.js';

const router = Router();

/**
 * GET /dapr/subscribe - Dapr subscription configuration
 * Returns empty array since cart-service is a publisher, not a subscriber
 */
router.get('/dapr/subscribe', (req: Request, res: Response) => {
  // Cart service primarily publishes events, not subscribes
  // Add subscriptions here if needed in the future
  const subscriptions: any[] = [];

  logger.debug('Dapr subscription request', {
    subscriptionCount: subscriptions.length,
  });

  res.json(subscriptions);
});

/**
 * GET /dapr/config - Dapr configuration info
 */
router.get('/dapr/config', (req: Request, res: Response) => {
  res.json({
    appId: config.dapr.appId,
    stateStore: config.dapr.stateStoreName,
    pubsub: config.dapr.pubsubName,
    httpPort: config.dapr.httpPort,
    grpcPort: config.dapr.grpcPort,
  });
});

export default router;
