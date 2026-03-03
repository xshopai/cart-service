# Copilot Instructions — cart-service

## Service Identity

- **Name**: cart-service
- **Purpose**: Shopping cart management — authenticated user carts, guest carts, cart transfer, item lifecycle
- **Port**: 8008
- **Language**: Node.js 20+ (TypeScript)
- **Framework**: Express 4.18+
- **Database**: Redis 7.0+ (port 6379) via ioredis + Dapr state store
- **Dapr App ID**: `cart-service`

## Architecture

- **Pattern**: Storage-abstracted service — StorageFactory selects Dapr state store or direct Redis based on `PLATFORM_MODE`
- **API Style**: RESTful JSON APIs
- **Authentication**: User ID via `X-User-Id` header (set by BFF/gateway)
- **Messaging**: Dapr pub/sub for cart events (CloudEvents 1.0)
- **State**: Dapr state store (Redis backend) with ETag concurrency control
- **Guest Support**: UUID-based guest carts with TTL, transferable to authenticated carts

## Project Structure

```
cart-service/
├── src/
│   ├── controllers/     # Cart endpoint handlers (user + guest)
│   ├── services/        # Business logic, storage factory
│   │   ├── cart.service.ts
│   │   ├── dapr.service.ts      # Dapr state + pub/sub
│   │   ├── redis.service.ts     # Direct Redis (App Service mode)
│   │   └── storage.factory.ts   # Selects Dapr vs Redis
│   ├── models/          # TypeScript interfaces (Cart, CartItem)
│   ├── routes/          # Route definitions (cart, guest, dapr, operational)
│   ├── middlewares/      # Trace context propagation
│   └── core/            # Config, logger, errors, Consul registration
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .dapr/components/
└── package.json
```

## Code Conventions

- **TypeScript** with strict mode
- **ESM modules** compiled via `tsc`
- Use `interface` for all data shapes in `src/models/`
- Use `ioredis` for direct Redis connections (App Service mode)
- Use `@dapr/dapr` SDK for Dapr state store and pub/sub (Container Apps mode)
- StorageFactory pattern: `PLATFORM_MODE=dapr` → Dapr state store, `PLATFORM_MODE=direct` → ioredis
- ETag-based optimistic concurrency for cart state
- Cart TTL: configurable days for authenticated and guest carts
- Structured logging via **Winston**
- W3C Trace Context propagation via `traceparent` header
- `asyncHandler` wrapper for Express route handlers

## Key Patterns

- **Dual storage**: Dapr state store for Container Apps/K8s, direct ioredis for App Service
- **Guest carts**: UUID-keyed, shorter TTL, transferable to user carts on login
- **Cart transfer**: `POST /api/v1/cart/transfer` merges guest cart into user cart
- **Max limits**: configurable `maxItems` and `maxItemQuantity` per cart
- Consul service registration/deregistration on startup/shutdown

## Testing Requirements

- All new controllers MUST have unit tests
- All new routes MUST have unit and e2e tests
- Use **Jest** with **ts-jest** as the test framework
- Mock Redis/Dapr state store in unit tests
- Do NOT call real Redis or Dapr in unit tests
- Test cart limits (maxItems, maxQuantity) and guest-to-user transfer logic
- Uses `--experimental-vm-modules` for ESM support in Jest
- Run: `npm test`, `npm run test:unit`, `npm run test:e2e`
- Coverage: `npm run test:coverage`

## Dapr Integration

- **State Store**: Redis-backed, ETag concurrency (`StateConcurrencyEnum`, `StateConsistencyEnum`)
- **Pub/Sub**: Publishes `cart.updated`, `cart.cleared` events
- **Ports**: Dapr HTTP 3508, Dapr gRPC 50008

## Security Rules

- User ID MUST be derived from the `X-User-Id` header (set by BFF/gateway) — never trust client-provided user IDs directly
- Guest cart operations use UUID-based keys — validate UUID format before processing
- Validate all request bodies (item quantities, cart operations)
- Enforce `maxItems` and `maxItemQuantity` limits on all cart operations
- Rate limiting must be applied to cart modification endpoints

## Error Handling Contract

All errors MUST follow this JSON structure:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "correlationId": "uuid"
  }
}
```

- Never expose stack traces in production
- Use centralized error middleware only

## Logging Rules

- Use structured JSON logging only
- Include:
  - timestamp
  - level
  - serviceName
  - correlationId
  - message
- Never log JWT tokens
- Never log secrets

## Non-Goals

- This service does NOT handle authentication or JWT validation — JWT is validated by the BFF
- This service does NOT manage product catalog or pricing — handled by product-service
- This service does NOT process orders or payments
- This service does NOT store persistent user profile data

## Environment Variables

```
PORT=8008
NODE_ENV=development
PLATFORM_MODE=dapr          # 'dapr' or 'direct'
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_dev_pass_123
DAPR_HTTP_PORT=3508
DAPR_GRPC_PORT=50008
CART_MAX_ITEMS=50
CART_MAX_ITEM_QUANTITY=99
CART_TTL_DAYS=30
CART_GUEST_TTL_DAYS=7
```

## Common Commands

```bash
npm run dev              # Dev with hot reload (tsx watch)
npm run dev:dapr         # Dev with Dapr sidecar
npm run build            # Compile TypeScript
npm test                 # All tests
npm run test:coverage    # Coverage report
npm run lint             # ESLint
```
