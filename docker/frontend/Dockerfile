# syntax=docker/dockerfile:1

# =============================================================================
# Platform Configuration for Multi-Architecture Support
# =============================================================================
ARG TARGETPLATFORM
ARG BUILDPLATFORM

# =============================================================================
# Stage 1: Build the React Application (Vite) - Debian-based for stability
# =============================================================================
# Use buildplatform for faster builds on ARM64 Macs with Rosetta emulation
FROM --platform=${BUILDPLATFORM:-linux/amd64} node:20-slim AS builder

# Set build arguments for Vite environment variables (from .env)
ARG NODE_ENV=production
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
# Legacy REACT_APP_ variables for backwards compatibility
ARG REACT_APP_API_URL
ARG REACT_APP_SUPABASE_URL
ARG REACT_APP_SUPABASE_ANON_KEY

# Set build environment variables (Vite uses VITE_ prefix)
ENV NODE_ENV=${NODE_ENV} \
    NODE_OPTIONS="--max-old-space-size=2048" \
    VITE_API_URL=${VITE_API_URL} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY} \
    REACT_APP_API_URL=${REACT_APP_API_URL} \
    REACT_APP_SUPABASE_URL=${REACT_APP_SUPABASE_URL} \
    REACT_APP_SUPABASE_ANON_KEY=${REACT_APP_SUPABASE_ANON_KEY}

# Set working directory
WORKDIR /app

# Install system dependencies for native module compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY frontend/package.json frontend/package-lock.json ./

# Copy TypeScript configuration files (required for tsc)
COPY frontend/tsconfig.json ./

# Configure npm for ARM64 compatibility and optimal builds
RUN npm config set legacy-peer-deps true && \
    npm config set prefer-offline true && \
    npm config set audit false && \
    npm config set fund false && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000

# Install TypeScript globally first to ensure it's available for npm scripts
RUN npm install -g typescript

# Install dependencies with ARM64 workaround for Rollup
# First, clean any existing modules and lock files to ensure fresh install
RUN rm -rf node_modules package-lock.json

# Install dependencies with clean install (including dev deps for Vite build)
# Use npm install instead of ci for better ARM64 compatibility
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps --prefer-offline --no-audit || \
    (echo "Retrying with cache clear..." && npm cache clean --force && \
     npm install --legacy-peer-deps --prefer-offline --no-audit)

# Copy frontend source code
COPY frontend/ .

# Verify TypeScript is available and build the application
RUN which tsc && tsc --version && npm run build

# =============================================================================
# Stage 2: Production Web Server
# =============================================================================
FROM nginx:1.25-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Remove default nginx config and static files
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY docker/frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage (using correct build output directory)
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Create necessary directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run \
    && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /var/run

# Switch to non-root user
USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose port (nginx unprivileged runs on 8080)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]