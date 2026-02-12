#!/bin/bash

# Cart Service - Run with direct Redis + RabbitMQ (local development)

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

# Copy dev configuration
echo "Using application.properties.dev configuration..."
cp src/main/resources/application.properties.dev src/main/resources/application.properties

# Make mvnw executable
chmod +x ./mvnw

# Run with Quarkus dev mode (config from application.properties)
# -Dquarkus.test.continuous-testing=disabled prevents interactive prompts
./mvnw quarkus:dev -Dquarkus.test.continuous-testing=disabled
