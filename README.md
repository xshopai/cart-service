# ��� Cart Service

Shopping cart microservice for xshopai - Node.js/TypeScript implementation with Redis-backed state management via Dapr.

## ��� Quick Start

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Redis** 7.0+ ([Install Guide](https://redis.io/docs/getting-started/))
- **Dapr CLI** 1.16+ ([Install Guide](https://docs.dapr.io/getting-started/install-dapr-cli/))

### Setup

**1. Start Redis**

```bash
# Using Docker (recommended)
docker run -d -p 6379:6379 --name redis \
  redis:7-alpine redis-server --requirepass redis_dev_pass_123

# Or install Redis locally
```

**2. Install Dependencies**

```bash
npm install
```

**3. Configure Environment**

```bash
cp .env.example .env
# Edit .env as needed
```

**4. Run with Dapr (Recommended)**

```bash
npm run dev:dapr
```

**5. Or Run Without Dapr (Development)**

```bash
npm run dev
```

**6. Verify**

```bash
# Check health
curl http://localhost:8008/health/live

# Get service info
curl http://localhost:8008/info
```

### Common Commands

```bash
# Run in development mode (with hot reload)
npm run dev

# Run with Dapr sidecar
npm run dev:dapr

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
```

## ��� API Endpoints

### Authenticated User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/cart` | Get user's cart |
| POST | `/api/v1/cart/items` | Add item to cart |
| PUT | `/api/v1/cart/items/:sku` | Update item quantity |
| DELETE | `/api/v1/cart/items/:sku` | Remove item from cart |
| DELETE | `/api/v1/cart` | Clear cart |
| POST | `/api/v1/cart/transfer` | Transfer guest cart |

### Guest Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/guest/cart/:guestId` | Get guest cart |
| POST | `/api/v1/guest/cart/:guestId/items` | Add item to guest cart |
| PUT | `/api/v1/guest/cart/:guestId/items/:sku` | Update guest item |
| DELETE | `/api/v1/guest/cart/:guestId/items/:sku` | Remove guest item |
| DELETE | `/api/v1/guest/cart/:guestId` | Clear guest cart |

### Operational Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/info` | Service information |
| GET | `/health/ready` | Readiness probe |
| GET | `/health/live` | Liveness probe |
| GET | `/metrics` | Service metrics |

## ⚙️ Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `8008` |
| `HOST` | Server host | `0.0.0.0` |
| `NODE_ENV` | Environment | `development` |
| `CART_MAX_ITEMS` | Max items per cart | `50` |
| `CART_TTL_DAYS` | Cart expiration (days) | `30` |
| `GUEST_CART_TTL_DAYS` | Guest cart expiration | `7` |
| `DAPR_HTTP_PORT` | Dapr HTTP port | `3508` |
| `DAPR_GRPC_PORT` | Dapr gRPC port | `50008` |
| `DAPR_STATE_STORE` | Dapr state store name | `statestore` |
| `DAPR_PUBSUB_NAME` | Dapr pub/sub name | `pubsub` |
| `LOG_LEVEL` | Log level | `info` |
| `LOG_FORMAT` | Log format (json/console) | `console` |

## ���️ Architecture

```
cart-service/
├── src/
│   ├── core/           # Config, logger, errors
│   ├── models/         # Cart data models
│   ├── services/       # Business logic
│   ├── controllers/    # HTTP handlers
│   ├── routes/         # Route definitions
│   ├── middlewares/    # Express middleware
│   ├── app.ts          # Express app setup
│   └── server.ts       # Entry point
├── .dapr/              # Dapr configuration
├── package.json
├── tsconfig.json
└── Dockerfile
```

## ��� Events Published

The cart service publishes events to the `pubsub` component:

| Topic | Description |
|-------|-------------|
| `cart.item.added` | Item added to cart |
| `cart.item.updated` | Item quantity updated |
| `cart.item.removed` | Item removed from cart |
| `cart.cleared` | Cart cleared |
| `cart.transferred` | Guest cart transferred |

## ��� License

MIT License - see [LICENSE](LICENSE) for details.
