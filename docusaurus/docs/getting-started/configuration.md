---
sidebar_position: 3
title: Configuration
---

# Configuration

Essential environment variables for running the Ghostly+ Dashboard.

## Required Configuration

Create `.env` files in both backend and frontend directories:

### Backend (.env)

```bash
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Redis (Optional - defaults to localhost)
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL_SECONDS=3600

# Webhook (Required for storage integration)
WEBHOOK_SECRET=your-webhook-secret
```

### Frontend (.env)

```bash
# API Configuration
VITE_API_URL=http://localhost:8080  # Backend URL
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Quick Setup

1. **Get Supabase credentials** from your project dashboard:
   - Settings → API → Copy URL and keys

2. **Configure webhook** in Supabase Storage:
   - Storage → Settings → Webhooks
   - URL: `https://your-domain/webhooks/storage/c3d-upload`
   - Secret: Match your `WEBHOOK_SECRET`

3. **For local development with webhooks**:
   ```bash
   # Setup ngrok tunnel for webhook testing
   ngrok config add-authtoken YOUR_TOKEN
   ./start_dev.sh --webhook
   ```

## Processing Parameters

EMG processing uses fixed, clinically-validated parameters defined in:
- `backend/emg/processing_parameters.py` - Core signal processing settings
- `backend/services/clinical/performance_scoring_service.py` - Scoring thresholds

These are not configurable via environment variables to ensure consistent clinical analysis.

## Deployment Configuration

For production deployment with Coolify, see [Deployment Guide](../backend/deployment.md).

Key production differences:
- `NODE_ENV=production` - Optimizes builds and disables debug features
- `VITE_API_URL` - Points to production backend URL
- SSL/TLS handled by Coolify's Traefik proxy
- Redis and database connections use Docker network names