---
sidebar_position: 1
title: Development Scripts
---

# Development Scripts Reference

Comprehensive guide to all development scripts and utilities for the Ghostly+ Dashboard.

## Primary Development Scripts

### start_dev_simple.sh

The main development script that handles everything automatically.

```bash
# Basic usage - starts backend and frontend
./start_dev_simple.sh

# Run with tests
./start_dev_simple.sh --test

# Run with webhook support (ngrok tunnel)
./start_dev_simple.sh --webhook
```

**What it does:**
- Installs all dependencies (Python and Node)
- Creates virtual environment if needed
- Starts backend server on port 8080
- Starts frontend server on port 3000
- Opens browser automatically
- Handles cleanup on exit (Ctrl+C)

### start_dev.sh

Docker-based development environment with full service orchestration.

```bash
# Start Docker environment
./start_dev.sh

# With webhook testing (includes ngrok)
./start_dev.sh --webhook

# With specific services
./start_dev.sh --services backend,frontend,redis
```

**Features:**
- Docker Compose orchestration
- Redis cache integration
- ngrok tunnel for webhooks
- Database migrations
- Health checks

## Testing Scripts

### Backend Testing

```bash
# Run all backend tests (33 tests)
cd backend
source venv/bin/activate
python -m pytest tests/ -v

# Run with coverage
python -m pytest tests/ --cov=backend --cov-report=html

# Run specific test categories
python -m pytest tests/test_emg_analysis.py -v    # Unit tests
python -m pytest tests/test_api_endpoints.py -v    # API tests
python -m pytest tests/test_e2e* -v -s            # E2E tests
```

### Frontend Testing

```bash
# Run all frontend tests (78 tests)
cd frontend
npm test -- --run        # Run once
npm test                 # Watch mode

# Run with coverage
npm test -- --coverage

# Run specific test suites
npm test components      # Component tests
npm test hooks          # Hook tests
```

## Build Scripts

### Frontend Build

```bash
cd frontend

# Development build
npm run dev

# Production build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint
```

### Backend Build

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Install development dependencies
pip install -r requirements-dev.txt

# Format code
black .

# Lint code
ruff check .
```

## Database Scripts

### Migration Management

```bash
cd backend

# Apply all migrations
python scripts/migrate.py

# Create new migration
python scripts/create_migration.py "migration_name"

# Rollback last migration
python scripts/rollback_migration.py

# Reset database (development only)
python scripts/reset_db.py
```

## Webhook Development

### ngrok Integration

```bash
# One-time setup
ngrok config add-authtoken YOUR_TOKEN

# Start with webhook support
./start_dev_simple.sh --webhook

# Manual ngrok tunnel
ngrok http 8080

# Monitor webhook activity
tail -f logs/backend.error.log | grep -E "(🚀|📁|🔄|✅|❌|📊)"
```

**Webhook Configuration in Supabase:**
1. Copy the ngrok URL from terminal
2. Go to Supabase Dashboard → Storage → Webhooks
3. Add webhook URL: `https://YOUR_NGROK_URL.ngrok-free.app/webhooks/storage/c3d-upload`
4. Test by uploading files to the `c3d-examples` bucket

## Utility Scripts

### Log Management

```bash
# View backend logs
tail -f logs/backend.log
tail -f logs/backend.error.log

# Clear logs
rm logs/*.log

# Monitor specific patterns
tail -f logs/backend.error.log | grep "ERROR"
tail -f logs/backend.log | grep "therapy_session"
```

### Process Management

```bash
# Find processes on specific ports
lsof -i :8080    # Backend
lsof -i :3000    # Frontend
lsof -i :3200    # Docusaurus

# Kill processes
kill -9 $(lsof -t -i:8080)
kill -9 $(lsof -t -i:3000)

# Check running services
ps aux | grep python
ps aux | grep node
```

### Environment Setup

```bash
# Create environment file
cp .env.example .env

# Activate Python virtual environment
source backend/venv/bin/activate  # macOS/Linux
backend\venv\Scripts\activate     # Windows

# Deactivate virtual environment
deactivate

# Update dependencies
cd backend && pip install -r requirements.txt
cd frontend && npm install
```

## Docker Commands

### Container Management

```bash
# Build containers
docker-compose build

# Start services
docker-compose up
docker-compose up -d  # Detached mode

# Stop services
docker-compose down
docker-compose down -v  # Remove volumes

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Execute commands in containers
docker-compose exec backend bash
docker-compose exec frontend sh
```

### Debugging

```bash
# Check container status
docker-compose ps

# Inspect container
docker inspect emg-backend
docker inspect emg-frontend

# Clean up Docker resources
docker system prune -a
docker volume prune
```

## Performance Monitoring

### Backend Performance

```bash
# Profile backend with cProfile
cd backend
python -m cProfile -o profile.stats main.py

# Analyze profile
python -m pstats profile.stats

# Memory profiling
pip install memory_profiler
python -m memory_profiler main.py
```

### Frontend Performance

```bash
# Bundle analysis
cd frontend
npm run build -- --analyze

# Lighthouse audit
npm run lighthouse

# Performance profiling
npm run profile
```

## Deployment Scripts

### Production Build

```bash
# Full production build
./scripts/build_production.sh

# Backend only
cd backend && ./build_prod.sh

# Frontend only
cd frontend && npm run build
```

### Deployment

```bash
# Deploy to Vercel (frontend)
vercel deploy

# Deploy to production
./scripts/deploy_prod.sh

# Rollback deployment
./scripts/rollback_prod.sh
```

## Troubleshooting Scripts

### Common Issues

```bash
# Fix permission issues
chmod +x start_dev_simple.sh
chmod +x start_dev.sh

# Clear caches
cd frontend && rm -rf node_modules/.cache
cd backend && find . -type d -name __pycache__ -exec rm -r {} +

# Reset everything
rm -rf backend/venv
rm -rf frontend/node_modules
rm -rf logs/*
./start_dev_simple.sh  # Will reinstall everything
```

### Debug Mode

```bash
# Backend debug mode
cd backend
DEBUG=true uvicorn main:app --reload --port 8080

# Frontend debug mode
cd frontend
VITE_DEBUG=true npm run dev

# Enable all logging
export LOG_LEVEL=debug
./start_dev_simple.sh
```

## Script Best Practices

### Error Handling
- All scripts should exit on error: `set -e`
- Provide clear error messages
- Clean up resources on exit

### Logging
- Use consistent log format
- Include timestamps
- Separate info and error logs

### Documentation
- Include help text in scripts
- Document environment variables
- Provide usage examples

## Environment Variables Reference

### Required Variables
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

### Optional Variables
```bash
REDIS_URL=redis://localhost:6379
ENABLE_CACHE=true
LOG_LEVEL=info
NODE_ENV=development
```

## Quick Reference

| Task | Command |
|------|---------|
| Start development | `./start_dev_simple.sh` |
| Run all tests | `./start_dev_simple.sh --test` |
| Start with webhooks | `./start_dev_simple.sh --webhook` |
| Backend tests only | `cd backend && pytest tests/ -v` |
| Frontend tests only | `cd frontend && npm test -- --run` |
| Build frontend | `cd frontend && npm run build` |
| Check types | `cd frontend && npm run type-check` |
| Format Python | `cd backend && black .` |
| View logs | `tail -f logs/backend.error.log` |
| Kill backend | `kill -9 $(lsof -t -i:8080)` |
| Reset environment | `rm -rf venv node_modules && ./start_dev_simple.sh` |