---
sidebar_position: 1
title: Backend Overview
---

# Backend Overview

FastAPI + Supabase unified stack for EMG data processing with domain-driven architecture.

## Service Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      API Layer                           │
│                   13 Route Modules                       │
└─────────┬────────────────────────────────────┬───────────┘
          ▼                                    ▼
┌──────────────────┐                 ┌────────────────────┐
│  Orchestration   │                 │   Processing       │
│    Services      │                 │    Services        │
├──────────────────┤                 ├────────────────────┤
│ • Clinical       │────────────────►│ • C3D Parser       │
│ • Performance    │                 │ • EMG Analysis     │
│ • Weight Manager │◄────────────────│ • Signal Process   │
└──────────────────┘                 └────────────────────┘
          │                                    │
          ▼                                    ▼
┌──────────────────────────────────────────────────────────┐
│                  Repository Layer                        │
│         (Clinical • Patient • User • Scoring)            │
└──────────┬───────────────────────────────────────────────┘
           ▼
┌──────────────────────────────────────────────────────────┐
│           Supabase Client + PostgreSQL RLS               │
└──────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **API** | FastAPI | HTTP routing, validation, OpenAPI docs |
| **Processing** | NumPy, SciPy, ezc3d | EMG signal analysis |
| **Cache** | Redis 7.2 | Session data, expensive calculations |
| **Database** | PostgreSQL + RLS | Data persistence, authorization |
| **Client** | Supabase (sync) | Database operations, auth, storage |

## Directory Structure

```
backend/
├── api/                    # API Layer
│   └── routes/            # 13 endpoints (no /api prefix)
├── services/              # Service Layer (9 domains)
│   ├── analysis/          # Analysis coordination
│   ├── c3d/              # C3D processing (processor.py - 1,505 lines)
│   ├── cache/            # Redis operations
│   ├── clinical/         # Session orchestration (1,840 lines)
│   ├── data/             # Data management
│   ├── infrastructure/   # System utilities
│   ├── patient/          # Patient management
│   ├── shared/           # Shared repositories
│   └── user/             # User operations
├── models/               # Pydantic Models
├── emg/                  # Signal Algorithms
├── database/             # Supabase Config
└── tests/                # 135 tests (95% pass rate)
```

## API Endpoints

| Route | Purpose | Category | Lines |
|-------|---------|----------|-------|
| `/health` | Health checks | System | - |
| `/upload` | Direct C3D processing | **Core** | 194 |
| `/webhooks` | Event handlers | **Core** | 349 |
| `/analysis` | EMG analysis | Processing | - |
| `/signals` | Signal utilities | Processing | - |
| `/mvc` | MVC calibration | Clinical | - |
| `/export` | Data export | Data | - |
| `/scoring` | Score config | Clinical | - |
| `/therapists` | Therapist lookup | User | - |
| `/cache` | Cache monitor | System | - |
| `/logs` | Frontend logs | System | - |
| `/config` | Defaults | Config | - |

## Critical Path Flow

```
Upload C3D → Validate → Process EMG → Score Performance → Save
     │           │           │              │              │
  194 lines   Auth JWT   1,505 lines   1,840 lines    Repositories
```

## Service Layer Architecture

### Core Processing (Heavy Compute)
```
processor.py (1,505) ──► EMG algorithms, signal analysis
therapy_session_processor.py (1,840) ──► Session orchestration
performance_scoring_service.py ──► Clinical scoring logic
```

### Repository Pattern (Data Access)
```
TherapySessionRepository ──► therapy_sessions table
PatientRepository ──► patients table  
UserRepository ──► user_profiles table
ScoringConfigRepository ──► scoring_configurations table
```

### Design Decisions
- **Sync Supabase Client**: Simplifies testing, avoids async complexity
- **Repository Pattern**: Clean separation between services and data
- **Domain Organization**: Services grouped by business domain
- **RLS Authorization**: Database handles permissions, API validates JWT

## Testing & Performance

### Test Coverage
```
┌─────────────┬────────┬──────────┬───────────┐
│ Category    │ Tests  │ Coverage │ Critical  │
├─────────────┼────────┼──────────┼───────────┤
│ Unit        │ 21     │ 87%      │ ✅ 98%    │
│ Integration │ 54     │ 62%      │ ✅ 95%    │
│ API         │ 32     │ 71%      │ ✅ 100%   │
│ E2E         │ 9      │ 100%     │ ✅ 100%   │
│ Total       │ 135    │ 47%      │ ✅ 95%    │
└─────────────┴────────┴──────────┴───────────┘
```

### Performance Bottlenecks
```
C3D Processing: ~2.5s per file
EMG Analysis: ~1.8s per channel
Database Write: ~200ms per session
Cache Hit Rate: 78% (Redis)
```

## Development Setup

### Quick Start
```bash
cd backend
uvicorn main:app --reload --port 8080  # Standard dev
./start_dev.sh --webhook                # With ngrok tunnel
python -m pytest tests/ -v              # Run tests
```

### Environment Variables
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
JWT_SECRET=xxx
REDIS_URL=redis://localhost:6379
```

## Architectural Principles

1. **Domain-Driven Design**: Services organized by business domain
2. **Repository Pattern**: Data access abstraction layer
3. **KISS Principle**: Sync client, simple patterns
4. **Single Responsibility**: Each service has one clear purpose
5. **RLS Authorization**: Database as single source of truth