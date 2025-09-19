---
sidebar_position: 1
title: Introduction
---

# EMG C3D Analyzer Documentation

Welcome to the technical documentation for the **GHOSTLY+ EMG C3D Analyzer** - a rehabilitation technology platform designed to process and analyze Electromyography (EMG) data from C3D files.

## 🎯 Project Overview

The EMG C3D Analyzer processes C3D files from the GHOSTLY rehabilitation game, extracting and analyzing EMG signals for therapeutic assessment. It provides real-time analysis, clinical metrics, and performance scoring for rehabilitation professionals.

### Key Features

- **Real-time EMG Processing**: Analyze C3D files with 175+ seconds of data at 990Hz
- **Clinical Metrics**: RMS, MAV, MPF, MDF, fatigue analysis, and more
- **Performance Scoring**: Evidence-based performance assessment
- **Stateless & Stateful Modes**: Flexible processing for different use cases
- **50x Performance**: Redis caching for lightning-fast repeated operations

## 🏗️ Architecture

The system follows a **4-layer architecture** with Domain-Driven Design:

```
Frontend (React 19) → Backend (FastAPI) → Processing Engine → Supabase
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 19, TypeScript, Zustand | Interactive UI with real-time updates |
| **Backend** | FastAPI, Python 3.11 | EMG processing and API services |
| **Processing** | NumPy, SciPy, ezc3d | Signal analysis and computation |
| **Database** | Supabase (PostgreSQL) | Data persistence and authentication |
| **Infrastructure** | Docker, Coolify | Containerization and deployment |

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (optional)
- Supabase account

### Development Setup

```bash
# Clone the repository
git clone https://github.com/ggustin93/emg-c3d-analyzer.git
cd emg-c3d-analyzer

# Start development environment
./start_dev_simple.sh

# Or with webhook testing
./start_dev_simple.sh --webhook
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- Docs: http://localhost:3001 (this documentation)

## 📚 Next Steps

- Explore the [Architecture Overview](/docs/architecture/overview) to understand the system design
- Review [API Documentation](/docs/api/endpoints/upload) for integration details
- Check out the development workflow guides for your specific role
