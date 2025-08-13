# EMG C3D Analyzer - Production Deployment Guide

## Overview

This guide covers production deployment of the EMG C3D Analyzer using Docker containers and Coolify as the deployment platform. The application consists of a FastAPI backend with Poetry dependency management, React/TypeScript frontend with Vite, and Redis cache service.

## Architecture

### Components
- **Backend**: FastAPI (Python 3.11) with Poetry, ezc3d C++ library bindings
- **Frontend**: React + TypeScript + Vite
- **Cache**: Redis 7.2
- **Database**: Supabase (external service)
- **Deployment Platform**: Coolify (self-hosted PaaS)

## Prerequisites

1. **Coolify Instance** - Running Coolify v4.x
2. **Domain Name** - For production HTTPS access
3. **Supabase Project** - With configured database and storage
4. **Environment Variables** - All production secrets ready

## Deployment Options

### Option 1: Docker Compose in Coolify (Recommended)

1. **Create New Resource in Coolify**
   - Select "Docker Compose" as deployment type
   - Choose your server and destination

2. **Configure Docker Compose**
   ```yaml
   # Use docker-compose.prod.yml content
   # Coolify will handle SERVICE_FQDN_ magic variables
   ```

3. **Environment Variables**
   Set these in Coolify's environment section:
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-key
   
   # Redis Configuration (if external)
   REDIS_URL=redis://redis:6379/0
   REDIS_CACHE_TTL_SECONDS=3600
   
   # Application Settings
   ENVIRONMENT=production
   DEBUG=false
   LOG_LEVEL=WARNING
   ```

4. **Coolify Magic Variables**
   Coolify automatically provides:
   - `SERVICE_FQDN_[SERVICE]` - Auto-generated domains
   - `SERVICE_PASSWORD_[NAME]` - Secure random passwords
   - `SERVICE_URL_[SERVICE]` - Full URLs with protocol

### Option 2: Individual Services Deployment

#### Backend Deployment

1. **Create Backend Service**
   - Type: Docker Image or Dockerfile
   - Build Context: Repository root
   - Dockerfile Path: `backend/Dockerfile`

2. **Build Configuration**
   ```yaml
   Build Command: docker build -f backend/Dockerfile .
   Target: production
   ```

3. **Runtime Configuration**
   ```yaml
   Port: 8080
   Health Check: /health
   Resource Limits:
     Memory: 512MB
     CPU: 0.5
   ```

#### Frontend Deployment

1. **Create Frontend Service**
   - Type: Static Site or Docker Image
   - Build Context: Repository root
   - Dockerfile Path: `frontend/Dockerfile`

2. **Build Arguments**
   ```yaml
   REACT_APP_API_URL: ${SERVICE_URL_BACKEND}
   REACT_APP_SUPABASE_URL: ${SUPABASE_URL}
   REACT_APP_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
   ```

## Production Configuration

### Backend Production Settings

```python
# backend/config.py production overrides
class ProductionSettings:
    ENVIRONMENT = "production"
    DEBUG = False
    LOG_LEVEL = "WARNING"
    
    # Performance tuning
    WORKERS = 2  # Adjust based on CPU cores
    WORKER_CONNECTIONS = 1000
    KEEPALIVE = 5
    
    # Security
    CORS_ORIGINS = ["https://your-domain.com"]
    SECURE_HEADERS = True
    
    # Cache settings
    REDIS_CACHE_TTL_SECONDS = 3600
    REDIS_MAX_CACHE_SIZE_MB = 100
```

### Frontend Production Build

```typescript
// vite.config.ts production settings
export default defineConfig({
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          state: ['zustand']
        }
      }
    }
  }
})
```

## Coolify-Specific Features

### 1. Auto-SSL with Let's Encrypt
Coolify automatically provisions SSL certificates:
```yaml
labels:
  - coolify.managed=true
  - coolify.ssl=true
  - coolify.http2=true
```

### 2. Zero-Downtime Deployments
Configure rolling updates:
```yaml
deploy:
  replicas: 2
  update_config:
    parallelism: 1
    delay: 10s
    failure_action: rollback
```

### 3. Resource Monitoring
Coolify provides built-in monitoring:
- CPU/Memory usage graphs
- Container logs aggregation
- Health check status
- Deployment history

### 4. Backup Integration
Configure automatic backups:
```yaml
volumes:
  - backend_data:/app/data
  - redis_data:/data
  
backup:
  schedule: "0 2 * * *"  # Daily at 2 AM
  retention: 7  # Keep 7 days
```

## Health Checks

### Backend Health Endpoint
```python
@app.get("/health")
async def health_check():
    checks = {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "checks": {
            "database": await check_database(),
            "redis": await check_redis(),
            "storage": check_storage_access()
        }
    }
    return checks
```

### Docker Health Checks
```dockerfile
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1
```

## Performance Optimization

### 1. Multi-Stage Docker Builds
- Separate build and runtime stages
- Minimize final image size
- Cache Poetry dependencies

### 2. Redis Caching Strategy
```python
# Aggressive caching for analysis results
CACHE_PATTERNS = {
    "analysis_results": 3600,  # 1 hour
    "c3d_metadata": 86400,     # 24 hours
    "user_sessions": 1800       # 30 minutes
}
```

### 3. CDN for Static Assets
Configure Coolify to serve static files via CDN:
```yaml
environment:
  - CDN_URL=https://cdn.your-domain.com
  - STATIC_URL=${CDN_URL}/static
```

## Security Best Practices

### 1. Environment Variables
- Never commit secrets to git
- Use Coolify's secret management
- Rotate keys regularly

### 2. Network Security
```yaml
networks:
  frontend:
    internal: false
  backend:
    internal: true
  cache:
    internal: true
```

### 3. Container Security
- Run as non-root user
- Read-only root filesystem where possible
- Security scanning with Trivy

## Monitoring & Logging

### 1. Structured Logging
```python
logging.config.dictConfig({
    "version": 1,
    "handlers": {
        "json": {
            "class": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s"
        }
    }
})
```

### 2. Metrics Collection
- Prometheus metrics endpoint
- Custom business metrics
- Performance tracking

### 3. Error Tracking
Integration with Sentry or similar:
```python
if ENVIRONMENT == "production":
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment="production",
        traces_sample_rate=0.1
    )
```

## Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured in Coolify
- [ ] Supabase connection tested
- [ ] Redis service accessible
- [ ] Domain DNS configured
- [ ] SSL certificate ready

### Deployment Steps
1. [ ] Push code to repository
2. [ ] Trigger Coolify deployment
3. [ ] Monitor build logs
4. [ ] Verify health checks pass
5. [ ] Test critical paths

### Post-Deployment
- [ ] Verify SSL certificate active
- [ ] Check application logs
- [ ] Test webhook endpoints
- [ ] Monitor performance metrics
- [ ] Set up alerts

## Troubleshooting

### Common Issues

#### 1. ezc3d Library Loading
**Problem**: `ImportError: libezc3d.so not found`
**Solution**: Ensure `LD_LIBRARY_PATH` is set in Dockerfile:
```dockerfile
ENV LD_LIBRARY_PATH="/app/.venv/lib/python3.11/site-packages/ezc3d:$LD_LIBRARY_PATH"
```

#### 2. Poetry Dependencies
**Problem**: Build fails at Poetry install
**Solution**: Use multi-stage build with proper caching:
```dockerfile
RUN --mount=type=cache,target=/root/.cache/pypoetry \
    poetry install --only=main --no-root
```

#### 3. Frontend Build Memory
**Problem**: Frontend build runs out of memory
**Solution**: Increase Node memory limit:
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=4096"
```

### Debug Mode
Enable debug logging in Coolify:
```yaml
environment:
  - DEBUG=true
  - LOG_LEVEL=DEBUG
  - PYTHONUNBUFFERED=1
```

## Scaling Considerations

### Horizontal Scaling
```yaml
deploy:
  replicas: 3
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### Database Connection Pooling
```python
# Use connection pooling for Supabase
DATABASE_POOL_SIZE = 20
DATABASE_MAX_OVERFLOW = 10
DATABASE_POOL_TIMEOUT = 30
```

### Redis Cluster Mode
For high availability:
```yaml
redis:
  image: redis:7.2-alpine
  deploy:
    replicas: 3
    mode: replicated
```

## Maintenance

### Rolling Updates
```bash
# Coolify handles this automatically
# Manual trigger via CLI:
coolify deploy --service emg-backend --strategy rolling
```

### Database Migrations
```python
# Run migrations as init container
init_containers:
  - name: migrate
    image: backend:latest
    command: ["python", "-m", "alembic", "upgrade", "head"]
```

### Backup Strategy
1. **Database**: Supabase automatic backups
2. **Uploads**: S3-compatible storage with versioning
3. **Redis**: Periodic RDB snapshots

## Performance Benchmarks

### Expected Performance
- Backend response time: <200ms p95
- Frontend load time: <3s on 3G
- Analysis processing: <5s for typical C3D file
- Concurrent users: 100+ with 2 replicas

### Load Testing
```bash
# Use k6 or similar
k6 run --vus 50 --duration 30s load-test.js
```

## Support & Resources

- **Coolify Documentation**: https://coolify.io/docs
- **Docker Best Practices**: Apply multi-stage builds, layer caching
- **Monitoring**: Integrate with Coolify's built-in monitoring
- **Community**: Coolify Discord for deployment help

## Notes

- Coolify simplifies many Docker deployment complexities
- Use Coolify's magic variables for automatic configuration
- Leverage Coolify's built-in features (SSL, monitoring, backups)
- Keep containers stateless for easy scaling
- Monitor resource usage and adjust limits as needed