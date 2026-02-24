# Cart Service - Azure Container Apps Deployment

## Overview

This guide covers deploying the Cart Service to Azure Container Apps (ACA) with Dapr integration for state management using Redis.

## Prerequisites

- Azure CLI installed and authenticated
- Docker installed
- Node.js 20+ installed
- Azure subscription with appropriate permissions
- Azure Container Registry (ACR) created

## Quick Deployment

### Using the Deployment Script

**PowerShell (Windows):**

```powershell
cd scripts
.\aca.ps1
```

**Bash (macOS/Linux):**

```bash
cd scripts
./aca.sh
```

The script will prompt for:

- Resource Group name
- Azure Location
- Container Registry name
- Container Apps Environment name
- Redis Cache name

## Manual Deployment

### 1. Set Variables

```bash
RESOURCE_GROUP="rg-xshopai-aca"
LOCATION="swedencentral"
ACR_NAME="acrxshopaiaca"
ENVIRONMENT_NAME="cae-xshopai-aca"
REDIS_NAME="redis-xshopai-aca"
APP_NAME="cart-service"
APP_PORT=8008
```

### 2. Create Redis Cache

```bash
az redis create \
  --name $REDIS_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Basic \
  --vm-size c0
```

### 3. Build and Push Image

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Install dependencies and build
npm ci
npm run build

# Build Docker image
docker build -t $ACR_NAME.azurecr.io/$APP_NAME:latest .

# Push to ACR
docker push $ACR_NAME.azurecr.io/$APP_NAME:latest
```

### 4. Deploy Container App

```bash
# Get Redis connection info
REDIS_HOST="${REDIS_NAME}.redis.cache.windows.net"
REDIS_KEY=$(az redis list-keys --name $REDIS_NAME --resource-group $RESOURCE_GROUP --query primaryKey -o tsv)

az containerapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/$APP_NAME:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --target-port $APP_PORT \
  --ingress internal \
  --min-replicas 1 \
  --max-replicas 5 \
  --cpu 0.5 \
  --memory 1Gi \
  --enable-dapr \
  --dapr-app-id $APP_NAME \
  --dapr-app-port $APP_PORT \
  --secrets "redis-key=$REDIS_KEY" \
  --env-vars \
    "NODE_ENV=production" \
    "PORT=$APP_PORT" \
    "DAPR_HTTP_PORT=3508" \
    "DAPR_STATE_STORE_NAME=statestore"
```

### 5. Configure Dapr State Store

Create a Dapr component for Redis state store:

```yaml
# statestore.yaml
componentType: state.redis
version: v1
metadata:
  - name: redisHost
    value: redis-xshopai-aca.redis.cache.windows.net:6380
  - name: redisPassword
    secretRef: xshopai-redis-password
  - name: enableTLS
    value: 'true'
secrets:
  - name: xshopai-redis-password
    value: <redis-key>
scopes:
  - cart-service
```

Apply the component:

```bash
az containerapp env dapr-component set \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --dapr-component-name statestore \
  --yaml statestore.yaml
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                Container Apps Environment                │
│  ┌─────────────────────────────────────────────────┐   │
│  │              cart-service                        │   │
│  │  ┌─────────────┐    ┌──────────────────────┐   │   │
│  │  │ Node.js App │◄──►│  Dapr Sidecar        │   │   │
│  │  │  Port 8008  │    │  Port 3508           │   │   │
│  │  └─────────────┘    └──────────┬───────────┘   │   │
│  └────────────────────────────────┼───────────────┘   │
│                                   │                     │
│  ┌────────────────────────────────▼───────────────┐   │
│  │           Dapr State Store Component            │   │
│  │              (Redis Backend)                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
                ┌─────────────────┐
                │  Azure Redis    │
                │     Cache       │
                └─────────────────┘
```

## Configuration

### Environment Variables

| Variable                | Description              | Default      |
| ----------------------- | ------------------------ | ------------ |
| `PORT`                  | HTTP server port         | 8008         |
| `NODE_ENV`              | Node.js environment      | production   |
| `DAPR_HTTP_PORT`        | Dapr sidecar HTTP port   | 3508         |
| `DAPR_STATE_STORE_NAME` | Dapr state store name    | statestore   |

### Scaling

```bash
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 2 \
  --max-replicas 10
```

## Monitoring

### View Logs

```bash
az containerapp logs show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --follow
```

### Check Health

```bash
# Get internal URL
FQDN=$(az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)

# Health check (from another container in the environment)
curl https://$FQDN/health/live
```

## Troubleshooting

### Container Not Starting

1. Check container logs
2. Verify Redis connection
3. Ensure Dapr component is configured correctly

### State Store Issues

1. Verify Redis is accessible
2. Check Dapr component configuration
3. Review Dapr sidecar logs

### Performance Issues

1. Check Redis cache metrics
2. Monitor container CPU/memory
3. Consider scaling replicas
