---
sidebar_position: 1
title: Backend Overview
---

# Backend Overview

Simple FastAPI backend that processes EMG data from C3D files.

## What It Does

- Processes C3D files → EMG analysis → Clinical metrics
- Stores results in Supabase PostgreSQL 
- Serves REST API for frontend
- Handles file uploads via webhooks

## Key Files

- `backend/main.py` - FastAPI app
- `backend/processor.py` - EMG processing engine (1,341 lines)
- `backend/api/routes/` - REST endpoints
- `backend/services/` - Business logic
- `backend/tests/` - 135 tests

## Architecture Decisions

- **Synchronous Supabase client** (not async) - simpler testing
- **Repository pattern** - clean data access
- **RLS for authorization** - backend only validates JWTs
- **Redis caching** - for expensive EMG calculations

## Running

```bash
cd backend
uvicorn main:app --reload --port 8080
```