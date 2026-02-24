<div align="center">

# 🛒 Cart Service

**High-performance shopping cart microservice for the xshopai e-commerce platform**

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.18+-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Redis](https://img.shields.io/badge/Redis-7.0+-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Dapr](https://img.shields.io/badge/Dapr-Enabled-0D597F?style=for-the-badge&logo=dapr&logoColor=white)](https://dapr.io)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[Getting Started](#-getting-started) •
[Documentation](#-documentation) •
[API Reference](docs/PRD.md) •
[Contributing](#-contributing)

</div>

---

## 🎯 Overview

The **Cart Service** is a high-performance microservice responsible for managing shopping cart operations across the xshopai platform. Built with Redis-backed state management via Dapr, it provides lightning-fast cart operations with support for both authenticated users and guest shoppers, seamless cart transfer functionality, and automatic cart expiration.

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🛒 Cart Management

- Complete cart CRUD operations
- Add, update, remove cart items
- Cart totals & subtotal calculation
- Configurable cart limits (items/quantity)

</td>
<td width="50%">

### 👤 Guest Support

- Anonymous shopping without registration
- Unique guest ID management
- Seamless cart transfer on login
- Separate expiration policies

</td>
</tr>
<tr>
<td width="50%">

### 📡 Event-Driven Architecture

- CloudEvents 1.0 specification
- Pub/sub messaging via Dapr
- Cart lifecycle event publishing
- Cross-service synchronization

</td>
<td width="50%">

### ⚡ High Performance

- Redis-backed state management
- Sub-50ms response times
- ETag-based concurrency control
- Automatic cart expiration (TTL)

</td>
</tr>
</table>

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Redis 7.0+
- Docker & Docker Compose (optional)
- Dapr CLI (for production-like setup)

### Quick Start with Docker Compose

```bash
# Clone the repository
git clone https://github.com/xshopai/cart-service.git
cd cart-service

# Start all services (Redis, service, etc.)
docker-compose up -d

# Verify the service is healthy
curl http://localhost:8008/health/live
```

### Local Development Setup

<details>
<summary><b>🔧 Without Dapr (Simple Setup)</b></summary>

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start Redis (Docker)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Start the service
npm run dev
```

📖 See [Local Development Guide](docs/LOCAL_DEVELOPMENT.md) for detailed instructions.

</details>

<details>
<summary><b>⚡ With Dapr (Production-like)</b></summary>

```bash
# Ensure Dapr is initialized
dapr init

# Start with Dapr sidecar
npm run dev:dapr

# Or use platform-specific scripts
./scripts/dev.sh       # Linux/Mac
.\scripts\dev.ps1      # Windows
```

📖 See [Dapr Development Guide](docs/LOCAL_DEVELOPMENT.md#running-with-dapr) for detailed instructions.

</details>

---

## 📚 Documentation

| Document                                          | Description                                          |
| :------------------------------------------------ | :--------------------------------------------------- |
| 📘 [Local Development](docs/LOCAL_DEVELOPMENT.md) | Step-by-step local setup guide                       |
| ☁️ [Azure Container Apps](docs/ACA_DEPLOYMENT.md) | Deploy to serverless containers with built-in Dapr   |
| 📋 [Product Requirements](docs/PRD.md)            | Complete API specification and business requirements |

---

## 🔌 API Reference

### Authenticated User Endpoints

| Method   | Endpoint                  | Description           |
| :------- | :------------------------ | :-------------------- |
| `GET`    | `/api/v1/cart`            | Get user's cart       |
| `POST`   | `/api/v1/cart/items`      | Add item to cart      |
| `PUT`    | `/api/v1/cart/items/:sku` | Update item quantity  |
| `DELETE` | `/api/v1/cart/items/:sku` | Remove item from cart |
| `DELETE` | `/api/v1/cart`            | Clear cart            |
| `POST`   | `/api/v1/cart/transfer`   | Transfer guest cart   |

### Guest Endpoints

| Method   | Endpoint                                 | Description            |
| :------- | :--------------------------------------- | :--------------------- |
| `GET`    | `/api/v1/guest/cart/:guestId`            | Get guest cart         |
| `POST`   | `/api/v1/guest/cart/:guestId/items`      | Add item to guest cart |
| `PUT`    | `/api/v1/guest/cart/:guestId/items/:sku` | Update guest item      |
| `DELETE` | `/api/v1/guest/cart/:guestId/items/:sku` | Remove guest item      |
| `DELETE` | `/api/v1/guest/cart/:guestId`            | Clear guest cart       |

### Operational Endpoints

| Method | Endpoint        | Description         |
| :----- | :-------------- | :------------------ |
| `GET`  | `/info`         | Service information |
| `GET`  | `/health/ready` | Readiness probe     |
| `GET`  | `/health/live`  | Liveness probe      |
| `GET`  | `/metrics`      | Service metrics     |

---

## 🧪 Testing

We maintain high code quality standards with comprehensive test coverage.

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

| Metric        | Status               |
| :------------ | :------------------- |
| Unit Tests    | ✅ Passing           |
| Code Coverage | ✅ Target 80%+       |
| Security Scan | ✅ 0 vulnerabilities |

---

## 🏗️ Project Structure

```
cart-service/
├── 📁 src/                       # Application source code
│   ├── 📁 controllers/           # REST API endpoints
│   ├── 📁 services/              # Business logic layer
│   ├── 📁 models/                # Cart data models
│   ├── 📁 routes/                # Route definitions
│   ├── 📁 middlewares/           # Authentication, logging
│   ├── 📁 core/                  # Config, logger, errors
│   ├── 📄 app.ts                 # Express app setup
│   └── 📄 server.ts              # Entry point
├── 📁 tests/                     # Test suite
│   └── 📁 unit/                  # Unit tests
├── 📁 .dapr/                     # Dapr configuration
│   ├── 📁 components/            # State store, pub/sub config
│   └── 📄 config.yaml            # Dapr runtime configuration
├── 📁 docs/                      # Documentation
├── 📄 docker-compose.yml         # Local containerized environment
├── 📄 Dockerfile                 # Production container image
└── 📄 package.json               # Node.js dependencies
```

---

## 🔧 Technology Stack

| Category          | Technology                           |
| :---------------- | :----------------------------------- |
| 🟢 Runtime        | Node.js 20+ with TypeScript          |
| 🌐 Framework      | Express 4.18+                        |
| 🗄️ State Store    | Redis 7.0+ via Dapr State Management |
| 📨 Messaging      | Dapr Pub/Sub (RabbitMQ backend)      |
| 📋 Event Format   | CloudEvents 1.0 Specification        |
| 🔐 Authentication | JWT Token validation                 |
| 🧪 Testing        | Jest with coverage reporting         |
| 📊 Observability  | Structured logging                   |

---

## ⚙️ Configuration

| Variable              | Description            | Default       |
| :-------------------- | :--------------------- | :------------ |
| `PORT`                | HTTP server port       | `8008`        |
| `HOST`                | Server host            | `0.0.0.0`     |
| `NODE_ENV`            | Environment            | `development` |
| `CART_MAX_ITEMS`      | Max items per cart     | `50`          |
| `CART_TTL_DAYS`       | Cart expiration (days) | `30`          |
| `GUEST_CART_TTL_DAYS` | Guest cart expiration  | `7`           |
| `DAPR_HTTP_PORT`      | Dapr HTTP port         | `3508`        |
| `DAPR_GRPC_PORT`      | Dapr gRPC port         | `50008`       |
| `DAPR_STATE_STORE`    | Dapr state store name  | `statestore`  |
| `DAPR_PUBSUB_NAME`    | Dapr pub/sub name      | `pubsub`      |

---

## ⚡ Quick Reference

```bash
# 🐳 Docker Compose
docker-compose up -d              # Start all services
docker-compose down               # Stop all services
docker-compose logs -f cart       # View logs

# 🟢 Local Development
npm run dev                       # Run without Dapr
npm run dev:dapr                  # Run with Dapr sidecar

# 🧪 Testing
npm test                          # Run all tests
npm run test:coverage             # Run with coverage

# 🔍 Health Check
curl http://localhost:8008/health/live
curl http://localhost:8008/health/ready
curl http://localhost:8008/info
```

---

## 📡 Events Published

The cart service publishes CloudEvents to the `pubsub` component:

| Topic               | Description            |
| :------------------ | :--------------------- |
| `cart.item.added`   | Item added to cart     |
| `cart.item.updated` | Item quantity updated  |
| `cart.item.removed` | Item removed from cart |
| `cart.cleared`      | Cart cleared           |
| `cart.transferred`  | Guest cart transferred |

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Write** tests for your changes
4. **Run** the test suite
   ```bash
   npm test && npm run lint
   ```
5. **Commit** your changes
   ```bash
   git commit -m 'feat: add amazing feature'
   ```
6. **Push** to your branch
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open** a Pull Request

Please ensure your PR:

- ✅ Passes all existing tests
- ✅ Includes tests for new functionality
- ✅ Follows the existing code style
- ✅ Updates documentation as needed

---

## 🆘 Support

| Resource         | Link                                                                      |
| :--------------- | :------------------------------------------------------------------------ |
| 🐛 Bug Reports   | [GitHub Issues](https://github.com/xshopai/cart-service/issues)           |
| 📖 Documentation | [docs/](docs/)                                                            |
| 📋 API Reference | [docs/PRD.md](docs/PRD.md)                                                |
| 💬 Discussions   | [GitHub Discussions](https://github.com/xshopai/cart-service/discussions) |

---

## 📄 License

This project is part of the **xshopai** e-commerce platform.  
Licensed under the MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**[⬆ Back to Top](#-cart-service)**

Made with ❤️ by the xshopai team

</div>
