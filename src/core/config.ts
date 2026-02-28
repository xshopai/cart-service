/**
 * Configuration module for cart-service
 * Centralizes all environment-based configuration
 */
import dotenv from 'dotenv';

dotenv.config();

interface Config {
  service: {
    name: string;
    version: string;
    port: number;
    host: string;
    nodeEnv: string;
  };
  cart: {
    maxItems: number;
    maxItemQuantity: number;
    ttlDays: number;
    guestTtlDays: number;
  };
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowCredentials: boolean;
  };
  serviceInvocation: {
    mode: 'dapr' | 'direct';
  };
  redis: {
    host: string;
    port: number;
    password: string;
    tls: boolean;
  };
  dapr: {
    httpPort: number;
    grpcPort: number;
    host: string;
    stateStoreName: string;
    pubsubName: string;
    appId: string;
  };
  logging: {
    level: string;
    format: string;
    toFile: boolean;
    filePath: string;
  };
  observability: {
    enableTracing: boolean;
    otlpEndpoint: string;
  };
}

const config: Config = {
  service: {
    name: process.env.SERVICE_NAME || 'cart-service',
    version: process.env.SERVICE_VERSION || '1.0.0',
    port: parseInt(process.env.PORT || '8008', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  cart: {
    maxItems: parseInt(process.env.CART_MAX_ITEMS || '50', 10),
    maxItemQuantity: parseInt(process.env.CART_MAX_ITEM_QUANTITY || '99', 10),
    ttlDays: parseInt(process.env.CART_TTL_DAYS || '30', 10),
    guestTtlDays: parseInt(process.env.GUEST_CART_TTL_DAYS || '7', 10),
  },
  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()),
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowCredentials: process.env.CORS_ALLOW_CREDENTIALS === 'true',
  },
  serviceInvocation: {
    // 'dapr' for Container Apps/K8s, 'direct' for App Service
    mode: (process.env.PLATFORM_MODE || 'dapr') as 'dapr' | 'direct',
  },
  redis: {
    host: process.env.REDIS_HOST || '',
    port: parseInt(process.env.REDIS_PORT || '6380', 10),
    password: process.env.REDIS_KEY || process.env.REDIS_PASSWORD || '', // REDIS_KEY from Key Vault reference
    tls: process.env.REDIS_TLS !== 'false', // Default to true for Azure Redis
  },
  dapr: {
    httpPort: parseInt(process.env.DAPR_HTTP_PORT || '3508', 10),
    grpcPort: parseInt(process.env.DAPR_GRPC_PORT || '50008', 10),
    host: process.env.DAPR_HOST || 'localhost',
    stateStoreName: process.env.DAPR_STATE_STORE || 'statestore',
    pubsubName: process.env.DAPR_PUBSUB_NAME || 'pubsub',
    appId: process.env.DAPR_APP_ID || 'cart-service',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'console'),
    toFile: process.env.LOG_TO_FILE === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/cart-service.log',
  },
  observability: {
    enableTracing: process.env.ENABLE_TRACING === 'true',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  },
};

export default config;
