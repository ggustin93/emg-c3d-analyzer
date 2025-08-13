# EMG C3D Analyzer - Docker Known Issues & Solutions

## Critical Issues Resolved

### 1. ezc3d Library Installation (RESOLVED)

**Issue**: Complex C++ library with Python bindings failing to install correctly in Docker.

**Root Cause**: Mixing Poetry and pip package managers caused dependency conflicts.

**Solution**: Standardized on Poetry throughout the Docker build process.

```dockerfile
# CORRECT: Use Poetry exclusively
FROM python:3.11-slim AS builder
RUN pip install poetry
WORKDIR /app
COPY pyproject.toml poetry.lock* ./
RUN poetry config virtualenvs.in-project true \
    && poetry install --only=main --no-root

# Copy virtual environment to production
FROM python:3.11-slim AS production
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
```

### 2. Shared Library Loading (RESOLVED)

**Issue**: `ImportError: libezc3d.so: cannot open shared object file`

**Root Cause**: ezc3d's shared library not in system library path.

**Solution**: Set `LD_LIBRARY_PATH` environment variable.

```dockerfile
ENV LD_LIBRARY_PATH="/app/.venv/lib/python3.11/site-packages/ezc3d:$LD_LIBRARY_PATH"
```

### 3. Python Relative Imports (RESOLVED)

**Issue**: `ImportError: attempted relative import beyond top-level package`

**Root Cause**: Docker's PYTHONPATH configuration incompatible with relative imports.

**Solution**: Converted all relative imports to absolute imports.

```python
# WRONG
from ..config import get_settings
from ..services.cache_service import CacheService

# CORRECT
from config import get_settings
from services.cache_service import CacheService
```

**Automated Fix Script**:
```bash
# Find and fix all relative imports
find backend -name "*.py" -exec sed -i '' 's/from \.\./from /g' {} \;
```

## Current Known Issues

### 1. Frontend Rollup Compatibility (Alpine Linux)

**Issue**: Rollup native modules fail on Alpine Linux ARM64 architecture.

**Symptoms**:
```
Cannot find module @rollup/rollup-linux-arm64-musl
```

**Workaround**:
```dockerfile
# Force install fallback
RUN npm ci && \
    npm install @rollup/rollup-linux-x64-musl --save-dev --force || \
    npm install @rollup/rollup-linux-arm64-musl --save-dev --force || \
    echo "Using fallback rollup"
```

**Long-term Solution**: Consider switching from Alpine to Debian slim for frontend builds.

### 2. Docker Build Performance on ARM64

**Issue**: Poetry dependency installation takes excessive time on Apple Silicon.

**Symptoms**: Build hangs at `poetry install` for 5+ minutes.

**Solutions**:
1. **Use BuildKit cache mounts**:
   ```dockerfile
   RUN --mount=type=cache,target=/root/.cache/pypoetry \
       poetry install --only=main --no-root
   ```

2. **Pre-build base image**:
   ```bash
   docker build -t emg-base:latest -f backend/Dockerfile.base .
   ```

3. **Use Docker Desktop Rosetta emulation**:
   - Enable in Docker Desktop settings
   - Allows x86_64 images on ARM64

### 3. Memory Issues During Build

**Issue**: Frontend build runs out of memory with large projects.

**Symptoms**:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solution**:
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=4096"
```

## Platform-Specific Issues

### macOS (Apple Silicon)

1. **Architecture Mismatch**
   ```bash
   # Check current platform
   docker version --format '{{.Server.Arch}}'
   
   # Build for multiple platforms
   docker buildx build --platform linux/amd64,linux/arm64 .
   ```

2. **File System Performance**
   - Use delegated mounts for better performance:
   ```yaml
   volumes:
     - ./backend:/app:delegated
   ```

### Windows (WSL2)

1. **Line Ending Issues**
   ```bash
   # Configure git
   git config --global core.autocrlf input
   
   # In .gitattributes
   *.sh text eol=lf
   *.py text eol=lf
   ```

2. **Path Mounting**
   ```yaml
   # Use WSL2 paths
   volumes:
     - /mnt/c/projects/emg:/app
   ```

### Linux

1. **Permission Issues**
   ```bash
   # Fix ownership
   sudo chown -R $(id -u):$(id -g) ./data
   
   # Or use user mapping
   docker-compose run --user $(id -u):$(id -g) backend
   ```

## Common Development Issues

### 1. Port Conflicts

**Issue**: "bind: address already in use"

**Solution**:
```bash
# Find process using port
lsof -i :8080
kill -9 <PID>

# Or change port in docker-compose
ports:
  - "8081:8080"
```

### 2. Volume Permission Errors

**Issue**: "Permission denied" when writing to volumes

**Solution**:
```dockerfile
# Create user with same UID as host
ARG UID=1000
ARG GID=1000
RUN groupadd -g $GID appuser && \
    useradd -u $UID -g $GID appuser
USER appuser
```

### 3. Container Name Conflicts

**Issue**: "Container name already in use"

**Solution**:
```bash
# Remove old container
docker rm emg-backend-dev

# Or use unique names
container_name: emg-backend-dev-${USER}
```

### 4. Network Issues

**Issue**: Containers can't communicate

**Solution**:
```yaml
# Ensure same network
networks:
  emg-network:
    driver: bridge

services:
  backend:
    networks:
      - emg-network
  frontend:
    networks:
      - emg-network
```

## Debugging Techniques

### 1. Container Won't Start

```bash
# Check exit code
docker-compose ps

# View full logs
docker-compose logs backend

# Run interactive debug
docker-compose run --rm backend bash

# Override entrypoint for debugging
docker-compose run --rm --entrypoint bash backend
```

### 2. Dependency Issues

```bash
# List installed packages
docker-compose exec backend pip list
docker-compose exec backend poetry show

# Check specific package
docker-compose exec backend python -c "import ezc3d; print(ezc3d.__version__)"

# Reinstall dependencies
docker-compose exec backend poetry install
```

### 3. File System Issues

```bash
# Check mounts
docker-compose exec backend mount

# Verify file permissions
docker-compose exec backend ls -la /app

# Check disk space
docker system df
```

### 4. Network Debugging

```bash
# Test connectivity
docker-compose exec backend ping redis
docker-compose exec backend curl http://frontend:8080

# Check DNS
docker-compose exec backend nslookup redis

# View network config
docker network inspect emg-c3d-analyzer_emg-network
```

## Performance Optimization

### 1. Slow Builds

**Use BuildKit**:
```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
docker-compose build
```

**Layer Caching**:
```dockerfile
# Order matters - least changing first
COPY pyproject.toml poetry.lock* ./
RUN poetry install
COPY . .  # Source code changes frequently
```

### 2. Slow Container Startup

**Optimize Health Checks**:
```yaml
healthcheck:
  start_period: 30s  # Give time to start
  interval: 30s      # Don't check too often
```

### 3. High Memory Usage

**Set Limits**:
```yaml
deploy:
  resources:
    limits:
      memory: 512M
    reservations:
      memory: 256M
```

## Migration Issues

### From Local Development to Docker

1. **Environment Variables**
   ```bash
   # Export local env
   env > .env.local
   
   # Filter and copy needed vars
   grep -E "SUPABASE|REDIS" .env.local > .env
   ```

2. **File Paths**
   ```python
   # Use environment variables
   DATA_DIR = os.getenv("DATA_BASE_DIR", "/app/data")
   ```

3. **Database Connections**
   ```python
   # Use service names, not localhost
   REDIS_URL = "redis://redis:6379/0"  # Not localhost
   ```

## Recovery Procedures

### 1. Complete Reset

```bash
# Stop and remove everything
docker-compose down -v --rmi all

# Clean Docker system
docker system prune -a --volumes

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

### 2. Data Recovery

```bash
# Backup volumes before reset
docker run --rm -v emg-c3d-analyzer_backend_data:/data \
  -v $(pwd):/backup busybox \
  tar czf /backup/data-backup.tar.gz /data

# Restore after reset
docker run --rm -v emg-c3d-analyzer_backend_data:/data \
  -v $(pwd):/backup busybox \
  tar xzf /backup/data-backup.tar.gz -C /
```

### 3. Emergency Fixes

```bash
# Fix permissions
docker-compose exec -u root backend chown -R appuser:appuser /app

# Install missing package
docker-compose exec backend pip install missing-package

# Restart service
docker-compose restart backend
```

## Prevention Strategies

### 1. Use Multi-Stage Builds
- Separate build and runtime dependencies
- Smaller final images
- Faster rebuilds

### 2. Pin Versions
```dockerfile
FROM python:3.11.9-slim  # Not just 3.11
FROM node:20.15.0-alpine # Not just 20
```

### 3. Health Monitoring
```python
@app.get("/health/detailed")
async def detailed_health():
    return {
        "memory": get_memory_usage(),
        "cpu": get_cpu_usage(),
        "disk": get_disk_usage(),
        "connections": {
            "redis": check_redis(),
            "database": check_database()
        }
    }
```

### 4. Automated Testing
```yaml
# docker-compose.test.yml
services:
  test-runner:
    build:
      context: .
      target: test
    command: pytest --cov
```

## Getting Help

### Diagnostic Information to Collect

When reporting issues, include:

```bash
# System info
docker version
docker-compose version
uname -a

# Project state
git status
git log --oneline -5

# Container state
docker-compose ps
docker-compose logs --tail=50

# Resource usage
docker system df
docker stats --no-stream
```

### Resources

- Docker Documentation: https://docs.docker.com
- Poetry Documentation: https://python-poetry.org
- ezc3d Issues: https://github.com/pyomeca/ezc3d/issues
- Project Issues: https://github.com/your-org/emg-c3d-analyzer/issues

## Summary

Most issues stem from:
1. **Dependency Management**: Poetry vs pip conflicts
2. **Architecture Differences**: ARM64 vs x86_64
3. **Path Resolution**: Relative vs absolute imports
4. **Resource Constraints**: Memory and CPU limits

The solutions implemented ensure:
- ✅ Consistent dependency management (Poetry only)
- ✅ Proper library loading (LD_LIBRARY_PATH)
- ✅ Clean import structure (absolute imports)
- ✅ Multi-platform support (build args)
- ✅ Production readiness (Coolify compatible)