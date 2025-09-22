---
sidebar_position: 1
title: Quick Start
---

# Quick Start Guide

Get the Ghostly+ Dashboard up and running in under 5 minutes!

## Prerequisites

Before you begin, ensure you have:

- **Python 3.11+** installed
- **Node.js 20+** installed
- **Git** for version control
- **Supabase account** (free tier works)

## 1. Clone the Repository

```bash
git clone https://github.com/ggustin93/emg-c3d-analyzer.git
cd emg-c3d-analyzer
```

## 2. Start Development Environment

### Option A: Simple Development (Recommended)

```bash
./start_dev_simple.sh
```

This will:
- Install all dependencies
- Start the backend server (port 8080)
- Start the frontend server (port 3000)
- Open your browser automatically

### Option B: Docker Development

```bash
./start_dev.sh
```

This will:
- Build Docker containers
- Start all services
- Setup database migrations

## 3. Access the Application

Once running, you can access:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/docs
- **Documentation**: http://localhost:3200

