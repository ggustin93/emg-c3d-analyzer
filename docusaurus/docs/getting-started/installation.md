---
sidebar_position: 2
title: Installation
---

# Installation Guide

Complete setup instructions for the EMG C3D Analyzer development environment.

## System Requirements

### Minimum Requirements
- **OS**: macOS, Linux, or Windows with WSL2
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 5GB free space
- **CPU**: 2+ cores

### Software Prerequisites

#### Python Setup
```bash
# Check Python version (requires 3.11+)
python --version

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install Python dependencies
pip install -r backend/requirements.txt
```

#### Node.js Setup
```bash
# Check Node version (requires 20+)
node --version

# Install frontend dependencies
cd frontend
npm install
```

## Environment Configuration

### 1. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### 2. Configure Supabase

Add your Supabase credentials to `.env`:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379
ENABLE_CACHE=true

# Backend Configuration
BACKEND_PORT=8080
FRONTEND_PORT=3000
```

### 3. Database Setup

Run the database migrations:

```bash
# Apply all migrations
cd backend
python scripts/migrate.py
```

## Docker Installation (Optional)

### Prerequisites
- Docker Desktop installed
- Docker Compose v2+

### Build and Run

```bash
# Build containers
docker-compose build

# Start services
docker-compose up

# Or use the helper script
./start_dev.sh
```

## Verify Installation

### 1. Check Backend

```bash
# Test API endpoint
curl http://localhost:8080/health

# Expected response:
{
  "status": "healthy",
  "version": "1.0.0"
}
```

### 2. Check Frontend

Navigate to http://localhost:3000 and verify the UI loads.

### 3. Run Tests

```bash
# Backend tests
cd backend
python -m pytest tests/ -v

# Frontend tests
cd frontend
npm test
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :8080

# Kill process
kill -9 <PID>
```

#### Python Module Not Found
```bash
# Set PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:${PWD}/backend"
```

#### Node Modules Issues
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- [Configuration](./configuration) - Detailed configuration options
- [First Analysis](./first-analysis) - Process your first C3D file