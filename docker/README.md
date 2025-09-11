# Docker Infrastructure - EMG C3D Analyzer

> **Note for the team taking over the project**: This document centralizes all Docker configuration to facilitate maintenance and deployment. Everything is organized and ready to use.

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Docker Compose vs Coolify](#-docker-compose-vs-coolify)
3. [Project Structure](#-project-structure)
4. [Auto-Restart & Health Checks](#-auto-restart--health-checks)
5. [Environment Configuration](#-environment-configuration)
6. [Deployment Options](#-deployment-options)
7. [Redis Configuration](#-redis-configuration-optional)
8. [Troubleshooting](#-troubleshooting)
9. [Official Documentation](#-official-documentation)

## 🚀 Quick Start

### Development Environment
```bash
# Start development with hot-reload
docker-compose -f docker/compose/docker-compose.yml up

# Backend: http://localhost:8080
# Frontend: http://localhost:3000
```

### Analytics Platform (Metabase) - For Researchers
```bash
# Start Metabase analytics platform
docker-compose -f docker/compose/docker-compose.metabase.yml up -d

# Analytics Dashboard: http://localhost:3001
# See docker/docs/RESEARCHER_GUIDE.md for usage
```

### Production Deployment (Coolify)
```bash
# Coolify will use docker-compose.coolify.yml automatically
# See docker/docs/DEPLOYMENT_COOLIFY.md for complete guide
```

## 🔄 Docker Compose vs Coolify

### Docker Compose
**Advantages:**
- ✅ Simple and standard
- ✅ Full control over configuration
- ✅ Works anywhere Docker is installed
- ✅ Free and open source
- ✅ Ideal for local development

**Disadvantages:**
- ❌ Manual deployment
- ❌ No graphical interface
- ❌ Requires server administration knowledge

**When to use:** Local development, test environments, small technical teams

### Coolify
**Advantages:**
- ✅ Intuitive web interface
- ✅ Automatic SSL certificates (Let's Encrypt)
- ✅ Integrated monitoring and logs
- ✅ Automatic deployment from Git
- ✅ Health checks and automatic restarts
- ✅ Simplified management for non-DevOps teams

**Disadvantages:**
- ❌ Additional abstraction layer
- ❌ Less flexibility for custom configurations
- ❌ Requires a Coolify instance

**When to use:** Production, non-technical teams, automated deployments

### 📊 Recommendation
- **Development/Staging**: Docker Compose
- **Production**: Coolify (simpler for non-DevOps colleagues)

## 📁 Project Structure

```
docker/
├── compose/
│   ├── docker-compose.yml          # Main development configuration
│   ├── docker-compose.prod.yml     # Production configuration
│   ├── docker-compose.coolify.yml  # Coolify-specific deployment
│   └── docker-compose.metabase.yml # Analytics platform for researchers
├── backend/
│   ├── Dockerfile                  # Production multi-stage build
│   ├── Dockerfile.dev              # Development with hot-reload
│   └── .dockerignore              # Backend ignore rules
├── frontend/
│   ├── Dockerfile                  # Production build
│   ├── Dockerfile.dev              # Development with hot-reload
│   └── .dockerignore              # Frontend ignore rules
├── docs/
│   ├── DEPLOYMENT_COOLIFY.md       # Complete Coolify guide
│   ├── METABASE_ANALYTICS.md       # Metabase setup and configuration
│   ├── RESEARCHER_GUIDE.md         # Analytics guide for researchers
│   └── README.md                   # This file
└── .env.example                    # Environment template
```

## 🔁 Auto-Restart & Health Checks

**All services are configured with automatic restart policies!**

### Restart Policies
```yaml
# Production (Coolify & docker-compose.prod.yml)
restart: unless-stopped  # Redémarre sauf si arrêté manuellement

# Development (docker-compose.yml)
restart: on-failure      # Redémarre uniquement en cas d'erreur
```

### Health Checks Configuration
```yaml
# Backend Service
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s

# Frontend Service  
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/"]
  interval: 30s
  timeout: 10s
  retries: 3

# Redis Service
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 3
```

### How Auto-Restart Works
1. **Health Check Failure**: Service unhealthy after 3 retries
2. **Automatic Restart**: Docker/Coolify restarts the container
3. **Recovery**: Service comes back online
4. **Monitoring**: Continuous health monitoring

## 🔧 Environment Configuration

### Required Variables
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Security
SECRET_KEY=your-secret-key
WEBHOOK_SECRET=your-webhook-secret

# Environment
ENVIRONMENT=production  # or development
LOG_LEVEL=INFO
DEBUG=false
```

### Copy Environment Template
```bash
cp docker/.env.example .env
# Edit .env with your values
```

## 🚢 Deployment Options

### Option 1: Docker Compose (Manual)
```bash
# Development
docker-compose -f docker/compose/docker-compose.yml up

# Production
docker-compose -f docker/compose/docker-compose.prod.yml up -d
```

### Option 2: Coolify (Recommended for Production)
1. Push code to Git repository
2. Configure Coolify project
3. Point to `docker/compose/docker-compose.coolify.yml`
4. Deploy automatically

See `docker/docs/DEPLOYMENT_COOLIFY.md` for detailed instructions.

### Option 3: Metabase Analytics Platform (Researchers)
```bash
# Start analytics platform
docker-compose -f docker/compose/docker-compose.metabase.yml up -d

# Access at http://localhost:3001
# See docker/docs/RESEARCHER_GUIDE.md for detailed usage
```

### Option 4: Self-Hosted Supabase (Future)
Template available in `DEPLOYMENT_COOLIFY.md` (lines 410-529) for complete self-hosted stack.

## 🔴 Redis Configuration (Optional)

**Note**: Redis can be disabled if time constraints exist.

### To Disable Redis:
1. Comment out Redis service in compose files
2. Remove Redis environment variables
3. Backend will fallback to in-memory caching

```yaml
# Comment these lines in docker-compose files:
# redis:
#   image: redis:7.2-alpine
#   ...

# Remove from backend environment:
# REDIS_URL=redis://redis:6379/0
```

## 🐛 Troubleshooting

### Common Issues

#### Backend Connection Timeout
```bash
# Check if backend is running
docker ps | grep backend

# Check logs
docker logs emg-backend

# Restart backend
docker-compose restart backend
```

#### Health Check Failures
```bash
# Test health endpoints manually
curl http://localhost:8080/health      # Backend
curl http://localhost:3000             # Frontend
docker exec emg-redis redis-cli ping   # Redis
```

#### Memory Issues
```bash
# Check container resources
docker stats

# Increase memory limits in compose file if needed
```

## 📚 Official Documentation

### Docker & Docker Compose
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)

### Coolify
- [Coolify Documentation](https://coolify.io/docs)
- [Coolify Docker Compose Guide](https://coolify.io/docs/docker-compose)

### Supabase
- [Supabase Self-Hosting](https://supabase.com/docs/guides/self-hosting)
- [Supabase Docker](https://github.com/supabase/supabase/tree/master/docker)

### FastAPI & React
- [FastAPI Docker Guide](https://fastapi.tiangolo.com/deployment/docker/)
- [React Docker Best Practices](https://mherman.org/blog/dockerizing-a-react-app/)

---

## 📝 Notes for Project Handover

**For colleagues taking over the project:**

1. **Everything is automated** - Health checks and restart policies are already configured
2. **Coolify is recommended** for production - Simpler without DevOps knowledge
3. **Complete documentation** in `docker/docs/DEPLOYMENT_COOLIFY.md`
4. **Redis is optional** - Can be disabled if time constraints exist
5. **Metabase Analytics** - Ready-to-use platform for researchers in `docker/docs/RESEARCHER_GUIDE.md`
6. **Self-hosted Supabase support** - Template ready for complete installation

### Contact & Support
- See Coolify documentation for production deployment
- Docker configurations are tested and ready to use
- All environment variables are documented
- Metabase platform configured for research analytics

---

*Last Updated: September 2025*
*Good luck with the project! 🚀*