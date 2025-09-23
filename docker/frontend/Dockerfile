# syntax=docker/dockerfile:1

# ═══════════════════════════════════════════════════════════════════════════
# EMG C3D Analyzer - Frontend Production Build
# ═══════════════════════════════════════════════════════════════════════════
# 
# DevOps Architecture: Multi-stage build with platform-specific optimization
# Critical Fix: Prevents esbuild platform mismatch (ARM64 host → x64 container)
# Best Practice: Dependencies installed inside container for correct platform
#
# ═══════════════════════════════════════════════════════════════════════════

ARG TARGETPLATFORM=linux/amd64
ARG BUILDPLATFORM

# ═══════════════════════════════════════════════════════════════════════════
# Stage 1: Node.js Build Environment
# ═══════════════════════════════════════════════════════════════════════════
FROM --platform=${TARGETPLATFORM} node:20-alpine AS builder

# Build arguments for environment configuration
ARG NODE_ENV=production
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
# Legacy compatibility
ARG REACT_APP_API_URL
ARG REACT_APP_SUPABASE_URL
ARG REACT_APP_SUPABASE_ANON_KEY

# Environment variables for build process
ENV NODE_ENV=${NODE_ENV} \
    NODE_OPTIONS="--max-old-space-size=2048" \
    VITE_API_URL=${VITE_API_URL} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY} \
    REACT_APP_API_URL=${REACT_APP_API_URL} \
    REACT_APP_SUPABASE_URL=${REACT_APP_SUPABASE_URL} \
    REACT_APP_SUPABASE_ANON_KEY=${REACT_APP_SUPABASE_ANON_KEY} \
    CI=true

# Install build dependencies for native modules
RUN apk add --no-cache \
        python3 \
        make \
        g++ \
        curl \
        git

# Set working directory
WORKDIR /app

# 🚨 CRITICAL: Copy only package files first (not node_modules from host)
# This is the key fix for platform mismatch - host node_modules are excluded by .dockerignore
COPY frontend/package.json frontend/package-lock.json ./

# Copy build configuration files
COPY frontend/tsconfig.json ./

# Configure npm for cross-platform builds and performance
RUN npm config set legacy-peer-deps true \
    && npm config set audit false \
    && npm config set fund false \
    && npm config set fetch-retries 3 \
    && npm config set fetch-timeout 60000

# 🔧 Install dependencies INSIDE container for correct platform
# This ensures we get linux/amd64 binaries instead of darwin/arm64 from host
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production --legacy-peer-deps

# Install development dependencies needed for build
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# Copy source code (after dependencies for better caching)
COPY frontend/ .

# 🏗️ Build application with platform-specific dependencies
# Vite will use the correct esbuild binary for linux/amd64
RUN npm run build

# Verify build output
RUN ls -la dist/ && echo "Build completed successfully"

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