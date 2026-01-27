# ============================================================================
# Azure Container Apps Deployment Script for Cart Service (PowerShell)
# ============================================================================

$ErrorActionPreference = "Stop"

function Write-Header { param([string]$Message); Write-Host "`n============================================================================" -ForegroundColor Blue; Write-Host $Message -ForegroundColor Blue; Write-Host "============================================================================`n" -ForegroundColor Blue }
function Write-Success { param([string]$Message); Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message); Write-Host "ℹ $Message" -ForegroundColor Blue }

function Read-HostWithDefault { param([string]$Prompt, [string]$Default); $input = Read-Host "$Prompt [$Default]"; if ([string]::IsNullOrWhiteSpace($input)) { return $Default }; return $input }

Write-Header "Checking Prerequisites"
try { az version | Out-Null; Write-Success "Azure CLI installed" } catch { Write-Error "Azure CLI not installed"; exit 1 }
try { docker version | Out-Null; Write-Success "Docker installed" } catch { Write-Error "Docker not installed"; exit 1 }
try { az account show | Out-Null } catch { az login }

Write-Header "Azure Configuration"
$ResourceGroup = Read-HostWithDefault -Prompt "Enter Resource Group name" -Default "rg-xshopai-aca"
$Location = Read-HostWithDefault -Prompt "Enter Azure Location" -Default "swedencentral"
$AcrName = Read-HostWithDefault -Prompt "Enter Azure Container Registry name" -Default "acrxshopaiaca"
$EnvironmentName = Read-HostWithDefault -Prompt "Enter Container Apps Environment name" -Default "cae-xshopai-aca"
$RedisName = Read-HostWithDefault -Prompt "Enter Redis Cache name" -Default "redis-xshopai-aca"

$AppName = "cart-service"
$AppPort = 1008

$Confirm = Read-Host "Proceed with deployment? (y/N)"
if ($Confirm -notmatch '^[Yy]$') { exit 0 }

Write-Header "Setting Up Redis Cache"
try { az redis show --name $RedisName --resource-group $ResourceGroup | Out-Null; Write-Info "Redis exists" }
catch {
    az redis create --name $RedisName --resource-group $ResourceGroup --location $Location --sku Basic --vm-size c0 --output none
    Write-Success "Redis created"
}
$RedisHost = "${RedisName}.redis.cache.windows.net"
$RedisKey = az redis list-keys --name $RedisName --resource-group $ResourceGroup --query primaryKey -o tsv
$RedisUrl = "rediss://:${RedisKey}@${RedisHost}:6380"

Write-Header "Building and Deploying"
$AcrLoginServer = az acr show --name $AcrName --query loginServer -o tsv
az acr login --name $AcrName

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServiceDir = Split-Path -Parent $ScriptDir
Push-Location $ServiceDir

try {
    ./mvnw clean package -DskipTests
    $ImageTag = "${AcrLoginServer}/${AppName}:latest"
    docker build -t $ImageTag .
    docker push $ImageTag
    Write-Success "Image pushed"
} finally { Pop-Location }

az containerapp env show --name $EnvironmentName --resource-group $ResourceGroup | Out-Null 2>$null
if ($LASTEXITCODE -ne 0) {
    az containerapp env create --name $EnvironmentName --resource-group $ResourceGroup --location $Location --output none
}

# Configure Dapr statestore
$StatestoreYaml = @"
componentType: state.redis
version: v1
metadata:
  - name: redisHost
    value: ${RedisHost}:6380
  - name: redisPassword
    secretRef: redis-password
  - name: enableTLS
    value: "true"
secrets:
  - name: redis-password
    value: ${RedisKey}
scopes:
  - cart-service
"@

$StatestoreYaml | Out-File -FilePath "$ServiceDir/.dapr/components/statestore-aca.yaml" -Encoding utf8

try {
    az containerapp show --name $AppName --resource-group $ResourceGroup | Out-Null
    az containerapp update --name $AppName --resource-group $ResourceGroup --image $ImageTag --output none
    Write-Success "Container app updated"
} catch {
    az containerapp create `
        --name $AppName `
        --resource-group $ResourceGroup `
        --environment $EnvironmentName `
        --image $ImageTag `
        --registry-server $AcrLoginServer `
        --target-port $AppPort `
        --ingress internal `
        --min-replicas 1 `
        --max-replicas 5 `
        --cpu 0.5 `
        --memory 1Gi `
        --enable-dapr `
        --dapr-app-id $AppName `
        --dapr-app-port $AppPort `
        --secrets "redis-key=$RedisKey" `
        --env-vars `
            "QUARKUS_PROFILE=prod" `
            "QUARKUS_HTTP_PORT=$AppPort" `
            "DAPR_HTTP_PORT=3500" `
            "STATESTORE_NAME=statestore" `
        --output none
    Write-Success "Container app created"
}

Write-Header "Deployment Complete!"
Write-Host "Cart Service deployed! Dapr App ID: $AppName" -ForegroundColor Green
