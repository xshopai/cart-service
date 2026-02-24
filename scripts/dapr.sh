#!/bin/bash

# Cart Service - Run with Dapr State Store + Pub/Sub
# Runtime: Node.js/TypeScript

echo "Starting Cart Service (Dapr State Store + Pub/Sub)..."
echo "Service will be available at: http://localhost:8008"
echo "Dapr HTTP endpoint: http://localhost:3508"
echo "Dapr gRPC endpoint: localhost:50008"
echo ""

# Navigate to service root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
cd "$SERVICE_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Kill any processes using required ports (prevents "address already in use" errors)
for PORT in 8008 3508 50008; do
    for pid in $(netstat -ano 2>/dev/null | grep ":$PORT" | grep LISTENING | awk '{print $5}' | sort -u); do
        echo "Killing process $pid on port $PORT..."
        taskkill //F //PID $pid 2>/dev/null
    done
done

dapr run \
  --app-id cart-service \
  --app-port 8008 \
  --dapr-http-port 3508 \
  --dapr-grpc-port 50008 \
  --log-level info \
  --config ./.dapr/config.yaml \
  --resources-path ./.dapr/components \
  -- npm run dev:dapr
