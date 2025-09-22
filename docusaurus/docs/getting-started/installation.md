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
- **Browser**: Chrome, Firefox, Safari, or Edge (latest versions)
- **Network**: Internet connection for Supabase integration

### Software Prerequisites
- **Python**: 3.11 or higher
- **Node.js**: 20.0.0 or higher
- **Git**: For version control
- **Docker**: Optional, for containerized deployment
- **Redis**: 7.2+ (optional, for caching)

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

## Installation Methods

### Method 1: Simple Development Script (Recommended)

The easiest way to get started:

```bash
# Clone the repository
git clone https://github.com/ggustin93/emg-c3d-analyzer.git
cd emg-c3d-analyzer

# Start everything with one command
./start_dev_simple.sh

# This will:
# - Install all dependencies
# - Start backend server (port 8080)
# - Start frontend server (port 3000)
# - Open your browser automatically
```

### Method 2: Docker Installation

#### Prerequisites
- Docker Desktop installed
- Docker Compose v2+

#### Build and Run

```bash
# Build containers
docker-compose build

# Start services
docker-compose up

# Or use the helper script
./start_dev.sh
```

### Method 3: Manual Installation

Follow the Python and Node.js setup steps above, then:

```bash
# Start backend
cd backend
uvicorn main:app --reload --port 8080

# Start frontend (new terminal)
cd frontend
npm start
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

