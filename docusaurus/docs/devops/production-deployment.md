---
sidebar_position: 3
title: Production Deployment
---

# Production Deployment Guide

## Overview

This guide covers deploying the EMG C3D Analyzer to our production environment using **Coolify self-hosted on VUB infrastructure**. This setup ensures full data sovereignty and GDPR compliance for medical data processing.

## Environment Summary

| Component | Technology | Location | Purpose |
|-----------|------------|----------|---------|
| **Platform** | Self-hosted Coolify | VUB Debian VM | Container orchestration |
| **Database** | Self-hosted Supabase | Same infrastructure | Medical data storage |
| **Access** | SSH key authentication | Internal network | Secure remote management |
| **Backup** | Automated | Local infrastructure | Data protection |

## Quick Start: Production Deployment

### Step 1: Server Access
Connect to the VUB production server:

```bash
ssh -i ggustin_ghostly.pk ggustin@10.67.0.12
```

**Server Details:**
- **Host**: `10.67.0.12` (VUB internal network)
- **User**: `ggustin` (non-root account)
- **Key**: `ggustin_ghostly.pk` (VUB-provided SSH key)
- **OS**: Debian GNU/Linux with kernel 6.12.41

### Step 2: Install Coolify
Run the Coolify installation with our custom configuration:

```bash
# Switch to root for installation
sudo su -

# Install Coolify with our optimizations
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

<details>
<summary><strong>📋 Installation Challenges & Solutions</strong></summary>

The VUB server required several optimizations due to LVM partition constraints:

#### **Docker Storage Relocation**
- **Issue**: `/var` partition too small (919MB) for Docker operations
- **Solution**: Relocated Docker to `/opt/docker-data` with 65GB available space
- **Implementation**: Symbolic links maintain compatibility

#### **Service Dependencies**
- **Issue**: Services starting out of order caused database failures
- **Solution**: Added health checks and dependency declarations
- **Result**: Reliable startup sequence with PostgreSQL ready before application

#### **Network Access**
- **Issue**: Web interface blank pages due to network restrictions
- **Solution**: SSH tunnel for secure, reliable access
- **Command**: `ssh -i ggustin_ghostly.pk -L 8000:localhost:8000 ggustin@10.67.0.12`

**📖 Full Technical Details**: See [Complete Installation Guide](./coolify-installation-debian13-vubmachine.md) for step-by-step troubleshooting and solutions.
</details>

### Step 3: Deploy Application
Configure and deploy the EMG C3D Analyzer:

```bash
# Access Coolify via SSH tunnel
ssh -i ggustin_ghostly.pk -L 8000:localhost:8000 ggustin@10.67.0.12

# Open in browser: http://localhost:8000
```

1. **Create Project**: Add EMG C3D Analyzer project in Coolify
2. **Connect Repository**: Link to GitHub repository
3. **Set Docker Compose**: Use `docker/compose/docker-compose.production.yml`
4. **Configure Environment**: Add production environment variables
5. **Deploy**: Trigger first deployment

<details>
<summary><strong>🔧 Application Configuration Details</strong></summary>

#### **Docker Compose Setup**
```yaml
# Key services in production compose
services:
  frontend:
    image: node:18
    environment:
      - VITE_API_URL=https://api.yourdomain.com
      - VITE_SUPABASE_URL=${SUPABASE_URL}
  
  backend:
    image: python:3.11
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - ENVIRONMENT=production
```

#### **Required Environment Variables**
```bash
# Supabase Configuration
SUPABASE_URL=https://your-production-supabase.com
SUPABASE_SERVICE_KEY=eyJhbGc...  # Service role key
SUPABASE_ANON_KEY=eyJhbGc...     # Public key

# Application Settings
ENVIRONMENT=production
SECRET_KEY=your-production-secret-key
REDIS_URL=redis://redis:6379/0
```
</details>

### Step 4: Configure Database
Set up the production database with medical data schema:

```bash
# Deploy Supabase schema
supabase link --project-ref YOUR_PROD_PROJECT
psql $DATABASE_URL < supabase/migrations/production_snapshot.sql
```

**Database includes:**
- 13 tables for clinical data
- 33 stored procedures for EMG analysis
- RLS policies for data security
- Storage bucket for C3D files

### Step 5: Verify Deployment
Confirm everything is working:

```bash
# Health check
curl https://your-production-domain.com/api/health

# Test authentication
curl https://your-production-domain.com/api/auth/verify

# Check database connection
curl https://your-production-domain.com/api/patients
```

## Monitoring & Maintenance

### Daily Operations
- **Health Monitoring**: Automated checks every 5 minutes
- **Log Review**: Check Coolify logs for any issues
- **Backup Verification**: Confirm daily database backups

### Common Maintenance Tasks
```bash
# View application logs
docker compose logs -f

# Update application
# (Trigger via Coolify webhook from GitHub)

# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restart services if needed
docker compose restart
```

<details>
<summary><strong>🔍 Troubleshooting Common Issues</strong></summary>

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **App not loading** | White screen, console errors | Check VITE_API_URL environment variable |
| **Database errors** | 500 errors, connection timeouts | Verify Supabase credentials and network |
| **High memory usage** | Slow response, container crashes | Increase memory limits in Coolify |
| **SSL certificate** | HTTPS warnings | Check domain DNS and certificate renewal |

#### **Emergency Procedures**
```bash
# Quick restart
docker compose restart

# Check disk space
df -h

# View recent logs
docker compose logs --tail=100 -f

# Emergency rollback
# Use Coolify dashboard → Deployments → Previous version → Rollback
```
</details>

## Security & Compliance

- **🔒 Data Protection**: Encryption in transit/at rest + SSH key authentication only
- **🏛️ GDPR Compliance**: All patient data stays within VUB infrastructure with automated audit trails
- **📋 Access Control**: SSH tunneling + containerized database credentials
- **💾 Backup Strategy**: Daily encrypted backups with 30-day retention

## Next Steps

### 1. Configure Monitoring
Set up system health alerts using Coolify's One-Click Services:

```bash
# Deploy monitoring stack via Coolify dashboard
# One-Click Services → Prometheus + Grafana
```

**📖 [Coolify One-Click Services](https://coolify.io/docs/services/introduction)** - Deploy monitoring tools instantly

### 2. Schedule Automated Backups
Configure automatic database backups in Coolify:

1. Go to **Settings → Backup → Configure Backup**
2. Enable **Backup Enabled**
3. Set schedule with cron expression (e.g., `0 2 * * *` for daily 2 AM)
4. Save configuration

**📖 [Coolify Backup Documentation](https://coolify.io/docs/)** - Complete backup configuration guide

### 3. System Maintenance
- **Documentation**: Record production-specific configurations
- **Team Training**: Share SSH tunnel and access procedures
- **Update Schedule**: Plan monthly updates via Coolify dashboard

### 4. Advanced Configuration
**📖 [Coolify Documentation](https://coolify.io/docs/)** - Complete setup guides and troubleshooting

---

## Related Documentation

- **📖 [Complete Technical Installation Guide](./coolify-installation-debian13-vubmachine.md)** - Full step-by-step technical details
- **🚀 [DevOps Overview](./devops.md)** - All deployment environments comparison
- **🔒 [Security Guidelines](../security/)** - Security best practices and compliance

---

*This guide provides the essential steps for production deployment. For detailed technical implementation, troubleshooting, or advanced configuration, refer to the complete installation guide linked above.*