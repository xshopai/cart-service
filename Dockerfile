# =============================================================================
# Multi-stage Dockerfile for Java Quarkus Cart Service
# =============================================================================

# -----------------------------------------------------------------------------
# Build stage - Build the Quarkus application
# -----------------------------------------------------------------------------
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Copy Maven wrapper and pom.xml
COPY mvnw mvnw.cmd ./
COPY .mvn .mvn
COPY pom.xml ./

# Fix line endings (CRLF to LF) and make Maven wrapper executable
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw dependency:go-offline -B

# Copy source code
COPY src ./src

# Build the application (mvnw already has execute permission from previous step)
RUN ./mvnw package -DskipTests -B

# -----------------------------------------------------------------------------
# Production stage - Optimized for production deployment
# -----------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine AS production

# Install ca-certificates for HTTPS calls and wget for health checks
RUN apk --no-cache add ca-certificates tzdata wget

# Create non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -D -s /bin/sh -u 1001 -G appgroup cartuser

WORKDIR /app

# Copy the built artifact from builder
COPY --from=builder --chown=cartuser:appgroup /app/target/quarkus-app/lib/ ./lib/
COPY --from=builder --chown=cartuser:appgroup /app/target/quarkus-app/*.jar ./
COPY --from=builder --chown=cartuser:appgroup /app/target/quarkus-app/app/ ./app/
COPY --from=builder --chown=cartuser:appgroup /app/target/quarkus-app/quarkus/ ./quarkus/

# Create logs directory
RUN mkdir -p logs && chown -R cartuser:appgroup logs

# Switch to non-root user
USER cartuser

# Expose port
EXPOSE 8008

# Health check (using wget GET request to /health/live)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:8008/health/live > /dev/null || exit 1

# Run the Quarkus application
CMD ["java", "-jar", "quarkus-run.jar"]

# Labels for better image management and security scanning
LABEL maintainer="xshopai Team"
LABEL service="cart-service"
LABEL version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/xshopai/xshopai"
LABEL org.opencontainers.image.description="Cart Service for xshopai platform"
LABEL org.opencontainers.image.vendor="xshopai"
LABEL framework="quarkus"
LABEL language="java"
