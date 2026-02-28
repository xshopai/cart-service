// Test environment variables
// This file runs before Jest is initialized

process.env.NODE_ENV = 'test';
process.env.SERVICE_NAME = 'cart-service';
process.env.SERVICE_VERSION = '1.0.0';
process.env.PORT = '0';
process.env.HOST = 'localhost';
process.env.LOG_LEVEL = 'error';
process.env.LOG_FORMAT = 'console';
process.env.LOG_TO_FILE = 'false';

// Cart configuration
process.env.CART_MAX_ITEMS = '50';
process.env.CART_MAX_ITEM_QUANTITY = '99';
process.env.CART_TTL_DAYS = '30';
process.env.GUEST_CART_TTL_DAYS = '7';

// CORS configuration
process.env.CORS_ALLOWED_ORIGINS = '*';

// Dapr configuration (mocked in tests)
process.env.PLATFORM_MODE = 'dapr';
process.env.DAPR_HOST = 'localhost';
process.env.DAPR_HTTP_PORT = '3508';
process.env.DAPR_GRPC_PORT = '50008';
process.env.DAPR_STATE_STORE = 'statestore';
process.env.DAPR_PUBSUB_NAME = 'pubsub';
process.env.DAPR_APP_ID = 'cart-service';

// Disable tracing in tests
process.env.ENABLE_TRACING = 'false';
process.env.OTEL_TRACES_EXPORTER = 'none';
