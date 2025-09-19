---
sidebar_position: 3
title: Database Integration
---

# Database Integration

Uses Supabase PostgreSQL with Repository pattern.

## Key Principle

**Backend validates JWTs, database enforces authorization via RLS policies.**

## Repository Pattern

Clean separation between business logic and database access.

**Files:**
- `services/*/repositories/` - Repository interfaces and implementations
- `services/*/models/` - Data models

**Example:** `TherapySessionRepository` in `services/clinical/repositories/`

## Supabase Client

**Critical:** Uses **synchronous** Supabase client (not async).

**Why:** Simpler testing - use `MagicMock`, never `AsyncMock`.

**Import:** `from supabase import Client, create_client`

## Database Tables

- `therapy_sessions` - Session metadata
- `emg_contractions` - Individual muscle contractions  
- `performance_scores` - Clinical metrics
- `patients` - Patient data
- `user_roles` - Role assignments

## Row Level Security (RLS)

All authorization handled by database policies, not backend code.

**Example policy:** Users can only access their own sessions or sessions where they're the therapist.

Reference: SQL files in `supabase/migrations/`