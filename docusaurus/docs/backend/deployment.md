---
sidebar_position: 7
title: Deployment
---

# Deployment

Simple deployment options for the FastAPI backend.

## Development

```bash
cd backend
uvicorn main:app --reload --port 8080
```

## Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

```bash
docker build -t emg-backend .
docker run -p 8080:8080 emg-backend
```

## Environment Variables

Required for production:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-jwt-secret
REDIS_URL=redis://localhost:6379
```

## Production Considerations

- Use gunicorn for production WSGI server
- Set up reverse proxy (nginx)
- Configure SSL certificates
- Set up monitoring and logging
- Use managed Redis (not local)

## Health Check

`GET /health` endpoint for load balancer health checks.

## Files

- `backend/Dockerfile` - Container configuration
- `backend/main.py` - FastAPI app configuration
- `backend/config.py` - Environment settings