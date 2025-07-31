# Deployment Guide

Production deployment configuration for FastAPI backend and React frontend.

## Architecture Overview

```
Frontend (Vercel) ←→ Backend (Render) ←→ Database (Supabase)
     ↓                    ↓                    ↓
React/TypeScript     FastAPI/Python      PostgreSQL + Auth
```

## Environment Configuration

### Frontend Environment Variables
```bash
# .env (React - Vercel)
REACT_APP_API_URL=https://emg-c3d-analyzer-backend.onrender.com
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### Backend Environment Variables  
```bash
# .env (FastAPI - Render)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ALLOWED_ORIGINS=https://emg-c3d-analyzer.vercel.app
```

### Supabase Configuration
```bash
# Database connection (auto-configured)
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# Storage bucket
SUPABASE_STORAGE_BUCKET=c3d-examples
```

## Frontend Deployment (Vercel)

### Build Configuration
```json
// vercel.json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### Build Process
```bash
# Automatic Vercel deployment
npm run build        # Creates optimized production build
npm run test         # Runs test suite (optional)

# Manual verification
serve -s build       # Test production build locally
```

### Performance Optimization
```bash
# Build optimizations already configured:
- Code splitting with React.lazy()
- Tree shaking for unused code
- Minification and compression
- Static asset optimization
```

## Backend Deployment (Render)

### Service Configuration
```yaml
# render.yaml (Render configuration)
services:
  - type: web
    name: emg-c3d-analyzer-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: PYTHON_VERSION
        value: 3.9.16
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
```

### Dependencies
```txt
# requirements.txt (optimized for Render)
fastapi>=0.100.0
uvicorn[standard]>=0.23.0
python-multipart>=0.0.6
supabase>=1.0.0
numpy>=1.24.0
scipy>=1.10.0
pandas>=2.0.0
python-dotenv>=1.0.0
```

### Startup Configuration
```python
# main.py - Production configuration
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="GHOSTLY+ EMG Analysis API",
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENVIRONMENT") != "production" else None
)

# CORS configuration for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

## Database Setup (Supabase)

### Initial Setup
```sql
-- Create required tables (see db_schema.md for complete schema)
CREATE TABLE researcher_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    full_name TEXT,
    institution TEXT,
    role TEXT,
    access_level TEXT
);

-- Enable Row Level Security
ALTER TABLE researcher_profiles ENABLE ROW LEVEL SECURITY;

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('c3d-examples', 'c3d-examples', false);
```

### RLS Policies
```sql
-- Researcher profiles policy
CREATE POLICY "Users can view own profile" ON researcher_profiles
    FOR SELECT USING (auth.uid() = id);

-- Storage policies
CREATE POLICY "Authenticated users can upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'c3d-examples' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view files" ON storage.objects
    FOR SELECT USING (bucket_id = 'c3d-examples' AND auth.uid() IS NOT NULL);
```

## SSL/TLS Configuration

### Automatic HTTPS
- **Vercel**: Automatic SSL certificates
- **Render**: Automatic SSL certificates  
- **Supabase**: HTTPS by default

### CORS Security
```python
# Production CORS settings
ALLOWED_ORIGINS = [
    "https://emg-c3d-analyzer.vercel.app",
    "https://emg-c3d-analyzer-git-main-username.vercel.app"  # Preview deployments
]
```

## Monitoring and Logging

### Application Monitoring
```python
# Simple logging for production
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    logger.info(f"{request.method} {request.url} - {response.status_code} - {process_time:.2f}s")
    return response
```

### Error Tracking
```python
# Basic error handling
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

## Performance Optimization

### Backend Optimization
```python
# Async processing for better performance
from concurrent.futures import ThreadPoolExecutor
import asyncio

# Thread pool for CPU-intensive EMG analysis
executor = ThreadPoolExecutor(max_workers=2)

@app.post("/upload")
async def upload_file(file: UploadFile):
    # Run CPU-intensive processing in thread pool
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, process_emg_file, file)
    return result
```

### Frontend Optimization
```typescript
// Code splitting for better loading
const HeavyComponent = lazy(() => import('./HeavyComponent'))

// Service worker for caching (future enhancement)
// Progressive Web App capabilities
```

## Health Checks

### Backend Health Endpoint
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }
```

### Database Connection Check
```python
@app.get("/health/db")
async def database_health():
    try:
        # Simple database query
        supabase.table("researcher_profiles").select("id").limit(1).execute()
        return {"database": "healthy"}
    except Exception as e:
        return {"database": "unhealthy", "error": str(e)}
```

## Deployment Checklist

### Pre-deployment
- [ ] Environment variables configured
- [ ] Database schema up to date
- [ ] Storage bucket created and configured
- [ ] RLS policies applied
- [ ] Build processes tested locally

### Frontend Deployment
- [ ] Build succeeds without errors
- [ ] Environment variables set in Vercel
- [ ] Custom domain configured (if applicable)
- [ ] HTTPS redirect enabled

### Backend Deployment  
- [ ] Dependencies install successfully
- [ ] Health checks respond correctly
- [ ] CORS origins configured for production
- [ ] Logs show successful startup

### Post-deployment
- [ ] Frontend can connect to backend
- [ ] Authentication flow works end-to-end
- [ ] File upload and analysis functional
- [ ] Database operations working
- [ ] Error handling graceful

## Rollback Strategy

### Frontend Rollback
```bash
# Vercel - Instant rollback to previous deployment
vercel --prod --rollback [deployment-url]
```

### Backend Rollback
```bash
# Render - Redeploy previous Git commit
git revert [commit-hash]
git push origin main  # Triggers automatic redeployment
```

### Database Rollback
```sql
-- Prepare migration rollback scripts
-- Test rollback procedures in staging
-- Maintain database backups
```

## Security Considerations

### API Security
- **JWT validation**: All endpoints validate Supabase JWT tokens
- **CORS restriction**: Limited to production domains only
- **File upload limits**: 10MB maximum file size
- **Request rate limiting**: Consider implementing with Redis (future)

### Data Protection
- **Row Level Security**: All database tables protected
- **Encryption**: Data encrypted in transit and at rest
- **Access logs**: Monitor authentication and file access
- **Regular security updates**: Keep dependencies current

## Scaling Considerations

### Current Limits
- **Render Free Tier**: 750 hours/month, sleeps after inactivity
- **Supabase Free Tier**: 500MB database, 1GB storage, 50MB file uploads
- **Vercel Free Tier**: 100GB bandwidth, unlimited static deployments

### Scaling Path
1. **Upgrade hosting tiers** for higher limits
2. **Implement Redis caching** for frequently accessed data
3. **Add CDN** for static assets
4. **Consider containerization** with Docker for complex deployments
5. **Implement background job processing** for large file analysis