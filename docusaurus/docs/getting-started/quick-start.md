---
sidebar_position: 1
title: Quick Start
---

# Quick Start Guide

Get the EMG C3D Analyzer up and running in under 5 minutes!

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
- **Documentation**: http://localhost:3002

## 4. Upload Your First C3D File

1. Navigate to the Upload tab
2. Click "Choose File" and select a C3D file
3. Click "Upload and Process"
4. View the analysis results in real-time!

## Test Data

Use our sample C3D file for testing:
- **File**: `Ghostly_Emg_20230321_17-50-17-0881.c3d`
- **Size**: 2.74MB
- **Duration**: 175.1 seconds
- **Expected Results**: 20 CH1 and 9 CH2 contractions

## Next Steps

- [Installation Guide](./installation) - Detailed setup instructions
- [Configuration](./configuration) - Environment variables and settings
- [First Analysis](./first-analysis) - Understanding the results