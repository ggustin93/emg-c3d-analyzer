---
sidebar_position: 1
title: Getting Started
---

# Getting Started

Get your EMG C3D Analyzer running in 5 minutes! This guide walks you through the quickest path from download to analyzing rehabilitation data.

## Prerequisites

Before you begin, ensure you have:

- ✅ **Python 3.11 or later**
- ✅ **Node.js 20 or later**  
- ✅ **Git** for cloning the repository
- ✅ **Supabase account** ([Free tier](https://supabase.com) works perfectly)

## 🚀 Quick Start (3 Steps)

### Step 1: Clone and Install

```bash
git clone https://github.com/ggustin93/emg-c3d-analyzer.git
cd emg-c3d-analyzer
./start_dev_simple.sh --install
```

✨ **What this does:**
- Creates a Python virtual environment automatically
- Installs all backend and frontend dependencies
- Sets up everything you need to run the app

### Step 2: Configure Supabase

Create configuration files from the examples:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Then edit both `.env` files with your Supabase credentials:

**Backend `.env`:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
SUPABASE_ANON_KEY=your-anon-key-here
```

**Frontend `.env`:**
```env
VITE_BACKEND_URL=http://localhost:8080
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> 🔐 **Security Note**: Never commit `.env` files! The service key has admin privileges - keep it secret.

📍 **Find your keys**: [Supabase Dashboard](https://supabase.com/dashboard) → Settings → API

### Step 3: Launch! 🚀

```bash
./start_dev_simple.sh
```

Your app is now running at:
- 🎨 **Frontend**: http://localhost:3000 (configured port)
- ⚙️ **Backend API**: http://localhost:8080
- 📚 **API Docs**: http://localhost:8080/docs

## ✅ Verify Everything Works

### Quick Health Check
```bash
curl http://localhost:8080/health
```
Expected response: `{"status": "healthy", "version": "1.0.0"}`

### Upload a Test File
1. Open http://localhost:3000 in your browser
2. Click "Upload C3D File"
3. Select a test file
4. Success! You should see EMG analysis results 🎉

## 🔧 Common Issues & Quick Fixes

<details>
<summary>Port already in use</summary>

If you see "Address already in use" errors:

```bash
# Kill services on the ports
./start_dev_simple.sh --kill

# Or manually find and stop the process:
lsof -i :8080  # or :3000 for frontend
kill -9 <PID>
```
</details>

<details>
<summary>Missing dependencies</summary>

If the app won't start due to missing packages:

```bash
# Re-run with install flag
./start_dev_simple.sh --install
```
</details>

<details>
<summary>Frontend shows on different port</summary>

The frontend is configured to run on port 3000. If that port is busy, Vite will automatically try 3001, 3002, etc. Check your terminal output for the actual URL.
</details>

<details>
<summary>Supabase connection fails</summary>

1. Verify your `.env` files exist in both root and frontend directories
2. Check that your Supabase project is active (not paused)
3. Confirm your API keys are correctly copied (no extra spaces)
</details>

<details>
<summary>Redis connection issues (optional)</summary>

Redis is optional for development. If you see Redis warnings:
- Install Redis: `brew install redis` (macOS) or `apt install redis` (Ubuntu)
- Or just ignore the warnings - the app works without caching
</details>

## 🎯 What's Next?

### Essential Commands
- **Run tests**: `./start_dev_simple.sh --test`
- **Stop all services**: `./start_dev_simple.sh --kill`
- **Backend only**: `./start_dev_simple.sh --backend-only`
- **Enable webhooks**: `./start_dev_simple.sh --webhook`

### Learn More
- 📖 [API Documentation](http://localhost:8080/docs) - Interactive API explorer
- 🧪 [Testing Guide](./testing.md) - Running the test suite
- 🚀 [Deployment Guide](./deployment.md) - Production deployment
- 🔧 [Development Guide](./development.md) - Advanced development setup

### Optional Enhancements
- **Redis** for caching: `brew install redis` (macOS) or `apt install redis` (Ubuntu)
- **ngrok** for webhooks: `brew install ngrok` then `ngrok config add-authtoken YOUR_TOKEN`
- **Docker** alternative: See [Docker Setup](./docker.md) for containerized development

---

<details>
<summary>📚 Advanced: Manual Installation</summary>

If the automated script doesn't work on your system, you can set up manually:

### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

### Frontend Setup (new terminal)
```bash
cd frontend
npm install
npm start  # or npm run dev
```

The frontend will start on port 3000 (configured in vite.config.ts), or 3001/3002/etc. if that port is busy.
</details>

<details>
<summary>🐳 Advanced: Docker Setup</summary>

For a fully containerized environment:

```bash
./start_dev_docker.sh
```

This runs everything in Docker containers with hot-reload enabled. See [Docker Guide](./docker.md) for details.
</details>

