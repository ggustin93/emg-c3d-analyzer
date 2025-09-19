---
sidebar_position: 7
title: Deployment Patterns
---

# Production Deployment Architecture

The backend implements cloud-native deployment patterns with comprehensive monitoring, automated scaling, and production-grade reliability for EMG processing workloads.

## Deployment Overview

### Production Architecture

```
Internet → Load Balancer → FastAPI Backend → Supabase Platform
    ↓           ↓              ↓                ↓
   CDN     Health Checks   Redis Cache    PostgreSQL + Storage
   ↓           ↓              ↓                ↓
Logging    Monitoring     Background      Row Level Security
```

**Key Components**:
- **FastAPI Backend**: Containerized Python application with uvicorn ASGI server
- **Redis Cache**: Performance optimization and session management
- **Supabase Platform**: Managed PostgreSQL database and file storage
- **Monitoring Stack**: Application performance monitoring and alerting
- **Container Orchestration**: Docker with optional Kubernetes deployment

### Environment Strategy

```yaml
environments:
  development:
    purpose: "Local development and testing"
    database: "Local PostgreSQL or Supabase development project"
    cache: "Local Redis instance"
    storage: "Local filesystem or Supabase storage"
    
  staging:
    purpose: "Pre-production testing and validation"
    database: "Dedicated Supabase staging project"
    cache: "Managed Redis (Redis Cloud or similar)"
    storage: "Supabase Storage with test data"
    
  production:
    purpose: "Live EMG processing and clinical workflows"
    database: "Production Supabase project with backups"
    cache: "High-availability Redis cluster"
    storage: "Supabase Storage with redundancy"
```

## Containerization Strategy

### Docker Configuration

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --create-home --shell /bin/bash emg_user

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Change ownership to non-root user
RUN chown -R emg_user:emg_user /app
USER emg_user

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Production server command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "4"]
```

### Multi-stage Build Optimization

```dockerfile
# backend/Dockerfile.optimized
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim as production

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local

# Update PATH
ENV PATH=/root/.local/bin:$PATH

# Create non-root user
RUN useradd --create-home --shell /bin/bash emg_user

# Set work directory
WORKDIR /app

# Copy application code
COPY . .
RUN chown -R emg_user:emg_user /app

USER emg_user

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Production server with optimized workers
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker"]
```

### Docker Compose for Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=redis://redis:6379/0
      - LOG_LEVEL=INFO
    depends_on:
      - redis
    volumes:
      - ./backend:/app
      - /app/__pycache__
    networks:
      - emg_network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - emg_network
    command: redis-server --appendonly yes

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend
    networks:
      - emg_network

volumes:
  redis_data:

networks:
  emg_network:
    driver: bridge
```

## Environment Configuration

### Configuration Management

```python
# config.py
from pydantic import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Environment-based configuration management"""
    
    # Application settings
    APP_NAME: str = "EMG C3D Analyzer"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8080
    WORKERS: int = 4
    
    # Database settings
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_ANON_KEY: Optional[str] = None
    
    # Cache settings
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL: int = 3600
    
    # Security settings
    JWT_SECRET: str
    SUPABASE_WEBHOOK_SECRET: str
    CORS_ORIGINS: list = ["http://localhost:3000"]
    
    # Processing settings
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB
    PROCESSING_TIMEOUT: int = 300  # 5 minutes
    
    # Monitoring settings
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    SENTRY_DSN: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Environment-specific configurations
class DevelopmentSettings(Settings):
    DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"
    CORS_ORIGINS: list = ["http://localhost:3000", "http://127.0.0.1:3000"]

class ProductionSettings(Settings):
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    WORKERS: int = 8  # More workers for production
    ENABLE_METRICS: bool = True

class TestingSettings(Settings):
    DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"
    SUPABASE_URL: str = "https://test-project.supabase.co"
    REDIS_URL: str = "redis://localhost:6379/1"  # Different Redis DB

def get_settings() -> Settings:
    """Get settings based on environment"""
    environment = os.getenv("ENVIRONMENT", "development").lower()
    
    if environment == "production":
        return ProductionSettings()
    elif environment == "testing":
        return TestingSettings()
    else:
        return DevelopmentSettings()

settings = get_settings()
```

### Environment Files

```bash
# .env.development
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-jwt-secret
SUPABASE_WEBHOOK_SECRET=your-webhook-secret

REDIS_URL=redis://localhost:6379/0

CORS_ORIGINS=["http://localhost:3000"]
```

```bash
# .env.production
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO

SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_SERVICE_KEY=prod-service-key
JWT_SECRET=secure-production-jwt-secret
SUPABASE_WEBHOOK_SECRET=secure-webhook-secret

REDIS_URL=redis://redis-cluster.company.com:6379/0

CORS_ORIGINS=["https://emg-analyzer.company.com"]

# Monitoring
SENTRY_DSN=https://your-sentry-dsn.ingest.sentry.io
ENABLE_METRICS=true
```

## Production Optimizations

### Uvicorn Server Configuration

```python
# production_server.py
import uvicorn
from multiprocessing import cpu_count

def run_production_server():
    """Production-optimized server configuration"""
    
    # Calculate optimal worker count
    worker_count = min(cpu_count() * 2 + 1, 8)  # Cap at 8 workers
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=worker_count,
        worker_class="uvicorn.workers.UvicornWorker",
        access_log=True,
        log_level=settings.LOG_LEVEL.lower(),
        reload=False,  # Never reload in production
        
        # Performance optimizations
        loop="uvloop",  # High-performance event loop
        http="httptools",  # Fast HTTP parser
        
        # SSL configuration (if needed)
        ssl_keyfile=settings.SSL_KEYFILE if hasattr(settings, 'SSL_KEYFILE') else None,
        ssl_certfile=settings.SSL_CERTFILE if hasattr(settings, 'SSL_CERTFILE') else None,
        
        # Graceful shutdown
        timeout_keep_alive=5,
        timeout_graceful_shutdown=30
    )

if __name__ == "__main__":
    run_production_server()
```

### Application Factory Pattern

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import structlog

def create_app() -> FastAPI:
    """Application factory for different environments"""
    
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
        
        # Production optimizations
        docs_url="/docs" if settings.DEBUG else None,  # Disable docs in production
        redoc_url="/redoc" if settings.DEBUG else None,
    )
    
    # Configure structured logging
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # Add middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # Add custom middleware
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(MetricsMiddleware)
    
    # Include routers
    from api.routes import upload, webhooks, therapy_sessions, health
    
    app.include_router(upload.router, prefix="/upload", tags=["upload"])
    app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
    app.include_router(therapy_sessions.router, prefix="/sessions", tags=["sessions"])
    app.include_router(health.router, prefix="/health", tags=["health"])
    
    return app

app = create_app()
```

## Health Checks and Monitoring

### Comprehensive Health Checks

```python
# api/routes/health.py
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
import asyncio
import time

router = APIRouter()

@router.get("/")
async def basic_health_check():
    """Basic health check for load balancer"""
    return {"status": "healthy", "timestamp": time.time()}

@router.get("/detailed")
async def detailed_health_check(
    supabase_client = Depends(get_supabase_client),
    redis_client = Depends(get_redis_client)
) -> Dict[str, Any]:
    """Detailed health check with dependency validation"""
    
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT if hasattr(settings, 'ENVIRONMENT') else "unknown",
        "checks": {}
    }
    
    # Check database connectivity
    try:
        start_time = time.time()
        response = supabase_client.table('therapy_sessions').select('id').limit(1).execute()
        db_duration = time.time() - start_time
        
        health_status["checks"]["database"] = {
            "status": "healthy",
            "response_time_ms": round(db_duration * 1000, 2)
        }
    except Exception as e:
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    # Check Redis connectivity
    try:
        start_time = time.time()
        redis_client.ping()
        redis_duration = time.time() - start_time
        
        health_status["checks"]["cache"] = {
            "status": "healthy",
            "response_time_ms": round(redis_duration * 1000, 2)
        }
    except Exception as e:
        health_status["checks"]["cache"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    # Check EMG processing capability
    try:
        from backend.services.c3d.processor import GHOSTLYC3DProcessor
        processor = GHOSTLYC3DProcessor()
        
        health_status["checks"]["emg_processor"] = {
            "status": "healthy",
            "processor_initialized": True
        }
    except Exception as e:
        health_status["checks"]["emg_processor"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    # Overall status determination
    unhealthy_checks = [
        check for check in health_status["checks"].values() 
        if check["status"] == "unhealthy"
    ]
    
    if unhealthy_checks:
        health_status["status"] = "unhealthy"
        # Return 503 for unhealthy status
        raise HTTPException(status_code=503, detail=health_status)
    
    return health_status

@router.get("/readiness")
async def readiness_check():
    """Kubernetes readiness probe"""
    # Check if application is ready to receive traffic
    try:
        # Verify critical dependencies are available
        supabase_client = get_supabase_client()
        redis_client = get_redis_client()
        
        # Quick connectivity test
        supabase_client.table('therapy_sessions').select('id').limit(1).execute()
        redis_client.ping()
        
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail={"status": "not_ready", "error": str(e)})

@router.get("/liveness")
async def liveness_check():
    """Kubernetes liveness probe"""
    # Check if application is alive (simpler than readiness)
    return {"status": "alive", "timestamp": time.time()}
```

### Application Metrics

```python
# monitoring/metrics.py
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi import Response
import time

# Define metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code']
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

EMG_PROCESSING_DURATION = Histogram(
    'emg_processing_duration_seconds',
    'EMG processing duration in seconds',
    ['session_type']
)

ACTIVE_SESSIONS = Gauge(
    'active_sessions_total',
    'Number of active processing sessions'
)

CACHE_HIT_RATE = Gauge(
    'cache_hit_rate',
    'Cache hit rate percentage'
)

class MetricsMiddleware:
    """Middleware to collect application metrics"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            start_time = time.time()
            
            # Extract request info
            method = scope["method"]
            path = scope["path"]
            
            # Process request
            await self.app(scope, receive, send)
            
            # Record metrics
            duration = time.time() - start_time
            REQUEST_DURATION.labels(method=method, endpoint=path).observe(duration)
            
        else:
            await self.app(scope, receive, send)

@router.get("/metrics")
async def prometheus_metrics():
    """Prometheus metrics endpoint"""
    return Response(
        content=generate_latest(),
        media_type="text/plain"
    )
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths: ['backend/**']
  pull_request:
    branches: [main]
    paths: ['backend/**']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: emg-c3d-analyzer/backend

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
      
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python 3.11
      uses: actions/setup-python@v4
      with:
        python-version: 3.11
    
    - name: Install dependencies
      run: |
        cd backend
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-dev.txt
    
    - name: Run tests
      env:
        SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
        SUPABASE_SERVICE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_KEY }}
        REDIS_URL: redis://localhost:6379/1
      run: |
        cd backend
        python -m pytest tests/ -v --cov=backend --cov-report=xml
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./backend/coverage.xml
        flags: backend

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
    
    steps:
    - name: Checkout
      uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}
    
    - name: Build and push Docker image
      id: build
      uses: docker/build-push-action@v4
      with:
        context: ./backend
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy to production
      # This would integrate with your deployment platform
      # Examples: AWS ECS, Google Cloud Run, Kubernetes, etc.
      run: |
        echo "Deploying image digest: ${{ needs.build.outputs.image-digest }}"
        # Add your deployment commands here
```

## Production Deployment Examples

### Google Cloud Run Deployment

```yaml
# deploy/cloudrun.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: emg-c3d-analyzer-backend
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/execution-environment: gen2
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "2Gi"
        run.googleapis.com/cpu: "2"
        autoscaling.knative.dev/maxScale: "10"
        autoscaling.knative.dev/minScale: "1"
    spec:
      containerConcurrency: 100
      timeoutSeconds: 300
      containers:
      - image: gcr.io/your-project/emg-c3d-analyzer-backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: ENVIRONMENT
          value: "production"
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: supabase-config
              key: url
        - name: SUPABASE_SERVICE_KEY
          valueFrom:
            secretKeyRef:
              name: supabase-config
              key: service-key
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-config
              key: url
        resources:
          limits:
            cpu: "2"
            memory: "2Gi"
          requests:
            cpu: "1"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /health/liveness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

### AWS ECS Deployment

```json
{
  "family": "emg-c3d-analyzer-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-account.dkr.ecr.region.amazonaws.com/emg-c3d-analyzer-backend:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "ENVIRONMENT",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "SUPABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:supabase-config:url::"
        },
        {
          "name": "SUPABASE_SERVICE_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:supabase-config:service-key::"
        }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/emg-c3d-analyzer-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## Security Considerations

### Production Security Checklist

```python
# security/production_checklist.py
PRODUCTION_SECURITY_CHECKLIST = {
    "environment_variables": {
        "✅ All secrets in environment variables, not code": True,
        "✅ Different secrets for each environment": True,
        "✅ JWT_SECRET is cryptographically strong": True,
        "✅ WEBHOOK_SECRET is unique and secure": True
    },
    
    "network_security": {
        "✅ HTTPS only in production": True,
        "✅ CORS origins restricted to allowed domains": True,
        "✅ Rate limiting configured": True,
        "✅ DDoS protection enabled": True
    },
    
    "application_security": {
        "✅ Debug mode disabled in production": True,
        "✅ API documentation disabled in production": True,
        "✅ Error messages don't expose internal details": True,
        "✅ File upload size limits enforced": True
    },
    
    "database_security": {
        "✅ Row Level Security policies enabled": True,
        "✅ Service key has minimal required permissions": True,
        "✅ Database backups configured": True,
        "✅ Connection encryption enabled": True
    },
    
    "monitoring_security": {
        "✅ Structured logging configured": True,
        "✅ Security events monitored": True,
        "✅ Failed authentication attempts tracked": True,
        "✅ Webhook signature validation logs": True
    }
}
```

## Next Steps

- [Backend Overview](./overview) - Return to architecture fundamentals
- [API Design](./api-design) - API patterns and endpoint design
- [Testing Strategy](./testing-strategy) - Production testing approaches
- [Caching with Redis](./caching-redis) - Performance optimization in production