---
sidebar_position: 2
title: API Design
---

# API Design

FastAPI backend with two processing modes.

## Routes

- **POST /upload** - Direct C3D processing, returns full results
- **POST /webhooks/storage/c3d-upload** - Background processing via Supabase webhooks
- **GET /sessions** - List therapy sessions
- **POST /sessions** - Create session
- **GET /health** - Health check

## Two Processing Modes

### 1. Stateless Mode (`/upload`)
- Upload C3D → process immediately → return results
- For testing and preview
- File: `api/routes/upload.py` (194 lines)

### 2. Stateful Mode (`/webhooks`)  
- File uploaded to Supabase Storage → webhook triggers processing → results saved to database
- For production workflows
- File: `api/routes/webhooks.py` (349 lines)

## Key Files

- `api/routes/upload.py` - Direct file processing
- `api/routes/webhooks.py` - Background webhook processing  
- `api/routes/therapy_sessions.py` - Session CRUD
- `dependencies.py` - FastAPI dependency injection

## Authentication

Backend only validates JWT tokens. All authorization handled by Supabase RLS policies.

Reference: `get_current_user()` in `dependencies.py`