/**
 * Cart Service Application
 * Express application setup and configuration
 */
import express from 'express';
import cors from 'cors';
import config from './core/config.js';
import logger from './core/logger.js';
import { traceContextMiddleware } from './middlewares/traceContext.middleware.js';
import { errorHandler } from './controllers/cart.controller.js';
import cartRoutes from './routes/cart.routes.js';
import operationalRoutes from './routes/operational.routes.js';
import daprRoutes from './routes/dapr.routes.js';
import daprService from './services/dapr.service.js';

const app = express();
let isShuttingDown = false;

// ============================================
// Middleware
// ============================================

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: config.cors.allowedOrigins.includes('*') ? '*' : config.cors.allowedOrigins,
  methods: config.cors.allowedMethods,
  credentials: config.cors.allowCredentials,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Request-Id', 'traceparent', 'tracestate'],
};
app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// Trace context propagation
app.use(traceContextMiddleware);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Skip health check logging
    if (!req.path.includes('health') && !req.path.includes('ready') && !req.path.includes('live')) {
      logger.debug('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        traceId: req.traceId,
      });
    }
  });
  next();
});

// ============================================
// Routes
// ============================================

// Dapr routes (must be first for Azure Container Apps)
app.use(daprRoutes);

// Operational routes (health, readiness, etc.)
app.use(operationalRoutes);

// Cart API routes
app.use(cartRoutes);

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    data: null,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use(errorHandler);

// ============================================
// Server Lifecycle
// ============================================

/**
 * Start the HTTP server
 */
export const startServer = (): Promise<void> => {
  return new Promise((resolve) => {
    const PORT = config.service.port;
    const HOST = config.service.host;
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;

    app.listen(PORT, HOST, () => {
      logger.info(`Cart service running on ${displayHost}:${PORT}`, {
        service: config.service.name,
        version: config.service.version,
        environment: config.service.nodeEnv,
        dapr: {
          stateStore: config.dapr.stateStoreName,
          pubsub: config.dapr.pubsubName,
        },
      });
      resolve();
    });
  });
};

/**
 * Graceful shutdown handler
 */
export const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    // Close Dapr client
    await daprService.close();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
