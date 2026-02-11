#!/bin/bash

# Cart Service - Run with Dapr

echo "Starting Cart Service with Dapr..."
echo "Service will be available at: http://localhost:8008"
echo "Dapr HTTP endpoint: http://localhost:3508"
echo "Dapr gRPC endpoint: localhost:50008"
echo ""

dapr run \
  --app-id cart-service \
  --app-port 8008 \
  --dapr-http-port 3508 \
  --dapr-grpc-port 50008 \
  --log-level info \
  --config ./.dapr/config.yaml \
  --resources-path ./.dapr/components \
  -- mvn quarkus:dev -Ddebug=false -Dquarkus.profile=dapr
