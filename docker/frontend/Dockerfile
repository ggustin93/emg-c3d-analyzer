# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1: Build the React Application (Vite) - Debian-based for stability
# =============================================================================
FROM node:20-slim AS builder

# Set build arguments
ARG NODE_ENV=production
ARG REACT_APP_API_URL
ARG REACT_APP_SUPABASE_URL
ARG REACT_APP_SUPABASE_ANON_KEY

# Set build environment variables
ENV NODE_ENV=${NODE_ENV} \
    NODE_OPTIONS="--max-old-space-size=2048" \
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
COPY frontend/tsconfig.json frontend/tsconfig.node.json ./

# Install dependencies with clean install (including dev deps for Vite build)
# Set npm to use legacy peer deps to avoid rollup native module issues
# Force include dev dependencies for build stage even in production mode
RUN --mount=type=cache,target=/root/.npm \
    npm config set legacy-peer-deps true && \
    npm ci --only=production=false --prefer-offline --no-audit --legacy-peer-deps

# Install TypeScript globally to ensure it's available
RUN npm install -g typescript

# Copy frontend source code
COPY frontend/ .

# Build the application directly (TypeScript check is handled by Vite)
RUN npm run build

# =============================================================================
# Stage 2: Production Web Server
# =============================================================================
FROM nginx:1.25-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Remove default nginx config and static files
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY frontend/nginx.conf /etc/nginx/nginx.conf

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