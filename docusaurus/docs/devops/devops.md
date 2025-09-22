---
sidebar_position: 1
title: DevOps & Deployment
---

# DevOps & Deployment Guide

## Overview

The EMG C3D Analyzer deploys across three environments, each optimized for different needs. We use Vercel and Render for rapid development with zero configuration, Coolify Cloud for staging with Docker containers, and self-hosted Coolify for production to ensure medical data sovereignty. Our GitHub Actions pipeline automatically tests and deploys code, making the deployment process smooth and reliable.

## Deployment Environments

### Environment Comparison

| Environment | Platform | Database | Purpose | Auto-Deploy |
|------------|----------|----------|---------|-------------|
| **Development** | Vercel + Render | Supabase Cloud | Rapid iteration | ✅ On push |
| **Staging** | Coolify Cloud | Supabase Cloud | Docker testing, demos | ✅ On main |
| **Production** | Self-hosted Coolify | Self-hosted Supabase | Live medical data | Manual approval |

### Choosing the Right Environment

- **Development**: Perfect for feature development and quick testing. Every code push gets its own preview URL.
- **Staging**: Use this for client demos and integration testing. It mirrors production but uses cloud services.
- **Production**: Reserved for live patient data with full GDPR compliance and institutional control.

## Architecture

```mermaid
graph TB
    subgraph "GitHub Repository"
        Code[Source Code] --> Actions[GitHub Actions<br/>232 Tests]
    end
    
    Actions -->|Any push| Dev{Development}
    Actions -->|Main branch| Staging{Staging}
    Actions -->|Tagged release| Prod{Production}
    
    subgraph "Development Environment"
        Dev --> Vercel[Vercel<br/>Frontend]
        Dev --> Render[Render<br/>Backend]
    end
    
    subgraph "Staging Environment"
        Staging --> CoolifyCloud[Coolify Cloud<br/>Docker Platform]
    end
    
    subgraph "Production Environment"
        Prod --> CoolifySelf[Self-hosted Coolify<br/>VUB Servers]
    end
    
    subgraph "Data Layer"
        SupabaseCloud[(Supabase Cloud<br/>Dev & Staging)]
        SupabaseSelf[(Self-hosted Supabase<br/>Production)]
    end
    
    Vercel --> SupabaseCloud
    Render --> SupabaseCloud
    CoolifyCloud --> SupabaseCloud
    CoolifySelf --> SupabaseSelf
    
    style Code fill:#e1f5fe
    style Actions fill:#fff9c4
    style Vercel fill:#000000,color:#fff
    style Render fill:#46e3b7
    style CoolifyCloud fill:#fff3e0
    style CoolifySelf fill:#e8f5e9
    style SupabaseCloud fill:#fce4ec
    style SupabaseSelf fill:#ffebee
```

## CI/CD Pipeline

Every push to GitHub triggers our automated pipeline with 232 tests (154 backend + 78 frontend). The pipeline ensures code quality through unit tests, integration tests, security scanning, and build validation before any deployment happens.

### Quality Gates
- ✅ All tests must pass
- ✅ TypeScript and Python linting succeeds
- ✅ Security scanning finds no critical issues
- ✅ Docker images build successfully

## Quick Deployment Guide

### Development (Vercel + Render)

**Frontend on Vercel:**
1. Import repository at [vercel.com](https://vercel.com)
2. Set root: `frontend`, framework: Vite
3. Add environment variables (see below)
4. Deploy - takes 2 minutes

**Backend on Render:**
1. Create Web Service at [render.com](https://render.com)
2. Set root: `backend`, start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Add environment variables (see below)
4. Deploy - automatic HTTPS included

### Staging & Production (Coolify)

Both Coolify environments follow the same simple process:

1. **Connect GitHub**: Link repository to Coolify project
2. **Set Docker Compose**: `docker/compose/docker-compose.coolify.yml`
3. **Add Variables**: Configure all environment variables
4. **Deploy**: Push to main branch triggers deployment
5. **Verify**: Check `/api/health` endpoint

## Environment Variables

### Backend (All Environments)
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...  # Service role - keep secret!
SUPABASE_ANON_KEY=eyJhbGc...     # Public key

# Application Settings
ENVIRONMENT=production            # or development, staging
SECRET_KEY=your-secret-key       # Generate: openssl rand -hex 32

# Redis (Coolify environments only)
REDIS_URL=redis://redis:6379/0
```

### Frontend (All Environments)
```bash
# API Configuration
VITE_API_URL=https://your-backend-url  # Render/Coolify URL
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...     # Same public key as backend
```

## Local Development

For local development, we provide simple scripts that handle everything:

```bash
# Start both frontend and backend
./start_dev_simple.sh

# With webhook testing (includes ngrok)
./start_dev_simple.sh --webhook

# Run all tests
./start_dev_simple.sh --test
```

## Monitoring & Maintenance

### Health Checks

Quick commands to verify your deployment:

```bash
# API Health
curl https://your-app.com/api/health

# Frontend
open https://your-app.com

# Logs (Coolify)
# Dashboard → Service → View Logs
```

### Updating Applications

- **Development**: Automatic on every push
- **Staging**: Automatic when merging to main
- **Production**: Manual approval in Coolify dashboard

### Rollback

If something goes wrong:
1. **Coolify**: Dashboard → Deployments → Select previous → Rollback
2. **Git**: `git revert HEAD && git push origin main`

## Troubleshooting

Common issues and quick fixes:

| Issue | Solution |
|-------|----------|
| Frontend can't reach backend | Check VITE_API_URL environment variable |
| Supabase connection fails | Verify service key hasn't expired |
| High memory usage | Increase Coolify resource limits |
| Build fails | Clear Docker cache in Coolify |

## Self-Hosted Supabase Deployment

For production environments requiring data sovereignty and GDPR compliance, deploy your own Supabase instance.

### Production Database Setup (3 Steps)

#### 1. Create Supabase Project
- Go to [https://app.supabase.com](https://app.supabase.com) for cloud-hosted
- Or deploy self-hosted Supabase using [Docker](https://supabase.com/docs/guides/self-hosting/docker)
- Save your project URL and keys from API Settings

#### 2. Deploy Database Schema
```bash
# Using Supabase CLI (Recommended for production)
supabase link --project-ref YOUR_PROJECT_REF
psql $DATABASE_URL < supabase/migrations/production_snapshot_2025_09_11.sql

# Or via Dashboard SQL Editor
# Copy entire production_snapshot_2025_09_11.sql and run
```

**Production snapshot includes:**
- 13 tables (11 public + 2 private)
- 33 stored procedures and functions
- All RLS policies for security
- Triggers and indexes for performance
- Default scoring configurations

#### 3. Create Storage Bucket
```bash
# Create storage bucket for C3D files
supabase storage create c3d-examples --public false

# Or via Dashboard: Storage → New Bucket
```

### Production Environment Variables

```bash
# Backend (.env)
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key  # Keep secret!
SUPABASE_ANON_KEY=your-anon-key

# Frontend (.env)
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://your-api-domain.com  # Production API URL
```

### Production Verification

```sql
-- Verify database deployment
SELECT 
    'Tables' as item, COUNT(*) as count, '13' as expected
FROM information_schema.tables 
WHERE table_schema IN ('public', 'private')
UNION ALL
SELECT 
    'Functions', COUNT(*), '33'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';
```

### Creating a Full Production Snapshot

To capture your complete database state including all procedures, RLS policies, and triggers:

```bash
# Method 1: Using Supabase CLI (Recommended)
supabase db dump --schema-only > production_snapshot_$(date +%Y_%m_%d).sql

# Method 2: Using pg_dump with all objects
pg_dump --schema-only --no-owner --no-privileges \
  --create --clean --if-exists \
  -h db.YOUR_PROJECT.supabase.co \
  -U postgres \
  -d postgres > production_snapshot_$(date +%Y_%m_%d).sql

# Method 3: Extract from Supabase Dashboard
# SQL Editor → Run this query → Export results
SELECT 
  'CREATE OR REPLACE FUNCTION ' || proname || '(' || 
  pg_get_function_identity_arguments(oid) || ') RETURNS ' ||
  pg_get_function_result(oid) || ' AS $$ ' || 
  prosrc || ' $$ LANGUAGE ' || lanname || ';'
FROM pg_proc p
JOIN pg_language l ON p.prolang = l.oid
WHERE pronamespace = 'public'::regnamespace;
```

**What gets captured:**
- All tables with exact structure
- All 33+ stored procedures and functions
- All RLS policies and permissions
- All triggers and indexes
- All views and materialized views
- Default data and configurations

### Production Deployment Checklist

- [ ] All 13 tables created with correct structure
- [ ] All 33 functions deployed and working
- [ ] RLS policies active on all tables
- [ ] Storage bucket created with policies
- [ ] Default scoring configurations inserted
- [ ] Environment variables configured
- [ ] API endpoints responding correctly
- [ ] Authentication flow verified
- [ ] Webhook integration configured
- [ ] Database backups configured

**Full documentation**: See `/supabase/README.md` for migration management, troubleshooting, and utilities.

## Security Reminders

- 🔐 Never commit secrets - use environment variables
- 🔄 Rotate Supabase keys quarterly
- 🔒 Always use HTTPS, even in development
- 📊 Monitor logs for suspicious activity
- 🔧 Update Docker images monthly

## Essential Resources

### Documentation
- [Coolify Docs](https://coolify.io/docs) - Deployment platform
- [Vercel Docs](https://vercel.com/docs) - Frontend hosting
- [Render Docs](https://render.com/docs) - Backend hosting
- [Supabase Docs](https://supabase.com/docs) - Database & Auth

### Project Configuration
- CI/CD Pipeline: `/.github/workflows/ci.yml`
- Docker Setup: `/docker/compose/docker-compose.coolify.yml`
- Environment Config: Check respective platform dashboards



---

*This guide covers the essentials for deploying the EMG C3D Analyzer. For detailed Docker configurations or advanced CI/CD customization, refer to the source files listed above.*