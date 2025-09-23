# Docker Configuration for EMG C3D Analyzer

## 📋 Overview

This directory contains Docker configurations for containerized deployment of the EMG C3D Analyzer platform. The setup supports multiple deployment scenarios: local development, production deployment, analytics platform, and self-hosted infrastructure.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Docker Compose Orchestration                      │
├────────────┬────────────┬────────────┬────────────┬───────────────────┤
│   Frontend │   Backend  │    Redis   │  Metabase  │  Supabase (Cloud)  │
│  (React)   │ (FastAPI)  │   (Cache)  │ (Analytics)│    (Database)      │
├────────────┴────────────┴────────────┴────────────┴───────────────────┤
│                         Docker Network (Bridge)                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📁 Structure

```
docker/
├── compose/                         # Docker Compose configurations
│   ├── docker-compose.dev.yml      # Local development environment
│   ├── docker-compose.staging.yml  # Staging (Digital Ocean + Coolify Cloud)
│   ├── docker-compose.production.yml # Production (VUB Self-hosted Coolify)
│   └── archive/                     # Previous configurations for reference
├── backend/                         # Backend Docker configurations
│   └── Dockerfile                  # Multi-stage Python/FastAPI build
├── frontend/                        # Frontend Docker configurations
│   ├── Dockerfile                  # Multi-stage React/Vite build
│   └── nginx.conf                 # Production nginx configuration
└── docs/                           # Docker-specific documentation
    ├── METABASE_ANALYTICS.md       # Metabase setup guide
    └── RESEARCHER_GUIDE.md         # Research analytics guide
```

## 🚀 Quick Start

### Development Environment

```bash
# Start development services
./start_dev_docker.sh

# Or using Docker Compose directly
cd docker/compose
docker compose -f docker-compose.dev.yml up -d

# Access services
# Frontend: http://localhost:3000
# Backend API: http://localhost:8080
# API Docs: http://localhost:8080/docs
```

### Staging Deployment (Digital Ocean + Coolify Cloud)

```bash
# Using startup script
./start_dev_docker.sh --staging

# Or directly with Docker Compose
cd docker/compose
docker compose -f docker-compose.staging.yml up -d
```

### Production Deployment (VUB Self-hosted Coolify)

```bash
# Using startup script
./start_dev_docker.sh --production

# Or directly with Docker Compose
cd docker/compose
VERSION=1.0.0 docker compose -f docker-compose.production.yml up -d
```

### Optional Services

```bash
# Enable Redis caching (uncomment in compose file or set env var)
ENABLE_REDIS=true docker compose -f docker-compose.dev.yml up -d

# Enable Metabase analytics (uncomment service in compose file)
ENABLE_METABASE=true docker compose -f docker-compose.staging.yml up -d
```

## 🔧 Configuration

### Environment Variables

Create environment-specific `.env` files in the project root:

- `.env.dev` - Development settings
- `.env.staging` - Staging configuration  
- `.env.production` - Production secrets

Example `.env.dev`:

```env
# Supabase Configuration (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here

# Frontend Configuration
VITE_API_URL=http://localhost:8080
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}

# Backend Configuration
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO
SECRET_KEY=your-secret-key-here
WEBHOOK_SECRET=your-webhook-secret

# Redis Configuration
REDIS_URL=redis://redis:6379/0
REDIS_CACHE_TTL_SECONDS=3600
REDIS_MAX_CACHE_SIZE_MB=100

# Docker Build Configuration
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1
TARGETPLATFORM=linux/amd64

# Optional Services Toggle
ENABLE_REDIS=false        # Set to true to enable caching
ENABLE_METABASE=false    # Set to true for analytics
SUPABASE_MODE=cloud      # Options: cloud or selfhosted
```

### ARM64/Apple Silicon Support

The Docker configurations include full support for ARM64 architectures (Apple M1/M2/M3):

```dockerfile
# Automatic platform detection
ARG TARGETPLATFORM
ARG BUILDPLATFORM
FROM --platform=${BUILDPLATFORM:-linux/amd64} node:20-slim
```

For Apple Silicon Macs, the build will automatically use Rosetta 2 emulation when needed.

## 📦 Services

### Environment-Specific Configurations

| Environment | Core Services | Optional Services | Deployment Target |
|-------------|--------------|-------------------|-------------------|
| **Development** | Backend, Frontend | Redis, Metabase | Local machine |
| **Staging** | Backend, Frontend, Nginx* | Redis, Metabase, Supabase† | Digital Ocean (Coolify Cloud) |
| **Production** | Backend, Frontend, Nginx | Redis, Metabase, Supabase† | VUB (Self-hosted Coolify) |

*Nginx included if SSL needed  
†Can toggle between cloud and self-hosted Supabase

## 📦 Service Details

### Backend (FastAPI)

- **Container**: `emg-backend`
- **Port**: 8080
- **Features**: EMG processing, C3D file analysis, REST API
- **Health Check**: `/health` endpoint
- **Volumes**: Data persistence for uploads and results

### Frontend (React)

- **Container**: `emg-frontend`
- **Port**: 3000
- **Features**: Interactive UI, real-time charts, data visualization
- **Build**: Vite with TypeScript
- **Production**: Nginx serving static files

### Redis Cache

- **Container**: `emg-redis`
- **Port**: 6379
- **Features**: Session caching, computation results
- **Optional**: Redis Insight GUI (port 5540)

### Metabase Analytics

- **Container**: `emg-metabase`
- **Port**: 3001
- **Features**: Business intelligence, custom dashboards
- **Database**: Dedicated PostgreSQL for metadata

## 🛠️ Build Commands

### Development Build

```bash
# Build with caching
docker compose build --no-cache

# Build specific service
docker compose build backend

# Build with BuildKit (faster)
DOCKER_BUILDKIT=1 docker compose build
```

### Production Build

```bash
# Multi-stage optimized build
docker compose -f docker-compose.prod.yml build

# Build with version tag
VERSION=1.0.0 docker compose -f docker-compose.prod.yml build
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Rollup Native Module Error (ARM64)

**Error**: `Cannot find module @rollup/rollup-linux-arm64-gnu`

**Solution**: Already fixed in Dockerfiles with platform configuration and npm workarounds.

#### 2. Port Conflicts

**Error**: `bind: address already in use`

**Solution**:
```bash
# Check what's using the port
lsof -i :3000
lsof -i :8080

# Stop conflicting services or change ports in docker-compose.yml
```

#### 3. Docker Storage Issues

**Error**: `input/output error`

**Solution**:
```bash
# Clean Docker system
docker system prune -a --volumes

# Restart Docker Desktop
# macOS: Quit and restart Docker Desktop app
```

#### 4. Environment Variables Not Loading

**Error**: Services can't connect to Supabase

**Solution**:
```bash
# Ensure .env file exists
cp .env.example .env
# Edit .env with your values

# Load in Docker Compose
docker compose --env-file .env up
```

### Health Checks

```bash
# Check service health
docker compose ps

# View logs
docker compose logs backend
docker compose logs frontend

# Execute commands in container
docker compose exec backend /bin/bash
docker compose exec frontend /bin/sh
```

## 🚢 Deployment Options

### 1. Coolify (Recommended)

Use `docker-compose.coolify.yml` for automated deployment with:
- Automatic SSL certificates
- Built-in monitoring
- Zero-downtime deployments
- Automatic health checks

### 2. Traditional VPS

Use `docker-compose.prod.yml` with:
- Manual SSL setup (Let's Encrypt)
- External monitoring (Prometheus/Grafana)
- Manual backup configuration

### 3. Kubernetes

Convert compose files using Kompose:
```bash
kompose convert -f docker-compose.prod.yml
```

## 📊 Performance Optimization

### Resource Limits

Production configurations include resource constraints:

```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.5'
```

### Caching Strategy

- **BuildKit**: Inline cache for faster builds
- **Layer Caching**: Multi-stage builds optimize layer reuse
- **Volume Mounts**: Persistent data reduces initialization time

## 🔒 Security Considerations

1. **Never commit secrets** - Use environment variables
2. **Use specific image tags** in production (not `latest`)
3. **Enable health checks** for all services
4. **Implement rate limiting** in production
5. **Use SSL/TLS** for all external connections
6. **Regular updates** of base images and dependencies

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [FastAPI Docker Guide](https://fastapi.tiangolo.com/deployment/docker/)
- [React Docker Best Practices](https://mherman.org/blog/dockerizing-a-react-app/)
- [Supabase Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting)

## 🤝 Contributing

When modifying Docker configurations:

1. Test builds on both AMD64 and ARM64 architectures
2. Update this README with any new configurations
3. Ensure all services have health checks
4. Document environment variables
5. Follow multi-stage build patterns

## 📝 License

Part of the EMG C3D Analyzer project. See main project README for license information.