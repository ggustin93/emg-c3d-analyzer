---
sidebar_position: 1
title: Docker Overview
---

# Docker Configuration

Multi-container architecture for development and production environments.

## Container Structure

```yaml
# docker-compose.yml
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    
  backend:
    build: ./backend
    ports: ["8080:8080"]
    depends_on: [redis]
    
  redis:
    image: redis:7.2-alpine
    ports: ["6379:6379"]
    
  nginx:
    build: ./nginx
    ports: ["80:80", "443:443"]
    depends_on: [frontend, backend]
```

## Development Setup

```bash
# Start all containers
./start_dev.sh

# Rebuild and start
./start_dev.sh --rebuild

# View logs
docker-compose logs -f

# Stop all containers
docker-compose down
```

## Production Images

### Frontend Dockerfile
```dockerfile
# Multi-stage build for optimization
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

### Backend Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

## Key Features

- Multi-stage builds for smaller images
- Layer caching for faster builds
- Health checks for container monitoring
- Volume mounts for development
- Environment-specific configurations

## Performance

- **Frontend Image**: ~50MB (production)
- **Backend Image**: ~150MB (with dependencies)
- **Build Time**: ~3 minutes (with cache)
- **Cold Start**: <10 seconds