# EMG C3D Analyzer - Docker Development Setup Guide

## Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/emg-c3d-analyzer.git
cd emg-c3d-analyzer

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8080
# Redis Insight: http://localhost:5540 (optional)
```

## Development Configurations

### 1. Standard Development Mode
Full containerized environment with production-like setup:
```bash
docker-compose up -d
```

### 2. Hot-Reload Development Mode
For active development with live code reloading:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

Key differences:
- Volume mounts for source code
- Hot-reload enabled for both frontend and backend
- More verbose logging
- Development tools included

### 3. Hybrid Mode (Recommended for Active Development)
Run some services in Docker, others locally:
```bash
# Start only infrastructure services
docker-compose up redis -d

# Run backend locally with Poetry
cd backend
poetry install
poetry run uvicorn main:app --reload --port 8080

# Run frontend locally with npm
cd frontend
npm install
npm run dev
```

## Environment Setup

### Required Environment Variables

Create `.env` file in project root:
```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key  # For webhook operations

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL_SECONDS=3600
REDIS_MAX_CACHE_SIZE_MB=100
REDIS_KEY_PREFIX=emg_analysis_dev

# Backend Configuration
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO
DATA_BASE_DIR=/app/data
UPLOAD_DIR=/app/data/uploads
RESULTS_DIR=/app/data/results
CACHE_DIR=/app/data/cache

# Frontend Configuration  
REACT_APP_API_URL=http://localhost:8080
REACT_APP_SUPABASE_URL=${SUPABASE_URL}
REACT_APP_SUPABASE_ANON_KEY=${SUPABASE_KEY}
REACT_APP_ENVIRONMENT=development

# CORS Settings (Development)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Optional: Webhook Testing
WEBHOOK_SECRET=your-webhook-secret
NGROK_AUTH_TOKEN=your-ngrok-token  # For webhook testing
```

## Docker Compose Files Explained

### docker-compose.yml (Standard Development)
- Production-like images
- Isolated network
- Health checks
- Resource limits
- Best for integration testing

### docker-compose.dev.yml (Hot Reload)
- Source code mounted as volumes
- Development servers with watch mode
- All logs to stdout
- No resource limits
- Best for active development

### docker-compose.prod.yml (Production)
- Optimized images
- Security hardening
- Minimal logging
- Strict resource limits
- For production deployment

## Service Details

### Backend Service

**Standard Mode**:
```yaml
backend:
  build:
    context: .
    dockerfile: backend/Dockerfile
    target: production
  ports:
    - "8080:8080"
  volumes:
    - backend_data:/app/data
    - backend_logs:/app/logs
```

**Development Mode**:
```yaml
backend:
  build:
    context: .
    dockerfile: backend/Dockerfile.dev
  volumes:
    - ./backend:/app  # Mount source code
    - backend_data:/app/data
  command: uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

### Frontend Service

**Standard Mode**:
```yaml
frontend:
  build:
    context: .
    dockerfile: frontend/Dockerfile
  ports:
    - "3000:8080"  # Nginx serves on 8080
```

**Development Mode**:
```yaml
frontend:
  build:
    context: .
    dockerfile: frontend/Dockerfile.dev
  volumes:
    - ./frontend:/app
    - /app/node_modules  # Preserve node_modules
  ports:
    - "3000:3000"  # Vite dev server
  command: npm run dev -- --host 0.0.0.0 --port 3000
```

### Redis Service

```yaml
redis:
  image: redis:7.2-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
    - ./redis.conf:/usr/local/etc/redis/redis.conf:ro
  command: redis-server /usr/local/etc/redis/redis.conf
```

## Development Workflows

### 1. Initial Setup

```bash
# Build all images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

### 2. Code Development Workflow

```bash
# Start with hot-reload
docker-compose -f docker-compose.dev.yml up -d

# Watch backend logs
docker logs -f emg-backend-dev

# Watch frontend logs
docker logs -f emg-frontend-dev

# Make code changes - services auto-reload
```

### 3. Testing Workflow

```bash
# Run backend tests
docker-compose exec backend pytest tests/

# Run frontend tests
docker-compose exec frontend npm test

# Run integration tests
docker-compose exec backend pytest tests/integration/
```

### 4. Database Operations

```bash
# Access Redis CLI
docker-compose exec redis redis-cli

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL

# View Redis keys
docker-compose exec redis redis-cli KEYS "*"
```

### 5. Webhook Testing

```bash
# Start with webhook support
./start_dev.sh --webhook

# This will:
# 1. Start backend and frontend
# 2. Create ngrok tunnel
# 3. Display webhook URL for Supabase configuration

# Monitor webhook activity
tail -f logs/backend.error.log | grep -E "(🚀|📁|🔄|✅|❌|📊)"
```

## Common Development Tasks

### Rebuilding Images

```bash
# Rebuild specific service
docker-compose build backend

# Rebuild with no cache
docker-compose build --no-cache backend

# Rebuild all services
docker-compose build
```

### Managing Volumes

```bash
# List volumes
docker volume ls | grep emg

# Inspect volume
docker volume inspect emg-c3d-analyzer_backend_data

# Clean volume (WARNING: deletes data)
docker volume rm emg-c3d-analyzer_backend_data
```

### Container Management

```bash
# Enter backend container
docker-compose exec backend bash

# Enter frontend container
docker-compose exec frontend sh

# Run command in container
docker-compose exec backend python -c "import ezc3d; print(ezc3d.__version__)"
```

### Debugging

```bash
# Check container logs
docker-compose logs backend

# Follow logs in real-time
docker-compose logs -f backend

# Check last 100 lines
docker-compose logs --tail=100 backend

# Export logs
docker-compose logs > debug.log
```

## IDE Integration

### VS Code

1. Install Docker extension
2. Install Remote-Containers extension
3. Use `.devcontainer/devcontainer.json`:

```json
{
  "name": "EMG C3D Analyzer",
  "dockerComposeFile": "../docker-compose.dev.yml",
  "service": "backend",
  "workspaceFolder": "/app",
  "extensions": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode"
  ],
  "settings": {
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "python.formatting.provider": "black"
  }
}
```

### PyCharm

1. Configure Docker as Python interpreter
2. Set up path mappings:
   - Local: `./backend`
   - Remote: `/app`
3. Configure run configurations for Docker

## Performance Tips

### 1. Docker Desktop Settings
- Allocate sufficient resources:
  - CPUs: 4+
  - Memory: 8GB+
  - Disk: 20GB+

### 2. Build Optimization
```dockerfile
# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Enable build caching
docker-compose build --build-arg BUILDKIT_INLINE_CACHE=1
```

### 3. Development Speed
- Use volumes for source code (avoid rebuilds)
- Cache dependencies in separate layers
- Use `.dockerignore` to exclude unnecessary files

## Troubleshooting

### Issue: Container fails to start

```bash
# Check logs
docker-compose logs backend

# Common fixes:
# 1. Check port conflicts
lsof -i :8080

# 2. Reset containers
docker-compose down -v
docker-compose up -d

# 3. Rebuild images
docker-compose build --no-cache
```

### Issue: Import errors (ezc3d)

```bash
# Verify ezc3d installation
docker-compose exec backend python -c "import ezc3d; print(ezc3d.__version__)"

# Check library path
docker-compose exec backend printenv | grep LD_LIBRARY_PATH

# Rebuild backend
docker-compose build --no-cache backend
```

### Issue: Frontend not updating

```bash
# Clear Vite cache
docker-compose exec frontend rm -rf node_modules/.vite

# Restart frontend
docker-compose restart frontend

# Check volume mounts
docker-compose exec frontend ls -la /app
```

### Issue: Redis connection failed

```bash
# Check Redis status
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli ping

# Check network
docker network inspect emg-c3d-analyzer_emg-network
```

## Best Practices

### 1. Use Docker Compose Profiles
```yaml
profiles:
  - redis-gui  # Optional Redis Insight
  - debug      # Debug tools
  - test       # Test runners
```

### 2. Environment-Specific Overrides
```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Testing
docker-compose -f docker-compose.yml -f docker-compose.test.yml up
```

### 3. Health Checks
Always implement health checks:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### 4. Resource Limits (Development)
Set reasonable limits to prevent system overload:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

## Useful Commands Reference

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart backend

# View running services
docker-compose ps

# Stream logs
docker-compose logs -f

# Run tests
docker-compose exec backend pytest
docker-compose exec frontend npm test

# Clean everything (WARNING: removes data)
docker-compose down -v --rmi all

# Update dependencies
docker-compose exec backend poetry update
docker-compose exec frontend npm update
```

## Next Steps

1. Set up your `.env` file with credentials
2. Run `docker-compose up -d`
3. Access http://localhost:3000
4. Start developing!

For production deployment, see [Production Deployment Guide](./docker-deployment-production.md)