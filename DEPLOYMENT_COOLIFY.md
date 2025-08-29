# EMG C3D Analyzer - Coolify Deployment Guide

Comprehensive deployment guide for production deployment on Coolify platform.

## Overview

This guide covers deploying the EMG C3D Analyzer (FastAPI + React + Redis) on Coolify, a self-hosted PaaS alternative to Heroku/Vercel. The configuration is optimized for production with proper health checks, logging, and security.

## Prerequisites

### Coolify Platform
- Coolify v4.x server running and accessible
- Docker support enabled
- SSL/TLS certificates configured

### Required Services
- **Supabase Project**: PostgreSQL database, authentication, and file storage
- **Repository Access**: GitHub/GitLab repository with deployment keys
- **Domain Configuration**: Custom domain or Coolify subdomain

## Quick Start

### 1. Repository Setup

Ensure your repository contains the optimized files:

```bash
# Verify required files exist
ls -la docker-compose.coolify.yml    # ✅ Production docker-compose
ls -la .env.coolify.example          # ✅ Environment template
ls -la backend/Dockerfile            # ✅ Multi-stage backend build
ls -la frontend/Dockerfile           # ✅ Multi-stage frontend build
```

### 2. Coolify Project Creation

1. **Create New Project** in Coolify dashboard
2. **Select Docker Compose** deployment type
3. **Configure Repository**: Connect your Git repository
4. **Select Branch**: Choose your production branch (typically `main`)
5. **Set Compose File**: Point to `docker-compose.coolify.yml`

### 3. Environment Variables Configuration

Copy `.env.coolify.example` content and configure in Coolify:

#### Required Variables
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key

# Security
SECRET_KEY=your-generated-secret-key
WEBHOOK_SECRET=your-webhook-secret
```

#### Auto-Configured by Coolify
```bash
# These are automatically provided
COOLIFY_PUBLIC_URL=https://your-app.your-coolify-domain.com
```

#### Production Defaults (No changes needed)
```bash
ENVIRONMENT=production
LOG_LEVEL=INFO
DEBUG=false
REDIS_URL=redis://redis:6379/0
```

### 4. Deploy

1. Click **Deploy** in Coolify dashboard
2. Monitor build logs for any issues
3. Verify all services are healthy
4. Access application at your configured domain

## Architecture Details

### Service Configuration

#### Backend Service
```yaml
backend:
  - Port: 8080 (internal)
  - Health Check: GET /health
  - Volumes: backend_data, backend_logs
  - Dependencies: redis (healthy)
```

#### Frontend Service  
```yaml
frontend:
  - Port: 8080 (internal)
  - Public Entry Point: ✅
  - Health Check: GET /health
  - Dependencies: backend (healthy)
```

#### Redis Service
```yaml
redis:
  - Image: redis:7.2-alpine
  - Memory Limit: 300MB
  - Persistence: enabled
  - Configuration: LRU eviction policy
```

### Health Checks

All services include comprehensive health monitoring:

- **Backend**: HTTP health endpoint with 30s intervals
- **Frontend**: nginx status check with 30s intervals  
- **Redis**: Redis PING command with 10s intervals

### Storage & Persistence

#### Volumes
- **redis_data**: Redis persistence
- **backend_data**: Application data storage
- **backend_logs**: Centralized logging

#### File Storage
Application uses Supabase Storage for C3D files:
- Bucket: `c3d-examples`
- Webhook integration for automated processing
- Secure file access with RLS policies

## Production Features

### Security
- **Non-root containers**: All services run as non-privileged users
- **Minimal attack surface**: Alpine-based images with minimal dependencies
- **Environment isolation**: Production-specific configuration
- **RLS Security**: Database-level security with Supabase

### Performance
- **Multi-stage builds**: Optimized Docker images
- **Redis caching**: 7200s TTL with 200MB memory limit
- **Health monitoring**: Automatic service recovery
- **Resource limits**: Memory-constrained Redis

### Logging
- **Structured logging**: JSON format with timestamps
- **Centralized logs**: Docker log collection
- **Log rotation**: Automatic log management
- **Debug capabilities**: Configurable log levels

### Monitoring
- **Health checks**: Service-level health monitoring
- **Dependency management**: Service startup ordering
- **Auto-restart**: `unless-stopped` restart policy
- **Status visibility**: Coolify dashboard integration

## Deployment Workflow

### Automatic Deployment
```bash
# 1. Push to main branch
git push origin main

# 2. Coolify automatically:
#    - Pulls latest code
#    - Builds Docker images  
#    - Deploys with zero downtime
#    - Runs health checks
#    - Routes traffic to new containers
```

### Manual Deployment
```bash
# From Coolify dashboard
1. Navigate to your project
2. Click "Redeploy"
3. Monitor deployment logs
4. Verify service health
```

### Rollback Procedure
```bash
# From Coolify dashboard
1. Navigate to Deployments
2. Select previous successful deployment
3. Click "Rollback"
4. Monitor rollback process
```

## Troubleshooting

### Common Issues

#### Service Health Check Failures
```bash
# Check logs in Coolify
1. Navigate to service logs
2. Look for health check errors
3. Verify environment variables
4. Check service dependencies
```

#### Database Connection Issues
```bash
# Verify Supabase configuration
1. Test SUPABASE_URL accessibility
2. Validate SUPABASE_SERVICE_KEY permissions
3. Check RLS policies
4. Verify network connectivity
```

#### Build Failures
```bash
# Common build issues
1. Check Dockerfile syntax
2. Verify dependency versions
3. Check environment variable names
4. Validate docker-compose.coolify.yml
```

#### Memory/Resource Issues
```bash
# Resource monitoring
1. Check Redis memory usage (should be <300MB)
2. Monitor backend memory consumption
3. Verify disk space availability
4. Check container resource limits
```

### Debug Commands

#### Check Service Status
```bash
# In Coolify terminal
docker ps                          # List running containers
docker logs emg-backend           # Backend logs
docker logs emg-frontend          # Frontend logs  
docker logs emg-redis             # Redis logs
```

#### Health Check Testing
```bash
# Test health endpoints
curl http://localhost:8080/health  # Backend health
curl http://localhost:8080/        # Frontend health
redis-cli ping                     # Redis health
```

#### Environment Verification
```bash
# Check environment variables
docker exec emg-backend env | grep SUPABASE
docker exec emg-frontend env | grep REACT_APP
```

## Advanced Configuration

### Custom Domain Setup
```yaml
# In Coolify project settings
1. Navigate to Domains
2. Add your custom domain
3. Configure SSL certificate
4. Update DNS records
5. Test domain accessibility
```

### Webhook Configuration
```bash
# Configure Supabase Storage webhook
1. Supabase Dashboard → Storage → Settings
2. Add webhook URL: https://your-domain/webhooks/storage/c3d-upload
3. Configure webhook secret (matches WEBHOOK_SECRET)
4. Test webhook functionality
```

### Scaling Configuration
```yaml
# For high-traffic scenarios
backend:
  deploy:
    replicas: 3        # Multiple backend instances
    resources:
      limits:
        memory: 1GB    # Increased memory limit
```

### Backup Strategy
```bash
# Supabase handles database backups
# For application data:
1. Configure volume backups in Coolify
2. Regular Redis data snapshots
3. Log archival strategy
```

## Performance Optimization

### Build Optimization
- **Multi-stage builds**: Smaller production images
- **Layer caching**: Faster subsequent builds
- **Dependency optimization**: Minimal production dependencies

### Runtime Optimization
- **Redis caching**: Reduced database load
- **Health check tuning**: Optimal check intervals
- **Resource limits**: Prevent resource exhaustion

### Monitoring & Alerting
- **Health check alerts**: Service failure notifications
- **Resource monitoring**: Memory/CPU usage alerts
- **Log analysis**: Error pattern detection

## Security Considerations

### Container Security
- **Non-root users**: All containers run as non-privileged users
- **Minimal images**: Alpine-based with minimal attack surface
- **Secret management**: Environment-based secret injection

### Network Security
- **Internal networking**: Services communicate via internal Docker network
- **TLS termination**: Coolify handles SSL/TLS encryption
- **Firewall rules**: Only necessary ports exposed

### Data Security
- **Database encryption**: Supabase handles data encryption at rest
- **Transit encryption**: All API communication over HTTPS
- **Authentication**: Supabase Auth integration with RLS

## Support & Maintenance

### Regular Maintenance
- **Dependency updates**: Monthly security updates
- **Log rotation**: Automated log cleanup
- **Health monitoring**: Continuous service monitoring

### Documentation Updates
- Keep deployment docs synchronized with configuration changes
- Update environment variable documentation
- Maintain troubleshooting guides

### Monitoring & Alerts
- Configure Coolify alerts for service failures
- Monitor resource usage trends
- Set up log aggregation for error analysis

---

## Self-Hosted Supabase Configuration

### Overview

For complete infrastructure control, you can self-host Supabase alongside your application on the same VM. This section covers the additional configuration needed when using a self-hosted Supabase instance with Coolify.

### Prerequisites

- **VM Resources**: Additional 4GB RAM, 20GB storage for Supabase stack
- **Docker Compose**: Coolify supports multi-service deployments
- **Network Configuration**: Internal service communication

### Self-Hosted Supabase Setup

#### 1. Supabase Stack Deployment

```bash
# Create supabase directory on your VM
mkdir supabase-stack
cd supabase-stack

# Get Supabase self-hosting files
git clone --depth 1 https://github.com/supabase/supabase
cp -rf supabase/docker/* .
cp supabase/docker/.env.example .env

# Configure environment variables
nano .env  # Update with your secure values
```

#### 2. Essential Environment Variables for Self-Hosted Supabase

```bash
# PostgreSQL Configuration
POSTGRES_PASSWORD=your-secure-postgres-password
POSTGRES_DB=postgres
POSTGRES_HOST=supabase-db
POSTGRES_PORT=5432

# Supabase Configuration
ANON_KEY=your-generated-anon-key
SERVICE_ROLE_KEY=your-generated-service-key
JWT_SECRET=your-40-character-jwt-secret
SITE_URL=https://your-app-domain.com

# SMTP Configuration (Required for auth emails)
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_SENDER_NAME=EMG C3D Analyzer

# Storage Configuration
STORAGE_BACKEND=file  # or 's3' for external storage
```

#### 3. Coolify Integration with Self-Hosted Supabase

Create `docker-compose.supabase.yml` for complete stack:

```yaml
version: '3.8'

services:
  # Self-hosted Supabase services
  supabase-db:
    image: supabase/postgres:15.6.1.129
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - supabase_db_data:/var/lib/postgresql/data
    restart: unless-stopped

  supabase-auth:
    image: supabase/gotrue:v2.158.1
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@supabase-db:5432/postgres
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_SITE_URL: ${SITE_URL}
    depends_on:
      - supabase-db
    restart: unless-stopped

  supabase-rest:
    image: postgrest/postgrest:v12.2.3
    environment:
      PGRST_DB_URI: postgres://authenticator:${POSTGRES_PASSWORD}@supabase-db:5432/postgres
      PGRST_JWT_SECRET: ${JWT_SECRET}
      PGRST_DB_ANON_ROLE: anon
    depends_on:
      - supabase-db
    restart: unless-stopped

  supabase-storage:
    image: supabase/storage-api:v1.11.1
    environment:
      ANON_KEY: ${ANON_KEY}
      SERVICE_KEY: ${SERVICE_ROLE_KEY}
      POSTGREST_URL: http://supabase-rest:3000
      DATABASE_URL: postgres://supabase_storage_admin:${POSTGRES_PASSWORD}@supabase-db:5432/postgres
    depends_on:
      - supabase-db
      - supabase-rest
    volumes:
      - supabase_storage_data:/var/lib/storage
    restart: unless-stopped

  supabase-kong:
    image: kong:2.8.1
    environment:
      KONG_DATABASE: 'off'
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
    volumes:
      - ./kong.yml:/var/lib/kong/kong.yml
    ports:
      - "${KONG_HTTP_PORT:-8000}:8000"
    depends_on:
      - supabase-auth
      - supabase-rest
      - supabase-storage
    restart: unless-stopped
    labels:
      - "coolify.managed=true"
      - "coolify.service=supabase-gateway"
      - "coolify.port=8000"

  # Your application services
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    environment:
      # Connect to self-hosted Supabase
      SUPABASE_URL: http://supabase-kong:8000
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SERVICE_ROLE_KEY}
    depends_on:
      - redis
      - supabase-kong
    restart: unless-stopped
    volumes:
      - backend_data:/app/data
      - backend_logs:/app/logs

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    environment:
      REACT_APP_SUPABASE_URL: http://supabase-kong:8000
      REACT_APP_SUPABASE_ANON_KEY: ${ANON_KEY}
    depends_on:
      - backend
    restart: unless-stopped
    labels:
      - "coolify.managed=true"
      - "coolify.service=frontend"
      - "coolify.port=8080"
      - "coolify.public=true"

  redis:
    image: redis:7.2-alpine
    command: redis-server --maxmemory 300mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  supabase_db_data:
  supabase_storage_data:
  backend_data:
  backend_logs:
  redis_data:
```

#### 4. Configuration Files Updates

**Backend Configuration (`backend/.env.supabase-self-hosted`)**:
```bash
# Self-hosted Supabase connection
SUPABASE_URL=http://supabase-kong:8000
SUPABASE_ANON_KEY=your-generated-anon-key
SUPABASE_SERVICE_KEY=your-generated-service-key

# Note: Use internal Docker network names for service-to-service communication
# External access would use: https://your-supabase-domain.com
```

**Frontend Configuration (`.env.supabase-self-hosted`)**:
```bash
# Self-hosted Supabase for frontend
REACT_APP_SUPABASE_URL=https://your-supabase-domain.com
REACT_APP_SUPABASE_ANON_KEY=your-generated-anon-key

# Note: Frontend needs external URL for browser access
# Use your configured domain or IP address
```

### Security Considerations for Self-Hosted Setup

#### 1. Database Security
```sql
-- Update default passwords immediately
ALTER USER postgres PASSWORD 'your-secure-postgres-password';
ALTER USER supabase_admin PASSWORD 'your-secure-admin-password';

-- Enable Row Level Security on all tables
ALTER TABLE your_tables ENABLE ROW LEVEL SECURITY;
```

#### 2. Network Security
```yaml
# Restrict internal services in docker-compose
services:
  supabase-db:
    networks:
      - internal
    # No external ports exposed

networks:
  internal:
    driver: bridge
  default:
    external: true
```

#### 3. SSL/TLS Configuration
```yaml
# Kong SSL configuration
environment:
  KONG_SSL_CERT: /etc/ssl/certs/supabase.crt
  KONG_SSL_CERT_KEY: /etc/ssl/private/supabase.key
```

### Performance Optimization for Self-Hosted Setup

#### 1. Resource Allocation
```yaml
# Recommended resource limits
services:
  supabase-db:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'

  supabase-storage:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

#### 2. Database Optimization
```sql
-- PostgreSQL performance tuning
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
SELECT pg_reload_conf();
```

### Monitoring Self-Hosted Supabase

#### 1. Health Checks
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

#### 2. Log Management
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "3"
```

### Migration from Hosted to Self-Hosted Supabase

#### 1. Data Migration
```bash
# Export from hosted Supabase
pg_dump "postgres://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" > backup.sql

# Import to self-hosted
psql -h localhost -U postgres -d postgres < backup.sql
```

#### 2. Configuration Updates
```bash
# Update environment variables
SUPABASE_URL=https://your-self-hosted-domain.com
# Keep same ANON_KEY and SERVICE_KEY for compatibility
```

### Troubleshooting Self-Hosted Setup

#### Common Issues
```bash
# Check service connectivity
docker exec -it emg-backend curl http://supabase-kong:8000/rest/v1/

# Verify database connection
docker exec -it supabase-db psql -U postgres -c "SELECT version();"

# Check storage service
curl http://localhost:8000/storage/v1/bucket
```

### Backup Strategy for Self-Hosted Setup

#### 1. Database Backups
```bash
# Automated daily backups
docker exec supabase-db pg_dump -U postgres postgres > backup-$(date +%Y%m%d).sql

# Restore from backup
docker exec -i supabase-db psql -U postgres -d postgres < backup-20250828.sql
```

#### 2. Storage Backups
```bash
# Backup storage volumes
docker run --rm -v supabase_storage_data:/data -v $(pwd):/backup alpine tar czf /backup/storage-backup.tar.gz /data
```

---

## Nginx Consideration for Coolify

**Note**: Nginx is **not required** when using Coolify. Coolify includes **Traefik** as its built-in reverse proxy, which handles:
- SSL/TLS termination with automatic Let's Encrypt certificates
- Domain routing and path-based routing
- Load balancing across service instances
- WebSocket support for real-time features

If you choose to keep nginx in your Docker configuration, it will work as an application-level reverse proxy, but Coolify's Traefik will handle the external traffic routing.

---

## Conclusion

This Coolify deployment provides a production-ready environment for the EMG C3D Analyzer with:

✅ **Security**: Non-root containers, environment isolation, RLS policies  
✅ **Reliability**: Health checks, auto-restart, dependency management  
✅ **Performance**: Redis caching, optimized builds, resource limits  
✅ **Maintainability**: Structured logging, monitoring, rollback capabilities  
✅ **Scalability**: Multi-service architecture ready for horizontal scaling  
✅ **Self-Hosting**: Complete infrastructure control with self-hosted Supabase option

The configuration follows production best practices while maintaining simplicity and avoiding over-engineering, as requested.