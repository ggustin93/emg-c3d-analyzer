---
sidebar_position: 1
title: Getting Started
---

# Getting Started

Get the Ghostly+ EMG analyzer running in under 3 minutes.

## Prerequisites

Choose your development approach:

### 🐳 Docker (Recommended)
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** 
- **[Supabase account](https://supabase.com)** (free tier)

:::info Why Docker is Recommended
- **Complex Dependencies**: Automatically handles C++ libraries (libeigen3-dev, cmake) required for EMG processing
- **Cross-Platform Consistency**: Works identically on Windows, Mac, and Linux
- **Production Parity**: Development environment matches deployment infrastructure
- **Zero Configuration**: No need to manage Python virtual environments or Node.js versions
:::

### 🛠️ Native Development  
- **Python 3.11+** and **Node.js 20+**
- **[Supabase account](https://supabase.com)** (free tier)
- **System dependencies** (C++ libraries for EMG processing)

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/ggustin93/emg-c3d-analyzer.git
cd emg-c3d-analyzer
```

### 2. Configure Environment

Copy the template and add your credentials from [Supabase Dashboard](https://supabase.com/dashboard) → Settings → API:

```bash
cp .env.example .env
```

Then edit `.env` with your values:

```env
# Backend configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here

# Frontend configuration  
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

#### 🔧 Configuration Files

The system uses two main configuration files that work automatically with your `.env` settings:
- **Frontend**: `frontend/src/config/apiConfig.ts` - Handles API routing and environment detection for seamless deployment
- **Backend**: `backend/config.py` - Contains EMG processing parameters and clinical defaults for medical accuracy

No manual editing required - these files automatically adapt to your environment configuration.

### 3. Start Development

**🐳 Docker (Recommended)**
```bash
# All Platforms - Direct Commands
docker compose -f docker/compose/docker-compose.dev.yml --env-file .env up -d --build

# View logs
docker compose -f docker/compose/docker-compose.dev.yml logs -f

# Stop services  
docker compose -f docker/compose/docker-compose.dev.yml down

# Linux/macOS - Wrapper Script (if preferred)
./start_dev_docker.sh
```

**🛠️ Native Development**
```bash
# Recommended: Use Python virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Start development servers
./start_dev_simple.sh
```

**📚 Documentation Server** *(Optional)*
```bash
cd docusaurus
npm install && npm start
# Opens at http://localhost:3200
# Note: For search functionality, use: npm run build && npm run serve
```

### 🔍 Search Functionality

The documentation includes a powerful search feature using local search indexing:

**For Search Functionality:**
```bash
cd docusaurus
npm run build  # Generates search index (required)
npm run serve  # Serves with full search functionality
```

**Development Mode (Limited Search):**
```bash
cd docusaurus
npm start
# Basic site development - search index not generated
```

**Search Features:**
- **Full-text search** across all documentation
- **Smart highlighting** of search terms in results
- **Keyboard shortcut**: `Ctrl/Cmd + K` to open search
- **Local indexing** - works offline, no external dependencies

:::note Search Index Requirement
The search index is generated during the build process (`npm run build`). For development with search functionality, use `npm run serve` after building.
:::

### ✅ Verify Success

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8080/health  
- **Documentation**: http://localhost:3200 *(if running Docusaurus)*
- **API Docs**: http://localhost:8080/docs

## Troubleshooting

**Port conflicts**: Script handles automatically  
**Dependencies**: Re-run `./start_dev_simple.sh`  
**Supabase errors**: Check your `.env` keys  
**Different port**: Check terminal for actual URL

<details>
<summary>Manual Setup (if scripts fail)</summary>

**Backend:**
```bash
cd backend && python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

**Frontend:**
```bash
cd frontend && npm install && npm start
```

</details>

---

## 📚 Essential Docker References

- **[Docker Official Getting Started](https://docs.docker.com/get-started/)** - Complete beginners guide
- **[Docker Compose Documentation](https://docs.docker.com/compose/)** - Multi-container application management
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** - User-friendly local development environment

### Key Docker Compose Commands
```bash
# Start services
docker compose -f docker/compose/docker-compose.dev.yml --env-file .env up -d --build

# View logs  
docker compose -f docker/compose/docker-compose.dev.yml logs -f

# Stop services
docker compose -f docker/compose/docker-compose.dev.yml down

# Validate configuration
docker compose -f docker/compose/docker-compose.dev.yml config
```

---

**Next**: [Development Guide](./development.md) for advanced workflows and testing.

