#!/bin/bash

# Cart Service - Run without Dapr (local development)

echo "Starting Cart Service (without Dapr)..."
echo "Service will be available at: http://localhost:8003"
echo ""
echo "Note: Event publishing and service-to-service calls will fail without Dapr."
echo "This mode is suitable for isolated development and testing."
echo ""

# Make mvnw executable
chmod +x ./mvnw

# Run with Spring Boot
./mvnw spring-boot:run
