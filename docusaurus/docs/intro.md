---
sidebar_position: 1
title: Introduction
---

# Ghostly+ Dashboard Documentation

The Ghostly+ Dashboard is a clinical research platform for processing and analyzing electromyography data from GHOSTLY rehabilitation game sessions. Built with React, FastAPI, and Supabase, it provides therapists with automated signal analysis, contraction detection, and performance metrics to track patient progress. This documentation covers the system architecture, implementation details, and deployment procedures for developers and system administrators.

## Documentation Structure

### 🚀 Getting Started
- [Quick Start](./getting-started/quick-start.md) - Get running in minutes
- [Installation](./getting-started/installation.md) - Detailed setup instructions
- [Configuration](./getting-started/configuration.md) - Environment and settings

### 📍 Roadmap
- [Work in Progress](./roadmap/work-in-progress.md) - Active development and future improvements

### 🏗️ Architecture
- [Overview](./architecture/overview.md) - System design and tech stack
- [Critical Files](./architecture/critical-files.md) - Core components analysis

### 🏥 Clinical
- [Metrics Definitions](./clinical/metrics-definitions.md) - Clinical calculations and scoring

### 📊 Signal Processing
- [Overview](./signal-processing/overview.md) - EMG processing pipeline
- [Butterworth Filtering](./signal-processing/butterworth-filtering.md) - Signal filtering
- [Envelope Detection](./signal-processing/envelope-detection.md) - Amplitude extraction
- [Contraction Detection](./signal-processing/contraction-detection.md) - Event identification
- [Parameters](./signal-processing/parameters.md) - Processing configuration

### ⚙️ Backend
- [Backend Architecture](./backend.md) - FastAPI backend with EMG processing, domain-driven design, and Supabase integration

### 🎨 Frontend
- [Overview](./frontend/overview.md) - Complete React 18.3 architecture with TypeScript, React Router v7, TanStack Query, and Zustand state management

### 🚀 DevOps
- [Overview](./devops/overview.md) - Infrastructure and deployment
- [Backend Deployment](./devops/deployment.md) - Production setup
- [CI/CD](./devops/ci-cd.md) - Automated workflows
- [Docker](./devops/docker.md) - Containerization
- [Coolify](./devops/coolify.md) - Self-hosted PaaS

### 🧪 Testing
- [Overview](./testing/overview.md) - Testing strategy and coverage
- [Backend Testing](./testing/backend-testing.md) - Comprehensive test suite

### 🛠️ Development
- [Infrastructure](./development/infrastructure.md) - Development environment
- [Scripts](./development/scripts.md) - Development and deployment scripts
- [Agentic Development](./development/agentic-development.md) - AI-assisted development
- [Claude Code](./development/claude-code.md) - AI pair programming