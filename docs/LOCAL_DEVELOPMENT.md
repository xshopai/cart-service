# Cart Service - Local Development Guide

## Overview

The Cart Service is a Node.js/TypeScript microservice that manages shopping carts for the xshopai e-commerce platform. It uses Redis (via Dapr state store) for cart persistence.

## Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm** (comes with Node.js)
- **Docker** & Docker Compose
- **Redis** (via Docker or local installation)
- **Dapr CLI** (optional, for Dapr mode)

## Quick Start

### 1. Install Dependencies

```bash
cd cart-service
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Or use the pre-configured mode-specific files:

```bash
# For HTTP mode (direct Redis)
cp .env.http .env

# For Dapr mode
cp .env.dapr .env
```

Key environment variables:

```env
# Server Configuration
PORT=8008
HOST=0.0.0.0
NODE_ENV=development

# Dapr Configuration (for Dapr mode)
DAPR_HTTP_PORT=3508
DAPR_GRPC_PORT=50008
DAPR_STATE_STORE=statestore
DAPR_PUBSUB_NAME=pubsub

# Redis Configuration (for HTTP mode)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=redis_dev_pass_123
```

### 3. Start Infrastructure

Start Redis using Docker Compose:

```bash
docker-compose up -d cart-redis
```

Or use the shared infrastructure:

```bash
cd ../dev
docker-compose up -d redis
```

### 4. Run the Service

**Development mode (with hot reload):**

```bash
npm run dev
```

**With HTTP mode (direct Redis):**

```bash
npm run dev:http
```

**Production mode:**

```bash
npm run build
npm start
```

## Running with Dapr

For local development with Dapr sidecar:

```bash
# Using npm script
npm run dev:dapr

# Or using the shell script
./scripts/dapr.sh
```

Or manually:

```bash
dapr run \
  --app-id cart-service \
  --app-port 8008 \
  --dapr-http-port 3508 \
  --dapr-grpc-port 50008 \
  --resources-path .dapr/components \
  --config .dapr/config.yaml \
  -- npm run dev
```

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## API Endpoints

Once running, the service is available at `http://localhost:8008`:

| Endpoint | Description |
|----------|-------------|
| `/info` | Service information |
| `/health/ready` | Readiness probe |
| `/health/live` | Liveness probe |
| `/metrics` | Service metrics |
| `/api/v1/cart` | Cart operations (JWT required) |
| `/api/v1/guest/cart/:guestId` | Guest cart operations |

## Common Issues

### Port Already in Use

```bash
# Kill process on port 8008
npx kill-port 8008
```

### Redis Connection Failed

Ensure Redis is running:

```bash
docker ps | grep redis
# If not running:
docker-compose up -d cart-redis
```

### Dapr Sidecar Not Starting

Check Dapr installation:

```bash
dapr --version
dapr init
```

## Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload |
| `npm run dev:dapr` | Start with Dapr sidecar |
| `npm run dev:http` | Start in HTTP mode |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm test` | Run tests |
| `npm run lint` | Lint code |
