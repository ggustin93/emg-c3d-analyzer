---
sidebar_position: 1
title: Getting Started
---

# Getting Started

This guide covers quick installation and setup of the Ghostly+ Dashboard for EMG analysis and rehabilitation data processing.

## Prerequisites

Before you begin, ensure you have:

- ✅ **Python 3.11 or later**
- ✅ **Node.js 20 or later**  
- ✅ **Git** for cloning the repository
- ✅ **Supabase account** ([Free tier](https://supabase.com) works perfectly)

## 🚀 Quick Start (3 Steps)

### Step 1: Clone

```bash
git clone https://github.com/ggustin93/emg-c3d-analyzer.git
cd emg-c3d-analyzer
```

### Step 2: Configure Environment

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
 **Find your keys**: [Supabase Dashboard](https://supabase.com/dashboard) → Settings → API

### Step 3: Start and Launch! 🚀

Choose your development method:

**Option A: Native Development**
```bash
./start_dev_simple.sh
```
- Creates Python virtual environment automatically
- Installs backend and frontend dependencies
- Direct access to source code and processes

**Option B: Docker Development**
```bash
./start_dev_docker.sh
```
- Creates isolated containers for backend and frontend services
- Handles cross-platform compatibility (Intel/ARM64)
- Provides consistent environment across machines

:::info Docker Requirements
- Docker Desktop installed ([Download here](https://www.docker.com/products/docker-desktop/))
- Minimum 4GB RAM (8GB+ recommended)
- CPU with virtualization support (Intel VT-x or AMD-V)
:::

Both scripts automatically:
- ✅ Clean up processes using required ports
- ✅ Start backend and frontend servers
- ✅ Monitor server health
- ✅ Provide detailed logging

Your app is now running at:
-  **Frontend**: http://localhost:3000 (configured port)
-  **Backend API**: http://localhost:8080
-  **API Docs**: http://localhost:8080/docs

> **💡 Pro tip**: The script automatically handles port conflicts! If something is already running on port 8080 or 3000, it will clean it up for you (with confirmation).

## Verify Everything Works

### Quick Health Check
```bash
curl http://localhost:8080/health
```
Expected response: `{"status": "healthy", "timestamp": "2025-01-XX..."}`

## 🔧 Common Issues & Quick Fixes

<details>
<summary>Port already in use</summary>

**No action needed!** The script now automatically handles port conflicts by default.

If you see "Address already in use" errors and automatic cleanup was disabled:

```bash
# Just run the script normally - it will clean up ports automatically
./start_dev_simple.sh

# Or if you disabled automatic cleanup, re-enable it:
./start_dev_simple.sh --kill-ports

# To manually check what's using a port:
lsof -i :8080  # or :3000 for frontend
```

> **Note**: The script will ask for confirmation before killing processes unless running in `--verbose` mode.
</details>

<details>
<summary>Missing dependencies</summary>

If the app won't start due to missing packages:

```bash
# Re-run to install missing dependencies
./start_dev_simple.sh
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

For advanced Docker operations and development workflows, see [Development Guide](./development.md).

