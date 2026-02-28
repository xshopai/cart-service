#!/bin/bash

# Cart Service - Run with direct Redis + RabbitMQ (local development)
# Runtime: Node.js/TypeScript

echo "Starting Cart Service (Direct Redis + RabbitMQ)..."
echo "Service will be available at: http://localhost:8008"
echo ""

# Kill any process using port 8008 (prevents "address already in use" errors)
PORT=8008
for pid in $(netstat -ano 2>/dev/null | grep ":$PORT" | grep LISTENING | awk '{print $5}' | sort -u); do
    echo "Killing process $pid on port $PORT..."
    taskkill //F //PID $pid 2>/dev/null
done

# Navigate to service root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
cd "$SERVICE_DIR"

# Copy .env.example to .env for local development (HTTP mode, no Dapr)
if [ -f ".env.example" ]; then
    cp ".env.example" ".env"
    echo "✅ Copied .env.example → .env"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run with HTTP mode (direct Redis + RabbitMQ)
echo "Starting in HTTP mode..."
npm run dev
