#!/bin/bash
# ==============================================================================
# Azure Container Apps Deployment Script - cart-service
# Runtime: Node.js/TypeScript
# ==============================================================================
set -e

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
print_header() { echo -e "\n${BLUE}=== $1 ===${NC}\n"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${CYAN}ℹ $1${NC}"; }

# ==============================================================================
# Configuration
# ==============================================================================
SERVICE_NAME="cart-service"
APP_PORT=8008
PROJECT_NAME="xshopai"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"

# ==============================================================================
# Prerequisites
# ==============================================================================
print_header "Prerequisites"
command -v az &>/dev/null || { print_error "Azure CLI not installed"; exit 1; }
command -v docker &>/dev/null || { print_error "Docker not installed"; exit 1; }
az account show &>/dev/null || { print_warning "Not logged in, initiating login..."; az login; }
print_success "Prerequisites OK"

# ==============================================================================
# Environment Selection
# ==============================================================================
print_header "Environment"
read -p "Enter environment (dev/prod) [dev]: " ENVIRONMENT
ENVIRONMENT="${ENVIRONMENT:-dev}"
[[ "$ENVIRONMENT" =~ ^(dev|prod)$ ]] || { print_error "Invalid environment"; exit 1; }

read -p "Enter infrastructure suffix: " SUFFIX
[[ -n "$SUFFIX" && "$SUFFIX" =~ ^[a-z0-9]{3,6}$ ]] || { print_error "Invalid suffix (3-6 lowercase alphanumeric)"; exit 1; }
print_success "Environment: $ENVIRONMENT, Suffix: $SUFFIX"

# Set Node.js-specific environment
case "$ENVIRONMENT" in
    dev)  NODE_ENV="development"; LOG_LEVEL="debug" ;;
    prod) NODE_ENV="production"; LOG_LEVEL="info" ;;
esac

# ==============================================================================
# Derive Resource Names
# ==============================================================================
RESOURCE_GROUP="rg-${PROJECT_NAME}-${ENVIRONMENT}-${SUFFIX}"
ACR_NAME="${PROJECT_NAME}${ENVIRONMENT}${SUFFIX}"
CONTAINER_ENV="cae-${PROJECT_NAME}-${ENVIRONMENT}-${SUFFIX}"
KEY_VAULT="kv-${PROJECT_NAME}-${ENVIRONMENT}-${SUFFIX}"
MANAGED_IDENTITY="id-${PROJECT_NAME}-${ENVIRONMENT}-${SUFFIX}"
CONTAINER_APP="ca-${SERVICE_NAME}-${ENVIRONMENT}-${SUFFIX}"
AI_NAME="ai-${PROJECT_NAME}-${ENVIRONMENT}-${SUFFIX}"

print_info "Resource Group: $RESOURCE_GROUP"
print_info "Container App: $CONTAINER_APP"

# ==============================================================================
# Verify Infrastructure
# ==============================================================================
print_header "Verifying Infrastructure"
az group show --name "$RESOURCE_GROUP" &>/dev/null || { print_error "Resource group not found"; exit 1; }
print_success "Resource Group: $RESOURCE_GROUP"

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
print_success "ACR: $ACR_LOGIN_SERVER"

az containerapp env show --name "$CONTAINER_ENV" --resource-group "$RESOURCE_GROUP" &>/dev/null || { print_error "Container env not found"; exit 1; }
print_success "Container Env: $CONTAINER_ENV"

IDENTITY_ID=$(MSYS_NO_PATHCONV=1 az identity show --name "$MANAGED_IDENTITY" --resource-group "$RESOURCE_GROUP" --query id -o tsv 2>/dev/null || echo "")
[[ -n "$IDENTITY_ID" ]] && print_success "Managed Identity: $MANAGED_IDENTITY"

# Get App Insights connection string
AI_CONNECTION_STRING=$(az monitor app-insights component show --app "$AI_NAME" --resource-group "$RESOURCE_GROUP" --query connectionString -o tsv 2>/dev/null || echo "")
[[ -n "$AI_CONNECTION_STRING" ]] && print_success "App Insights found"

# ==============================================================================
# Retrieve Secrets from Key Vault
# ==============================================================================
print_header "Retrieving Secrets"

JWT_SECRET=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "jwt-secret" --query value -o tsv 2>/dev/null || echo "")
[[ -n "$JWT_SECRET" ]] && print_success "JWT_SECRET retrieved" || print_warning "JWT_SECRET not found"

SERVICE_PRODUCT_TOKEN=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "service-product-token" --query value -o tsv 2>/dev/null || echo "")
[[ -n "$SERVICE_PRODUCT_TOKEN" ]] && print_success "SERVICE_PRODUCT_TOKEN retrieved" || print_warning "SERVICE_PRODUCT_TOKEN not found"

SERVICE_INVENTORY_TOKEN=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "service-inventory-token" --query value -o tsv 2>/dev/null || echo "")
[[ -n "$SERVICE_INVENTORY_TOKEN" ]] && print_success "SERVICE_INVENTORY_TOKEN retrieved" || print_warning "SERVICE_INVENTORY_TOKEN not found"

SERVICE_WEBBFF_TOKEN=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "service-webbff-token" --query value -o tsv 2>/dev/null || echo "")
[[ -n "$SERVICE_WEBBFF_TOKEN" ]] && print_success "SERVICE_WEBBFF_TOKEN retrieved" || print_warning "SERVICE_WEBBFF_TOKEN not found"

# ==============================================================================
# Build and Push Image
# ==============================================================================
print_header "Building and Pushing Image"
az acr login --name "$ACR_NAME"
cd "$SERVICE_DIR"

print_info "Building Docker image (Node.js build)..."
docker build --target production -t "$SERVICE_NAME:latest" .
print_success "Image built"

IMAGE_TAG="$ACR_LOGIN_SERVER/$SERVICE_NAME:latest"
docker tag "$SERVICE_NAME:latest" "$IMAGE_TAG"
docker push "$IMAGE_TAG"
print_success "Image pushed: $IMAGE_TAG"

# ==============================================================================
# Deploy Container App
# ==============================================================================
print_header "Deploying Container App"
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

# Build environment variables array (Node.js)
ENV_VARS=(
    "NODE_ENV=$NODE_ENV"
    "PORT=$APP_PORT"
    "HOST=0.0.0.0"
    "LOG_LEVEL=$LOG_LEVEL"
    "SERVICE_NAME=$SERVICE_NAME"
    "SERVICE_VERSION=1.0.0"
)
[[ -n "$JWT_SECRET" ]] && ENV_VARS+=("JWT_SECRET=$JWT_SECRET")
[[ -n "$SERVICE_PRODUCT_TOKEN" ]] && ENV_VARS+=("SERVICE_PRODUCT_TOKEN=$SERVICE_PRODUCT_TOKEN")
[[ -n "$SERVICE_INVENTORY_TOKEN" ]] && ENV_VARS+=("SERVICE_INVENTORY_TOKEN=$SERVICE_INVENTORY_TOKEN")
[[ -n "$SERVICE_WEBBFF_TOKEN" ]] && ENV_VARS+=("SERVICE_WEBBFF_TOKEN=$SERVICE_WEBBFF_TOKEN")
[[ -n "$AI_CONNECTION_STRING" ]] && ENV_VARS+=("APPLICATIONINSIGHTS_CONNECTION_STRING=$AI_CONNECTION_STRING")
[[ -n "$AI_CONNECTION_STRING" ]] && ENV_VARS+=("ENABLE_TRACING=true")

if az containerapp show --name "$CONTAINER_APP" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    print_info "Updating existing container app..."
    az containerapp update \
        --name "$CONTAINER_APP" \
        --resource-group "$RESOURCE_GROUP" \
        --image "$IMAGE_TAG" \
        --set-env-vars "${ENV_VARS[@]}" \
        --output none
    print_success "Container app updated"
else
    print_info "Creating container app..."
    MSYS_NO_PATHCONV=1 az containerapp create \
        --name "$CONTAINER_APP" \
        --container-name "$SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$CONTAINER_ENV" \
        --image "$IMAGE_TAG" \
        --registry-server "$ACR_LOGIN_SERVER" \
        --registry-username "$ACR_NAME" \
        --registry-password "$ACR_PASSWORD" \
        --target-port $APP_PORT \
        --ingress external \
        --min-replicas 1 \
        --max-replicas 10 \
        --cpu 0.5 \
        --memory 1.0Gi \
        --enable-dapr \
        --dapr-app-id "$SERVICE_NAME" \
        --dapr-app-port $APP_PORT \
        --env-vars "${ENV_VARS[@]}" \
        ${IDENTITY_ID:+--user-assigned "$IDENTITY_ID"} \
        --tags "project=$PROJECT_NAME" "environment=$ENVIRONMENT" "service=$SERVICE_NAME" "runtime=nodejs" \
        --output none
    print_success "Container app created"
fi

# ==============================================================================
# Verify Deployment
# ==============================================================================
print_header "Verifying Deployment"
APP_FQDN=$(az containerapp show --name "$CONTAINER_APP" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)
print_success "FQDN: https://$APP_FQDN"

print_info "Waiting for app to start..."
sleep 15

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$APP_FQDN/health/live" 2>/dev/null || echo "000")
if [ "$HEALTH_STATUS" = "200" ]; then
    print_success "Health check passed (HTTP $HEALTH_STATUS)"
else
    print_warning "Health check returned HTTP $HEALTH_STATUS (app may still be starting)"
fi

# ==============================================================================
# Summary
# ==============================================================================
print_header "Deployment Summary"
echo -e "${GREEN}✅ $SERVICE_NAME deployed successfully${NC}"
echo ""
echo -e "${CYAN}Endpoints:${NC}"
echo "   Health:     https://$APP_FQDN/health/live"
echo "   Cart API:   https://$APP_FQDN/api/v1/cart (JWT required)"
echo "   Guest API:  https://$APP_FQDN/api/v1/guest/cart/:guestId (public)"
echo ""
echo -e "${CYAN}Dapr:${NC}"
echo "   App ID:     $SERVICE_NAME"
echo "   Statestore: statestore (Redis-backed)"
echo ""
echo -e "${CYAN}Commands:${NC}"
echo "   Logs: az containerapp logs show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --follow"
