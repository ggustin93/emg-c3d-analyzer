---
sidebar_position: 3
title: Configuration
---

# Configuration Guide

Configure the EMG C3D Analyzer for your environment and requirements.

## Environment Variables

### Core Configuration

```env
# Application Mode
NODE_ENV=development  # development | production | test
LOG_LEVEL=info       # debug | info | warn | error

# API Configuration
API_BASE_URL=http://localhost:8080
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
```

### Supabase Configuration

#### Required Settings

```env
# Supabase Project
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...     # Public anonymous key
SUPABASE_SERVICE_KEY=eyJ...  # Service role key (backend only)

# Storage Bucket
STORAGE_BUCKET=c3d-examples
STORAGE_MAX_SIZE=10485760    # 10MB in bytes
```

#### Authentication

```env
# Auth Settings
SUPABASE_JWT_SECRET=your-jwt-secret
AUTH_REDIRECT_URL=http://localhost:3000/auth/callback
SESSION_TIMEOUT=3600  # 1 hour in seconds
```

### Redis Configuration

#### Basic Setup

```env
# Redis Connection
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=optional-password
REDIS_DB=0

# Cache Settings
ENABLE_CACHE=true
CACHE_TTL=3600       # 1 hour in seconds
CACHE_PREFIX=emg_
```

#### Performance Tuning

```env
# Redis Pool
REDIS_MAX_CONNECTIONS=50
REDIS_MIN_CONNECTIONS=10
REDIS_CONNECTION_TIMEOUT=20
```

### Processing Configuration

#### EMG Analysis Settings

```env
# Signal Processing
SAMPLING_RATE=1000          # Default sampling rate in Hz
FILTER_LOW_FREQ=20          # High-pass filter cutoff
FILTER_HIGH_FREQ=500        # Low-pass filter cutoff
FILTER_ORDER=4              # Butterworth filter order
SMOOTHING_WINDOW=100        # Envelope detection window

# Contraction Detection
MVC_THRESHOLD=0.1           # 10% of maximum amplitude
MIN_CONTRACTION_DURATION=0.1  # 100ms minimum duration
MERGE_THRESHOLD=0.2         # 200ms for merging related contractions
REFRACTORY_PERIOD=0.05      # 50ms refractory period
```

#### Performance Settings

```env
# Processing Limits
MAX_FILE_SIZE=10485760  # 10MB
MAX_PROCESSING_TIME=60  # seconds
WORKER_TIMEOUT=30       # seconds

# Optimization
ENABLE_PARALLEL_PROCESSING=true
NUM_WORKERS=4
CHUNK_SIZE=10000
```

### Frontend Configuration

#### Vite Configuration

```typescript
// vite.config.ts
export default {
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
}
```

#### UI Settings

```env
# Display Options
ENABLE_DEBUG_MODE=false
SHOW_PERFORMANCE_METRICS=true
CHART_UPDATE_INTERVAL=100  # milliseconds

# Feature Flags
ENABLE_EXPORT=true
ENABLE_PRINT=true
ENABLE_SHARING=false
```

## Docker Configuration

### Docker Compose Override

Create `docker-compose.override.yml` for local settings:

```yaml
version: '3.8'

services:
  backend:
    environment:
      - DEBUG=true
      - LOG_LEVEL=debug
    volumes:
      - ./backend:/app
    ports:
      - "5678:5678"  # Debugger port

  frontend:
    environment:
      - VITE_DEV_SERVER_HOST=0.0.0.0
    volumes:
      - ./frontend:/app
      - /app/node_modules
```

### Production Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=warn
    restart: unless-stopped
    
  frontend:
    build:
      args:
        - NODE_ENV=production
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"
```

## Webhook Configuration

### Supabase Storage Webhook

```env
# Webhook Settings
WEBHOOK_SECRET=your-webhook-secret
WEBHOOK_ENDPOINT=/webhooks/storage/c3d-upload
WEBHOOK_TIMEOUT=30

# Webhook Processing
ENABLE_WEBHOOK_RETRY=true
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY=5  # seconds
```

### ngrok for Local Development

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Configure auth token
ngrok config add-authtoken YOUR_TOKEN

# Start tunnel
./start_dev.sh --webhook
```

## Security Configuration

### CORS Settings

```python
# backend/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Rate Limiting

```env
# API Rate Limits
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_PERIOD=60  # seconds
```

## Monitoring Configuration

### Logging

```env
# Log Configuration
LOG_FORMAT=json
LOG_FILE=/var/log/emg-analyzer.log
LOG_MAX_SIZE=100M
LOG_MAX_BACKUPS=10
```

### Health Checks

```env
# Health Check Endpoints
HEALTH_CHECK_PATH=/health
READY_CHECK_PATH=/ready
METRICS_PATH=/metrics
```

## Next Steps

- [First Analysis](./first-analysis) - Process your first C3D file
- [Environment Variables Reference](/docs/devops/environment-config) - Complete list