---
sidebar_position: 1
title: Infrastructure Overview
---

# Infrastructure Overview

Simple deployment setup with Docker and ngrok for development.

## Development Environment

### Local Development Stack
- **Backend**: FastAPI on port 8080
- **Frontend**: Vite dev server on port 3000  
- **Database**: Supabase cloud (PostgreSQL + Auth + Storage)
- **Cache**: Redis 7.2 (optional for performance)
- **Webhook Testing**: ngrok tunnel for Supabase webhooks

### Quick Start Commands
```bash
# Standard development
./start_dev_simple.sh              # Backend + Frontend

# With webhook testing
./start_dev_simple.sh --webhook    # + ngrok tunnel

# With testing
./start_dev_simple.sh --test       # Run all 135 tests

# Individual services
cd backend && uvicorn main:app --reload --port 8080
cd frontend && npm start
```

## Webhook Development

### ngrok Setup (One-time)
```bash
# 1. Download ngrok: https://ngrok.com/download
# 2. Get free account: https://dashboard.ngrok.com/signup  
# 3. Configure auth token
./ngrok config add-authtoken YOUR_TOKEN

# 4. Start webhook development
./start_dev.sh --webhook
```

### Supabase Webhook Configuration
1. **Dashboard** → Storage → Webhooks
2. **URL**: `https://YOUR_NGROK_URL.ngrok-free.app/webhooks/storage/c3d-upload`
3. **Events**: `storage.objects.create`
4. **Bucket**: `c3d-examples`

## Environment Configuration

### Required Environment Variables

**Backend** (`.env`):
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key  
WEBHOOK_SECRET=your-webhook-secret
REDIS_URL=redis://localhost:6379  # Optional
```

**Frontend** (`.env.local`):
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8080  # Production uses different URL
```

## Docker Support

### Development with Docker
```bash
# Build backend container
docker build -f backend/Dockerfile -t emg-backend .

# Run with environment variables
docker run -p 8080:8080 --env-file .env emg-backend
```

### Docker Configuration
- **Backend**: Python 3.11 with FastAPI
- **Dependencies**: Managed via requirements.txt
- **Health checks**: Built-in endpoint monitoring
- **Volume mounts**: For development file watching

## Production Deployment

### Backend Deployment
- **Platform**: Coolify or Vercel
- **Requirements**: Python 3.11+, 512MB RAM minimum
- **Environment**: Production environment variables
- **Database**: Supabase production instance

### Frontend Deployment  
- **Platform**: Vercel (automatic from GitHub)
- **Build**: `npm run build` → Static files
- **API Routing**: `/api/*` proxy to backend
- **Environment**: Production API URLs

## Key Infrastructure Files

- `start_dev_simple.sh` → Development startup script
- `backend/Dockerfile` → Backend container configuration  
- `frontend/vite.config.ts` → Frontend build configuration
- `backend/requirements.txt` → Python dependencies
- `frontend/package.json` → Node.js dependencies

## Monitoring and Logs

### Development Logging
```bash
# Backend logs
tail -f logs/backend.error.log

# Filter webhook activity  
tail -f logs/backend.error.log | grep -E "(🚀|📁|🔄|✅|❌|📊)"

# Frontend development console
# Check browser developer tools
```

### Health Checks
- **Backend**: `GET /health` → Service status
- **Frontend**: Build success → All routes accessible
- **Database**: Supabase dashboard → Connection status
- **Storage**: File upload test → Webhook processing

## Common Issues

### Port Conflicts
```bash
# Check what's using ports
lsof -i :3000  # Frontend
lsof -i :8080  # Backend

# Kill processes if needed
pkill -f "node.*3000"
pkill -f "uvicorn"
```

### Webhook Testing
- **ngrok required** for Supabase webhook development
- **HMAC validation** must match webhook secret
- **Test uploads** to `c3d-examples` bucket trigger processing

### Database Connections
- **Supabase connection limits** apply to free tier
- **RLS policies** must be configured for data access
- **Migration files** in `supabase/migrations/` for schema changes