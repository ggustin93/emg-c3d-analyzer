---
sidebar_position: 1
title: Backend Deployment
---

# Backend Deployment

Deployment and infrastructure configuration for the GHOSTLY+ FastAPI backend.

## Development Environment

```bash
cd backend
uvicorn main:app --reload --port 8080
```

## Docker Deployment

### Dockerfile Configuration

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Building and Running

```bash
docker build -t emg-backend .
docker run -p 8080:8080 emg-backend
```

## Environment Variables

Required for production deployment:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Authentication
JWT_SECRET=your-jwt-secret

# Redis Cache
REDIS_URL=redis://localhost:6379

# Webhook Security
SUPABASE_WEBHOOK_SECRET=your-webhook-secret
```

## Production Infrastructure

### WSGI Server Configuration

Use gunicorn for production:

```bash
gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8080
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name api.ghostly-plus.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL Configuration

- Use Let's Encrypt for SSL certificates
- Configure automatic renewal with certbot
- Enforce HTTPS-only access

## Monitoring & Health Checks

### Health Check Endpoint

`GET /health` - Returns system status for load balancers

```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }
```

### Monitoring Setup

- **Logging**: Structured JSON logs to stdout/stderr
- **Metrics**: Prometheus endpoints for monitoring
- **APM**: Application Performance Monitoring with New Relic or DataDog
- **Alerts**: PagerDuty integration for critical issues

## Infrastructure Components

### Managed Services

- **Redis**: Use managed Redis (AWS ElastiCache, Redis Cloud)
- **Database**: Supabase managed PostgreSQL
- **Storage**: Supabase Storage for C3D files
- **CDN**: CloudFlare for static assets

### Scaling Considerations

- Horizontal scaling with multiple FastAPI instances
- Redis connection pooling for high concurrency
- Database connection pooling via Supabase
- Background task queue for heavy processing

## Deployment Files

- `backend/Dockerfile` - Container configuration
- `backend/main.py` - FastAPI app configuration
- `backend/config.py` - Environment settings
- `backend/requirements.txt` - Python dependencies