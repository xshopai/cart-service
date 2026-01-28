# Cart Service - Local Development Guide

## Overview

The Cart Service is a Java/Quarkus microservice that manages shopping carts for the xshopai e-commerce platform. It uses Redis (via Dapr state store) for cart persistence.

## Prerequisites

- **Java 17+** (OpenJDK recommended)
- **Maven 3.8+**
- **Docker** & Docker Compose
- **Redis** (via Docker or local installation)

## Quick Start

### 1. Build the Project

```bash
cd cart-service
./mvnw clean install
```

Or on Windows:

```cmd
mvnw.cmd clean install
```

### 2. Environment Configuration

Create a `.env` file or set environment variables:

```env
# Server Configuration
QUARKUS_HTTP_PORT=1008

# Redis Configuration (for local development without Dapr)
REDIS_HOST=localhost
REDIS_PORT=6379

# Dapr Configuration
DAPR_HTTP_PORT=3500
STATESTORE_NAME=statestore
```

### 3. Start Infrastructure

Start Redis using Docker Compose:

```bash
docker-compose up -d redis
```

Or use the shared infrastructure:

```bash
cd ../scripts/docker-compose
docker-compose -f docker-compose.infrastructure.yml up -d redis
```

### 4. Run the Service

**Development mode (with hot reload):**

```bash
./mvnw quarkus:dev
```

**Production mode:**

```bash
./mvnw package -DskipTests
java -jar target/quarkus-app/quarkus-run.jar
```

## Running with Dapr

For local development with Dapr sidecar:

```bash
# Windows
.\run.ps1

# macOS/Linux
./run.sh
```

Or manually:

> **Note:** All services now use the standard Dapr ports (3500 for HTTP, 50001 for gRPC). This simplifies configuration and works consistently whether running via Docker Compose or individual service runs.

```bash
dapr run \
  --app-id cart-service \
  --app-port 1008 \
  --dapr-http-port 3500 \
  --dapr-grpc-port 50001 \
  --resources-path .dapr/components \
  --config .dapr/config.yaml \
  -- ./mvnw quarkus:dev
```

## Available Scripts

| Script                   | Description           |
| ------------------------ | --------------------- |
| `./mvnw quarkus:dev`     | Start with hot reload |
| `./mvnw package`         | Build JAR             |
| `./mvnw test`            | Run tests             |
| `./mvnw clean`           | Clean build artifacts |
| `./run.ps1` / `./run.sh` | Run with Dapr sidecar |

## API Endpoints

The service runs on `http://localhost:1008` by default.

### Health Check

```bash
curl http://localhost:1008/health
```

### Cart Operations

```bash
# Get cart
curl http://localhost:1008/api/cart/{userId}

# Add item to cart
curl -X POST http://localhost:1008/api/cart/{userId}/items \
  -H "Content-Type: application/json" \
  -d '{"productId": "123", "quantity": 2}'

# Update item quantity
curl -X PUT http://localhost:1008/api/cart/{userId}/items/{productId} \
  -H "Content-Type: application/json" \
  -d '{"quantity": 3}'

# Remove item
curl -X DELETE http://localhost:1008/api/cart/{userId}/items/{productId}

# Clear cart
curl -X DELETE http://localhost:1008/api/cart/{userId}
```

## Testing

```bash
# Run all tests
./mvnw test

# Run specific test class
./mvnw test -Dtest=CartResourceTest

# Run with coverage
./mvnw test jacoco:report
```

## Project Structure

```
cart-service/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/xshopai/cart/
│   │   │       ├── controller/   # REST endpoints
│   │   │       ├── service/      # Business logic
│   │   │       ├── model/        # Domain models
│   │   │       └── repository/   # Data access
│   │   └── resources/
│   │       └── application.properties
│   └── test/
│       └── java/
├── .dapr/
│   ├── components/    # Dapr component configs
│   └── config.yaml    # Dapr configuration
├── docs/              # Documentation
├── scripts/           # Deployment scripts
└── pom.xml
```

## Troubleshooting

### Redis Connection Issues

1. Verify Redis is running:

   ```bash
   docker ps | grep redis
   redis-cli ping
   ```

2. Check Redis connection settings

### Quarkus Dev Mode Issues

```bash
# Clear and rebuild
./mvnw clean quarkus:dev

# Force dependency update
./mvnw clean install -U
```

### Port Already in Use

```bash
# Find process using port 1008
netstat -ano | findstr :1008  # Windows
lsof -i :1008                 # macOS/Linux
```
