# =============================================================================
# Multi-stage Dockerfile for Node.js Cart Service
# =============================================================================

# -----------------------------------------------------------------------------
# Base stage - Common setup for all stages
# -----------------------------------------------------------------------------
FROM node:24-alpine AS base
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S cartuser -u 1001 -G nodejs

# -----------------------------------------------------------------------------
# Dependencies stage - Install all dependencies
# -----------------------------------------------------------------------------
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --include=dev && npm cache clean --force

# -----------------------------------------------------------------------------
# Development stage - For local development with hot reload
# -----------------------------------------------------------------------------
FROM dependencies AS development

# Copy application code
COPY . .

# Development user
USER cartuser

# Expose port
EXPOSE 8008

# Start in development mode
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Build stage - Compile TypeScript
# -----------------------------------------------------------------------------
FROM dependencies AS build

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# -----------------------------------------------------------------------------
# Production stage - Final optimized image
# -----------------------------------------------------------------------------
FROM base AS production

# Set production environment
ENV NODE_ENV=production

# Copy built application and production dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Set ownership to non-root user
RUN chown -R cartuser:nodejs /app

# Switch to non-root user
USER cartuser

# Expose port
EXPOSE 8008

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8008') + '/health/live', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
