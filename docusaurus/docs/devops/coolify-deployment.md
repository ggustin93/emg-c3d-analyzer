# Coolify Cloud Deployment Guide

This guide explains how to deploy the EMG C3D Analyzer to Coolify Cloud on Digital Ocean using the staging configuration.

## Prerequisites

- Coolify Cloud account (https://coolify.io)
- Access to a Supabase project
- Domain name configured for staging deployment
- GitHub repository access for automatic deployments

## Environment Variables Configuration

### Required Variables in Coolify Dashboard

Add these environment variables in your Coolify project settings:

```bash
# ═══════════════════════════════════════════════════════════════════════════
# Backend Configuration (Runtime Variables)
# ═══════════════════════════════════════════════════════════════════════════

# Supabase Backend Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Application Security
SECRET_KEY=your-production-secret-key-minimum-32-characters
WEBHOOK_SECRET=your-webhook-secret-key-for-supabase

# Backend Environment
ENVIRONMENT=staging
DEBUG=false
LOG_LEVEL=INFO

# Optional Redis Configuration
ENABLE_REDIS=false
REDIS_URL=redis://redis:6379/0
REDIS_CACHE_TTL_SECONDS=3600
REDIS_MAX_CACHE_SIZE_MB=100
REDIS_KEY_PREFIX=emg_staging

# ═══════════════════════════════════════════════════════════════════════════
# Frontend Configuration (Build-Time Variables)
# ═══════════════════════════════════════════════════════════════════════════

# Frontend Supabase Configuration (MUST match backend values)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Frontend API Configuration
VITE_API_URL=https://staging-api.yourdomain.com
VITE_ENVIRONMENT=staging

# ═══════════════════════════════════════════════════════════════════════════
# Coolify-Specific Configuration
# ═══════════════════════════════════════════════════════════════════════════

# Platform Configuration
TARGETPLATFORM=linux/amd64
BUILDPLATFORM=linux/amd64

# Optional: Load Balancer Configuration
FRONTEND_URL=https://staging.yourdomain.com
ALLOWED_ORIGINS=https://staging.yourdomain.com
```

### Variable Categories Explained

#### 1. Backend Runtime Variables
These are read by the FastAPI backend at container startup:
- **SUPABASE_URL**: Your Supabase project URL
- **SUPABASE_SERVICE_KEY**: Backend-only key for admin operations
- **SECRET_KEY**: Used for session encryption (generate with `openssl rand -hex 32`)

#### 2. Frontend Build Variables
These are embedded into the JavaScript bundle during Docker build:
- **VITE_SUPABASE_URL**: Must match `SUPABASE_URL` exactly
- **VITE_SUPABASE_ANON_KEY**: Must match `SUPABASE_ANON_KEY` exactly
- **VITE_API_URL**: Your backend API endpoint URL

#### 3. Why Both SUPABASE_URL and VITE_SUPABASE_URL?
- **Backend** reads `SUPABASE_URL` at runtime
- **Frontend** needs `VITE_SUPABASE_URL` embedded at build time
- Vite only exposes `VITE_*` prefixed variables to the browser for security
- This is **required** and represents best practices, not redundancy

## Deployment Process

### Step 1: Configure Project in Coolify

1. **Create New Project** in Coolify dashboard
2. **Connect GitHub Repository**: Link to your EMG C3D Analyzer repo
3. **Set Docker Compose File**: `docker/compose/docker-compose.staging.yml`
4. **Configure Branch**: Set to your staging branch (e.g., `develop` or `staging`)

### Step 2: Environment Variables

1. Navigate to **Environment Variables** in Coolify project settings
2. Add all variables from the configuration above
3. **Double-check** that `VITE_SUPABASE_URL` matches `SUPABASE_URL`
4. **Verify** that `VITE_SUPABASE_ANON_KEY` matches `SUPABASE_ANON_KEY`

### Step 3: Domain Configuration

1. **Add Custom Domain** in Coolify dashboard
2. Configure DNS records:
   ```
   A    staging-api.yourdomain.com  →  your-server-ip
   A    staging.yourdomain.com      →  your-server-ip
   ```
3. **Enable SSL**: Coolify automatically provisions Let's Encrypt certificates

### Step 4: Deploy

1. **Trigger First Deployment** manually in Coolify dashboard
2. **Monitor Build Logs** - initial build takes 3-5 minutes
3. **Verify Services**: Both frontend (port 3000→8080) and backend (port 8080) should be healthy

## Troubleshooting

### Common Issues

#### 1. "Supabase URL is not set" Error
**Symptoms**: Frontend shows configuration error
**Cause**: Missing or incorrect `VITE_SUPABASE_URL`
**Solution**:
```bash
# Verify in Coolify environment variables:
VITE_SUPABASE_URL=https://your-project.supabase.co  # Must be set
VITE_SUPABASE_ANON_KEY=eyJ...                       # Must be set

# Then redeploy (rebuild required for frontend variables)
```

#### 2. Build Timeouts
**Symptoms**: Build process fails after 10-15 minutes
**Cause**: Docker build resource constraints
**Solution**:
- Increase build timeout in Coolify settings
- Use more powerful Digital Ocean droplet size
- Check build logs for specific error messages

#### 3. Services Not Starting
**Symptoms**: Containers exit immediately after start
**Cause**: Missing required environment variables
**Solution**:
```bash
# Check container logs in Coolify dashboard
# Verify all required variables are set
# Ensure SUPABASE_URL is accessible from server
```

#### 4. Frontend Can't Connect to Backend
**Symptoms**: API calls fail with 404 or connection errors
**Cause**: Incorrect `VITE_API_URL` configuration
**Solution**:
```bash
# Set correct backend URL in Coolify:
VITE_API_URL=https://staging-api.yourdomain.com

# Must match your Coolify domain configuration
```

### Health Check Verification

Access these endpoints to verify deployment:

```bash
# Frontend Health
curl https://staging.yourdomain.com/health
# Expected: "healthy"

# Backend Health  
curl https://staging-api.yourdomain.com/health
# Expected: {"status": "healthy", "timestamp": "..."}

# Backend API Documentation
https://staging-api.yourdomain.com/docs
```

## Performance Optimization

### Resource Limits
The staging configuration includes optimized resource limits:

```yaml
# Backend
resources:
  limits:
    memory: 2G      # Handles EMG processing
    cpus: '1.0'
  reservations:
    memory: 1G
    cpus: '0.5'

# Frontend  
resources:
  limits:
    memory: 1G      # Static file serving
    cpus: '0.5'
  reservations:
    memory: 512M
    cpus: '0.25'
```

### Monitoring Integration
Enhanced Coolify labels enable better monitoring:

```yaml
labels:
  - "coolify.health.enabled=true"
  - "coolify.metrics.enabled=true" 
  - "coolify.monitoring.prometheus=true"
```

## Security Features

### Enhanced Security Headers
The nginx configuration includes comprehensive security headers:

```nginx
# Prevent embedding in frames
X-Frame-Options: DENY

# Prevent MIME type sniffing
X-Content-Type-Options: nosniff

# XSS protection
X-XSS-Protection: 1; mode=block

# Force HTTPS (when served over HTTPS)
Strict-Transport-Security: max-age=31536000; includeSubDomains

# Control referrer information
Referrer-Policy: strict-origin-when-cross-origin

# Disable dangerous browser features
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

### Environment Separation
- **Public Keys**: Only `VITE_SUPABASE_ANON_KEY` exposed to browser
- **Private Keys**: `SUPABASE_SERVICE_KEY` remains backend-only
- **Credential Isolation**: Clear separation between frontend and backend secrets

## Maintenance

### Updates
1. **Code Changes**: Push to staging branch triggers automatic deployment
2. **Environment Variables**: Changes require manual redeploy in Coolify
3. **Dependency Updates**: Trigger rebuild to update base images

### Backup Strategy
- **Database**: Supabase handles automatic backups
- **File Storage**: Configure Supabase storage backup policies
- **Configuration**: Export environment variables from Coolify dashboard

### Monitoring
- **Health Checks**: Automatic via Docker health checks
- **Logs**: Available in Coolify dashboard
- **Metrics**: Integration with Coolify monitoring stack
- **Alerts**: Configure in Coolify for health check failures

## Production Deployment

This staging configuration serves as the foundation for production deployment. Key differences for production:

1. **Domain**: Update to production domains
2. **Environment**: Change `ENVIRONMENT=production`  
3. **Debugging**: Set `DEBUG=false` and `LOG_LEVEL=WARNING`
4. **Resources**: Increase limits based on load requirements
5. **Monitoring**: Add external monitoring services
6. **Backup**: Implement comprehensive backup strategy

The current configuration is production-ready with appropriate security, resource limits, and monitoring integration.