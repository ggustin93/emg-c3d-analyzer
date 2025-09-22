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

## 3. API Routes

The backend exposes 13 RESTful endpoints without `/api` prefix (handled by Vite proxy):

| Route | Purpose | Module |
|-------|---------|---------|
| `/health` | System health checks | health.py |
| `/upload` | Direct C3D file processing | upload.py (194 lines) |
| `/analysis` | EMG analysis operations | analysis.py |
| `/export` | Data export functionality | export.py |
| `/mvc` | MVC calibration management | mvc.py |
| `/signals` | Signal processing utilities | signals.py |
| `/webhooks` | Supabase event handlers | webhooks.py (349 lines) |
| `/config` | Configuration defaults | config_defaults.py |
| `/scoring` | Scoring configuration API | scoring_config.py |
| `/cache` | Cache monitoring endpoints | cache_monitoring.py |
| `/logs` | Frontend log collection | logs.py |
| `/therapists` | Therapist resolution | therapist_resolution.py |

## 4. Core Services

Domain-driven services implementing business logic:

### Processing Services
- `processor.py` (1,505 lines) - Single source of truth for EMG analysis
- `therapy_session_processor.py` (1,840 lines) - Session orchestration
- `emg_analysis.py` (707 lines) - Clinical metric calculations
- `signal_processing.py` - Low-level signal operations

### Repository Pattern
- `TherapySessionRepository` - Session data access
- `PatientRepository` - Patient record management
- `UserRepository` - User authentication data
- All repositories use synchronous Supabase client (KISS principle)

## 5. Testing Organization

### Test Suite Metrics
- **Total Tests**: 135 tests with 95% success rate
- **Test Files**: 47 files across multiple categories
- **Coverage**: 47% code coverage, 98% on critical EMG algorithms

### Test Categories
```
tests/
├── unit/          # 21 tests - Algorithm validation
├── integration/   # 54 tests - Service interactions
├── api/          # 32 tests - Endpoint validation
└── e2e/          # 9 tests - Complete workflows
```

## 6. Operational Configuration

### Development Commands
```bash
# Standard development
cd backend
uvicorn main:app --reload --port 8080

# With webhook testing
./start_dev.sh --webhook

# Run test suite
python -m pytest tests/ -v
```

### Required Environment Variables
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-jwt-secret
REDIS_URL=redis://localhost:6379
```

### Key Implementation Decisions
- **Synchronous Supabase client** - Simplifies testing and avoids async complexity
- **Repository pattern** - Clean separation between services and data access
- **Domain organization** - Services and models grouped by business domain
- **RLS enforcement** - Database handles authorization, backend only validates JWTs