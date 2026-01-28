# ============================================================================
# Azure Container Apps Deployment Script for Cart Service (PowerShell)
# ============================================================================
# This script deploys the Cart Service to Azure Container Apps.
# 
# PREREQUISITE: Run the infrastructure deployment script first:
#   cd infrastructure/azure/aca/scripts
#   ./deploy-infra.ps1
#
# The infrastructure script creates all shared resources:
#   - Resource Group, ACR, Container Apps Environment
#   - Service Bus, Redis, Cosmos DB, MySQL, Key Vault
#   - Dapr components (pubsub, statestore, secretstore)
# ============================================================================

$ErrorActionPreference = "Stop"

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
function Write-Header { 
    param([string]$Message)
    Write-Host "`n==============================================================================" -ForegroundColor Blue
    Write-Host $Message -ForegroundColor Blue
    Write-Host "==============================================================================`n" -ForegroundColor Blue
}

function Write-Success { param([string]$Message); Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message); Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message); Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message); Write-Host "ℹ $Message" -ForegroundColor Cyan }

function Read-HostWithDefault { 
    param([string]$Prompt, [string]$Default)
    $input = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($input)) { return $Default }
    return $input
}

# ============================================================================
# Prerequisites Check
# ============================================================================
Write-Header "Checking Prerequisites"

try { az version | Out-Null; Write-Success "Azure CLI installed" } 
catch { Write-Error "Azure CLI not installed"; exit 1 }

try { docker version | Out-Null; Write-Success "Docker installed" } 
catch { Write-Error "Docker not installed"; exit 1 }

try { az account show | Out-Null; Write-Success "Logged into Azure" } 
catch { Write-Warning "Not logged into Azure. Initiating login..."; az login }

# ============================================================================
# Configuration
# ============================================================================
Write-Header "Configuration"

# Service-specific configuration
$ServiceName = "cart-service"
$ServiceVersion = "1.0.0"
$AppPort = 8008
$ProjectName = "xshopai"

# Dapr configuration (standard ports - same for local dev and ACA)
$DaprHttpPort = 3500
$DaprGrpcPort = 50001
$DaprStatestoreName = "statestore"

# Get script directory and service directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServiceDir = Split-Path -Parent $ScriptDir

# ============================================================================
# Environment Selection
# ============================================================================
Write-Host "Available Environments:" -ForegroundColor Cyan
Write-Host "   dev     - Development environment"
Write-Host "   staging - Staging/QA environment"
Write-Host "   prod    - Production environment"
Write-Host ""

$Environment = Read-HostWithDefault -Prompt "Enter environment (dev/staging/prod)" -Default "dev"

if ($Environment -notmatch '^(dev|staging|prod)$') {
    Write-Error "Invalid environment: $Environment"
    Write-Host "   Valid values: dev, staging, prod"
    exit 1
}
Write-Success "Environment: $Environment"

# Set environment-specific variables
switch ($Environment) {
    "dev" {
        $QuarkusProfile = "dev"
        $LogLevel = "DEBUG"
    }
    "staging" {
        $QuarkusProfile = "staging"
        $LogLevel = "INFO"
    }
    "prod" {
        $QuarkusProfile = "prod"
        $LogLevel = "WARN"
    }
}

# ============================================================================
# Suffix Configuration
# ============================================================================
Write-Header "Infrastructure Configuration"

Write-Host "The suffix was set during infrastructure deployment." -ForegroundColor Cyan
Write-Host "You can find it by running:"
Write-Host "   az group list --query `"[?starts_with(name, 'rg-xshopai-$Environment')].{Name:name, Suffix:tags.suffix}`" -o table" -ForegroundColor Blue
Write-Host ""

$Suffix = Read-Host "Enter the infrastructure suffix"

if ([string]::IsNullOrWhiteSpace($Suffix)) {
    Write-Error "Suffix is required. Please run the infrastructure deployment first."
    exit 1
}

if ($Suffix -notmatch '^[a-z0-9]{3,6}$') {
    Write-Error "Invalid suffix format: $Suffix"
    Write-Host "   Suffix must be 3-6 lowercase alphanumeric characters."
    exit 1
}
Write-Success "Using suffix: $Suffix"

# ============================================================================
# Derive Resource Names from Infrastructure
# ============================================================================
$ResourceGroup = "rg-$ProjectName-$Environment-$Suffix"
$AcrName = "$ProjectName$Environment$Suffix"
$ContainerEnv = "cae-$ProjectName-$Environment-$Suffix"
$RedisName = "redis-$ProjectName-$Environment-$Suffix"
$KeyVault = "kv-$ProjectName-$Environment-$Suffix"
$ManagedIdentity = "id-$ProjectName-$Environment-$Suffix"

Write-Info "Derived resource names:"
Write-Host "   Resource Group:      $ResourceGroup"
Write-Host "   Container Registry:  $AcrName"
Write-Host "   Container Env:       $ContainerEnv"
Write-Host "   Redis Cache:         $RedisName"
Write-Host "   Key Vault:           $KeyVault"
Write-Host ""

# ============================================================================
# Verify Infrastructure Exists
# ============================================================================
Write-Header "Verifying Infrastructure"

# Check Resource Group
try {
    az group show --name $ResourceGroup | Out-Null
    Write-Success "Resource Group exists: $ResourceGroup"
} catch {
    Write-Error "Resource group '$ResourceGroup' does not exist."
    Write-Host ""
    Write-Host "Please run the infrastructure deployment first:"
    Write-Host "   cd infrastructure/azure/aca/scripts" -ForegroundColor Blue
    Write-Host "   ./deploy-infra.ps1" -ForegroundColor Blue
    exit 1
}

# Check ACR
try {
    $AcrLoginServer = az acr show --name $AcrName --query loginServer -o tsv
    Write-Success "Container Registry exists: $AcrLoginServer"
} catch {
    Write-Error "Container Registry '$AcrName' does not exist."
    exit 1
}

# Check Container Apps Environment
try {
    az containerapp env show --name $ContainerEnv --resource-group $ResourceGroup | Out-Null
    Write-Success "Container Apps Environment exists: $ContainerEnv"
} catch {
    Write-Error "Container Apps Environment '$ContainerEnv' does not exist."
    exit 1
}

# Check Redis Cache
try {
    az redis show --name $RedisName --resource-group $ResourceGroup | Out-Null
    Write-Success "Redis Cache exists: $RedisName"
} catch {
    Write-Warning "Redis Cache '$RedisName' does not exist."
    Write-Info "Cart service will use the shared Dapr statestore component."
}

# Get Managed Identity ID
try {
    $IdentityId = az identity show --name $ManagedIdentity --resource-group $ResourceGroup --query id -o tsv
    Write-Success "Managed Identity exists: $ManagedIdentity"
} catch {
    Write-Warning "Managed Identity not found, will deploy without it"
    $IdentityId = $null
}

# ============================================================================
# Confirmation
# ============================================================================
Write-Header "Deployment Configuration Summary"

Write-Host "Environment:          $Environment" -ForegroundColor Cyan
Write-Host "Suffix:               $Suffix" -ForegroundColor Cyan
Write-Host "Resource Group:       $ResourceGroup" -ForegroundColor Cyan
Write-Host "Container Registry:   $AcrLoginServer" -ForegroundColor Cyan
Write-Host "Container Env:        $ContainerEnv" -ForegroundColor Cyan
Write-Host "Redis Cache:          $RedisName" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Configuration:" -ForegroundColor Cyan
Write-Host "   Service Name:      $ServiceName"
Write-Host "   Service Version:   $ServiceVersion"
Write-Host "   App Port:          $AppPort"
Write-Host "   Quarkus Profile:   $QuarkusProfile"
Write-Host "   LOG_LEVEL:         $LogLevel"
Write-Host "   Dapr HTTP Port:    $DaprHttpPort"
Write-Host "   Dapr Statestore:   $DaprStatestoreName"
Write-Host ""

$Confirm = Read-Host "Do you want to proceed with deployment? (y/N)"
if ($Confirm -notmatch '^[Yy]$') {
    Write-Warning "Deployment cancelled by user"
    exit 0
}

# ============================================================================
# Step 1: Build and Push Container Image
# ============================================================================
Write-Header "Step 1: Building and Pushing Container Image"

# Login to ACR
Write-Info "Logging into ACR..."
az acr login --name $AcrName
Write-Success "Logged into ACR"

# Navigate to service directory
Push-Location $ServiceDir

try {
    # Build Docker image (using production target)
    Write-Info "Building Docker image (this may take a few minutes for Java/Quarkus)..."
    docker build --target production -t "${ServiceName}:latest" .
    Write-Success "Docker image built"

    # Tag and push
    $ImageTag = "$AcrLoginServer/${ServiceName}:latest"
    docker tag "${ServiceName}:latest" $ImageTag
    Write-Info "Pushing image to ACR..."
    docker push $ImageTag
    Write-Success "Image pushed: $ImageTag"
} finally {
    Pop-Location
}

# ============================================================================
# Step 2: Deploy Container App
# ============================================================================
Write-Header "Step 2: Deploying Container App"

# Get ACR credentials
$AcrPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv

# Check if container app exists
$AppExists = $false
try {
    az containerapp show --name $ServiceName --resource-group $ResourceGroup | Out-Null
    $AppExists = $true
} catch {
    $AppExists = $false
}

if ($AppExists) {
    Write-Info "Container app '$ServiceName' exists, updating..."
    az containerapp update `
        --name $ServiceName `
        --resource-group $ResourceGroup `
        --image $ImageTag `
        --set-env-vars `
            "QUARKUS_PROFILE=$QuarkusProfile" `
            "QUARKUS_HTTP_PORT=$AppPort" `
            "QUARKUS_LOG_LEVEL=$LogLevel" `
            "DAPR_HTTP_PORT=$DaprHttpPort" `
            "DAPR_GRPC_PORT=$DaprGrpcPort" `
            "DAPR_STATESTORE_NAME=$DaprStatestoreName" `
        --output none
    Write-Success "Container app updated"
} else {
    Write-Info "Creating container app '$ServiceName'..."
    
    # Get JWT_SECRET from Key Vault for JWT validation
    Write-Info "Retrieving JWT_SECRET from Key Vault..."
    $JwtSecret = ""
    try {
        $JwtSecret = az keyvault secret show --vault-name $KeyVault --name "jwt-secret" --query value -o tsv 2>$null
        if ($JwtSecret) {
            Write-Success "JWT_SECRET retrieved from Key Vault"
        } else {
            Write-Warning "JWT_SECRET not found in Key Vault. JWT validation will be disabled."
            Write-Info "To enable JWT validation, add 'jwt-secret' to Key Vault: $KeyVault"
        }
    } catch {
        Write-Warning "Could not retrieve JWT_SECRET from Key Vault. JWT validation will be disabled."
    }
    
    # Build environment variables list
    $EnvVars = @(
        "QUARKUS_PROFILE=$QuarkusProfile",
        "QUARKUS_HTTP_PORT=$AppPort",
        "QUARKUS_LOG_LEVEL=$LogLevel",
        "DAPR_HTTP_PORT=$DaprHttpPort",
        "DAPR_GRPC_PORT=$DaprGrpcPort",
        "DAPR_STATESTORE_NAME=$DaprStatestoreName"
    )
    
    if ($JwtSecret) {
        $EnvVars += "JWT_SECRET=$JwtSecret"
    }
    
    # Note: Using external ingress with JWT validation for /api/* endpoints
    # Public endpoints (/, /health, /health/*, /metrics, /swagger*) remain unauthenticated
    $CreateArgs = @(
        "--name", $ServiceName,
        "--resource-group", $ResourceGroup,
        "--environment", $ContainerEnv,
        "--image", $ImageTag,
        "--registry-server", $AcrLoginServer,
        "--registry-username", $AcrName,
        "--registry-password", $AcrPassword,
        "--target-port", $AppPort,
        "--ingress", "external",
        "--min-replicas", "1",
        "--max-replicas", "5",
        "--cpu", "0.5",
        "--memory", "1.0Gi",
        "--enable-dapr",
        "--dapr-app-id", $ServiceName,
        "--dapr-app-port", $AppPort,
        "--env-vars"
    )
    $CreateArgs += $EnvVars
    $CreateArgs += @("--output", "none")
    
    if ($IdentityId) {
        $CreateArgs += @("--user-assigned", $IdentityId)
    }
    
    az containerapp create @CreateArgs
    Write-Success "Container app created"
}

# ============================================================================
# Step 3: Verify Deployment
# ============================================================================
Write-Header "Step 3: Verifying Deployment"

$AppFqdn = az containerapp show `
    --name $ServiceName `
    --resource-group $ResourceGroup `
    --query properties.configuration.ingress.fqdn `
    -o tsv

Write-Success "Deployment completed!"
Write-Host ""
Write-Info "Service FQDN: https://$AppFqdn"
Write-Info "Note: Cart service uses external ingress with JWT validation for /api/* endpoints"
Write-Info "Public endpoints: /, /health, /health/ready, /metrics, /swagger-ui"
Write-Info "Protected endpoints: /api/v1/cart/* (requires JWT)"
Write-Info "Guest endpoints: /api/v1/guest/* (no JWT required)"
Write-Host ""

# Health check (external endpoint)
Write-Info "Checking health endpoint..."
Start-Sleep -Seconds 10
try {
    $response = Invoke-WebRequest -Uri "https://$AppFqdn/health" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Success "Health check passed! (HTTP $($response.StatusCode))"
    }
} catch {
    Write-Warning "Health check returned an error. The app may still be starting."
}

# Check container app status
try {
    $AppStatus = az containerapp show `
        --name $ServiceName `
        --resource-group $ResourceGroup `
        --query properties.runningStatus `
        -o tsv
    
    if ($AppStatus -eq "Running") {
        Write-Success "Container app is running!"
    } else {
        Write-Warning "Container app status: $AppStatus. The app may still be starting."
    }
} catch {
    Write-Warning "Could not retrieve container app status."
}

# ============================================================================
# Summary
# ============================================================================
Write-Header "Deployment Summary"

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "   ✅ $ServiceName DEPLOYED SUCCESSFULLY" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application:" -ForegroundColor Cyan
Write-Host "   FQDN:             https://$AppFqdn"
Write-Host "   Ingress:          external (with JWT validation)"
Write-Host "   Health:           https://$AppFqdn/health"
Write-Host "   Swagger UI:       https://$AppFqdn/swagger-ui"
Write-Host ""
Write-Host "Security:" -ForegroundColor Cyan
Write-Host "   Public endpoints:    /, /health, /health/*, /metrics, /swagger*"
Write-Host "   Protected endpoints: /api/v1/cart/* (requires JWT from auth-service)"
Write-Host "   Guest endpoints:     /api/v1/guest/* (no JWT required)"
Write-Host ""
Write-Host "Infrastructure:" -ForegroundColor Cyan
Write-Host "   Resource Group:   $ResourceGroup"
Write-Host "   Environment:      $ContainerEnv"
Write-Host "   Registry:         $AcrLoginServer"
Write-Host ""
Write-Host "State Management:" -ForegroundColor Cyan
Write-Host "   Dapr Statestore:  $DaprStatestoreName (Redis-backed)"
Write-Host "   Redis Cache:      $RedisName"
Write-Host ""
Write-Host "Dapr Service Invocation:" -ForegroundColor Cyan
Write-Host "   App ID:           $ServiceName"
Write-Host "   Other services can invoke via: http://localhost:$DaprHttpPort/v1.0/invoke/$ServiceName/method/{endpoint}"
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host "   View logs:        az containerapp logs show --name $ServiceName --resource-group $ResourceGroup --follow" -ForegroundColor Blue
Write-Host "   View Dapr logs:   az containerapp logs show --name $ServiceName --resource-group $ResourceGroup --container daprd --follow" -ForegroundColor Blue
Write-Host "   Delete app:       az containerapp delete --name $ServiceName --resource-group $ResourceGroup --yes" -ForegroundColor Blue
Write-Host ""
