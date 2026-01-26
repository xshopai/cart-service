#!/bin/bash

# ============================================================================
# Azure Container Apps Deployment Script for Cart Service
# ============================================================================
# This script automates the deployment of Cart Service to Azure Container Apps
# with Dapr support for state management (Redis/Azure Cache for Redis).
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# ============================================================================
# Prerequisites Check
# ============================================================================
print_header "Checking Prerequisites"

# Check Azure CLI
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi
print_success "Azure CLI is installed"

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_success "Docker is installed"

# Check if logged into Azure
if ! az account show &> /dev/null; then
    print_warning "Not logged into Azure. Initiating login..."
    az login
fi
print_success "Logged into Azure"

# ============================================================================
# User Input Collection
# ============================================================================
print_header "Azure Configuration"

# Function to prompt with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local varname="$3"
    
    read -p "$prompt [$default]: " input
    eval "$varname=\"${input:-$default}\""
}

# List available subscriptions
echo -e "\n${BLUE}Available Azure Subscriptions:${NC}"
az account list --query "[].{Name:name, SubscriptionId:id, IsDefault:isDefault}" --output table

echo ""
prompt_with_default "Enter Azure Subscription ID (leave empty for default)" "" SUBSCRIPTION_ID

if [ -n "$SUBSCRIPTION_ID" ]; then
    az account set --subscription "$SUBSCRIPTION_ID"
    print_success "Subscription set to: $SUBSCRIPTION_ID"
else
    SUBSCRIPTION_ID=$(az account show --query id --output tsv)
    print_info "Using default subscription: $SUBSCRIPTION_ID"
fi

# Resource Group
echo ""
prompt_with_default "Enter Resource Group name" "rg-xshopai-aca" RESOURCE_GROUP

# Location
echo ""
echo -e "${BLUE}Common Azure Locations:${NC}"
echo "  - swedencentral (Sweden Central)"
echo "  - eastus (East US)"
echo "  - westus2 (West US 2)"
echo "  - westeurope (West Europe)"
prompt_with_default "Enter Azure Location" "swedencentral" LOCATION

# Azure Container Registry
echo ""
prompt_with_default "Enter Azure Container Registry name" "acrxshopaiaca" ACR_NAME

# Container Apps Environment
echo ""
prompt_with_default "Enter Container Apps Environment name" "cae-xshopai-aca" ENVIRONMENT_NAME

# Redis Cache Name
echo ""
prompt_with_default "Enter Azure Cache for Redis name" "redis-xshopai-aca" REDIS_NAME

# App name
APP_NAME="cart-service"

# ============================================================================
# Confirmation
# ============================================================================
print_header "Deployment Configuration Summary"

echo "Resource Group:           $RESOURCE_GROUP"
echo "Location:                 $LOCATION"
echo "Container Registry:       $ACR_NAME"
echo "Environment:              $ENVIRONMENT_NAME"
echo "Redis Cache Name:         $REDIS_NAME"
echo "App Name:                 $APP_NAME"
echo ""

read -p "Do you want to proceed with deployment? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    print_warning "Deployment cancelled by user"
    exit 0
fi

# ============================================================================
# Step 1: Create Resource Group (if needed)
# ============================================================================
print_header "Step 1: Verifying Resource Group"

if az group exists --name "$RESOURCE_GROUP" | grep -q "true"; then
    print_info "Resource group '$RESOURCE_GROUP' already exists"
else
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output none
    print_success "Resource group '$RESOURCE_GROUP' created"
fi

# ============================================================================
# Step 2: Create Azure Cache for Redis
# ============================================================================
print_header "Step 2: Creating Azure Cache for Redis"

if az redis show --name "$REDIS_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_info "Azure Cache for Redis '$REDIS_NAME' already exists"
else
    print_info "Creating Azure Cache for Redis '$REDIS_NAME'..."
    print_warning "This may take 15-20 minutes. Please wait..."
    
    az redis create \
        --name "$REDIS_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --sku Basic \
        --vm-size C0 \
        --output none
    
    print_success "Azure Cache for Redis '$REDIS_NAME' created"
fi

# Get Redis connection details
print_info "Retrieving Redis connection details..."
REDIS_HOST=$(az redis show --name "$REDIS_NAME" --resource-group "$RESOURCE_GROUP" --query hostName --output tsv)
REDIS_PORT="6380"
REDIS_PASSWORD=$(az redis list-keys --name "$REDIS_NAME" --resource-group "$RESOURCE_GROUP" --query primaryKey --output tsv)

print_success "Redis Host: $REDIS_HOST"
print_success "Redis Port: $REDIS_PORT"

# ============================================================================
# Step 3: Verify Azure Container Registry
# ============================================================================
print_header "Step 3: Verifying Azure Container Registry"

if az acr show --name "$ACR_NAME" &> /dev/null; then
    print_info "ACR '$ACR_NAME' already exists"
else
    az acr create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$ACR_NAME" \
        --sku Basic \
        --admin-enabled true \
        --output none
    print_success "ACR '$ACR_NAME' created"
fi

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)
print_info "ACR Login Server: $ACR_LOGIN_SERVER"

# ============================================================================
# Step 4: Build and Push Container Image
# ============================================================================
print_header "Step 4: Building and Pushing Container Image"

# Login to ACR
az acr login --name "$ACR_NAME"
print_success "Logged into ACR"

# Navigate to service directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"

print_info "Building from: $SERVICE_DIR"
cd "$SERVICE_DIR"

# Build image
IMAGE_TAG="${ACR_LOGIN_SERVER}/${APP_NAME}:latest"
print_info "Building image: $IMAGE_TAG"

docker build -t "$IMAGE_TAG" .
print_success "Docker image built successfully"

# Push image
print_info "Pushing image to ACR..."
docker push "$IMAGE_TAG"
print_success "Docker image pushed to ACR"

# ============================================================================
# Step 5: Verify Container Apps Environment
# ============================================================================
print_header "Step 5: Verifying Container Apps Environment"

if az containerapp env show --name "$ENVIRONMENT_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_info "Container Apps Environment '$ENVIRONMENT_NAME' already exists"
else
    print_error "Container Apps Environment '$ENVIRONMENT_NAME' does not exist."
    print_error "Please deploy Web BFF or another service first to create the environment."
    exit 1
fi

# ============================================================================
# Step 6: Configure Dapr Component for Redis State Store
# ============================================================================
print_header "Step 6: Configuring Dapr State Store Component"

# Create Dapr component file in the project directory (for version control)
mkdir -p "$SERVICE_DIR/.dapr/components"

cat > "$SERVICE_DIR/.dapr/components/statestore-aca.yaml" << EOF
componentType: state.redis
version: v1
metadata:
  - name: redisHost
    value: "${REDIS_HOST}:${REDIS_PORT}"
  - name: redisPassword
    secretRef: redis-password
  - name: enableTLS
    value: "true"
  - name: keyPrefix
    value: "cart"
  - name: actorStateStore
    value: "false"
secrets:
  - name: redis-password
    value: "${REDIS_PASSWORD}"
scopes:
  - cart-service
EOF

print_success "Dapr statestore component file created at .dapr/components/statestore-aca.yaml"

# Deploy the component to Azure Container Apps Environment
print_info "Deploying Dapr statestore component to Container Apps Environment..."
az containerapp env dapr-component set \
    --name "statestore" \
    --resource-group "$RESOURCE_GROUP" \
    --dapr-env-name "$ENVIRONMENT_NAME" \
    --yaml "$SERVICE_DIR/.dapr/components/statestore-aca.yaml" \
    --output none

print_success "Dapr statestore component configured in Azure"

# ============================================================================
# Step 7: Deploy Container App
# ============================================================================
print_header "Step 7: Deploying Cart Service Container App"

# Check if app already exists
if az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_info "Container app '$APP_NAME' already exists. Updating..."
    
    az containerapp update \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --image "$IMAGE_TAG" \
        --output none
    
    print_success "Container app updated"
else
    print_info "Creating new container app '$APP_NAME'..."
    
    az containerapp create \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$ENVIRONMENT_NAME" \
        --image "$IMAGE_TAG" \
        --registry-server "$ACR_LOGIN_SERVER" \
        --target-port 1008 \
        --ingress internal \
        --min-replicas 1 \
        --max-replicas 5 \
        --cpu 0.5 \
        --memory 1Gi \
        --enable-dapr \
        --dapr-app-id "$APP_NAME" \
        --dapr-app-port 1008 \
        --dapr-app-protocol http \
        --output none
    
    print_success "Container app created"
fi

# ============================================================================
# Step 8: Configure Scaling
# ============================================================================
print_header "Step 8: Configuring Auto-Scaling"

az containerapp update \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --min-replicas 1 \
    --max-replicas 5 \
    --output none

print_success "Auto-scaling configured (1-5 replicas)"

# ============================================================================
# Step 9: Verify Deployment
# ============================================================================
print_header "Step 9: Verifying Deployment"

# Get internal FQDN (cart-service has internal ingress)
INTERNAL_FQDN=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.fqdn" \
    --output tsv)

print_info "Waiting for app to start..."
sleep 20

# Check app status
APP_STATUS=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.runningStatus" \
    --output tsv)

if [ "$APP_STATUS" == "Running" ]; then
    print_success "Cart Service is running"
else
    print_warning "App status: $APP_STATUS (may still be starting)"
fi

# ============================================================================
# Deployment Summary
# ============================================================================
print_header "Deployment Complete!"

echo -e "${GREEN}Cart Service has been deployed successfully!${NC}\n"

echo -e "${YELLOW}Internal FQDN (accessed via Dapr service invocation):${NC}"
echo "  $INTERNAL_FQDN"
echo ""

echo -e "${YELLOW}Dapr App ID:${NC}"
echo "  cart-service"
echo ""

echo -e "${YELLOW}Service Invocation from Web BFF:${NC}"
echo "  http://localhost:3500/v1.0/invoke/cart-service/method/api/cart/{cartId}"
echo ""

echo -e "${YELLOW}Useful Commands:${NC}"
echo "  # View logs"
echo "  az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --type console --follow"
echo ""
echo "  # View Dapr sidecar logs"
echo "  az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --container daprd --follow"
echo ""
echo "  # View app details"
echo "  az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP"
echo ""
echo "  # Update image"
echo "  az containerapp update --name $APP_NAME --resource-group $RESOURCE_GROUP --image ${ACR_LOGIN_SERVER}/${APP_NAME}:v2"
echo ""

echo -e "\n${CYAN}Note: Cart Service uses internal ingress and is accessed via Dapr service invocation from Web BFF.${NC}"
