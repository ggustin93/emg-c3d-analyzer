---
sidebar_position: 2
title: API Design
---

# API Design

The system provides two complementary API surfaces following the KISS principle - use the simplest tool that solves the problem.

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │───►  │   FastAPI    │───►  │  Processing │
│   (React)   │      │   Backend    │      │   (Python)  │
└─────────────┘      └──────────────┘      └─────────────┘
       │                                           │
       │                                           │
       ▼                                           ▼
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Supabase  │───►  │   Database   │───►  │     RLS     │
│    Client   │      │  PostgreSQL  │      │   Policies  │
└─────────────┘      └──────────────┘      └─────────────┘
```

## API Documentation

**FastAPI Swagger**: http://localhost:8080/docs  
**Supabase API**: https://supabase.com/dashboard/project/egihfsmxphqcsjotmhmm/api

> ⚠️ Some Swagger routes are obsolete and pending cleanup

## Decision Tree: FastAPI vs Direct Supabase

```
Is it computational? ──Yes──► FastAPI
       │                     (EMG, C3D, NumPy)
       No
       ▼
Is it simple CRUD?  ──Yes──► Direct Supabase
       │                     (Notes, profiles)
       No
       ▼
    FastAPI
```

### Use FastAPI For
- **EMG Processing**: Signal analysis, contraction detection
- **Binary Files**: C3D parsing and validation
- **Heavy Computation**: NumPy, SciPy algorithms
- **Webhooks**: Event-driven background processing
- **External APIs**: Third-party integrations

### Use Direct Supabase For
- **CRUD Operations**: Simple database queries
- **Authentication**: User management, JWT
- **Real-time**: Live subscriptions
- **File Storage**: Direct uploads/downloads
- **RLS**: Database-enforced security

## Processing Modes

### Stateless Mode (`/upload`)
```
C3D File ──► FastAPI ──► Process ──► JSON Results
            (No DB)               (Immediate)
```

### Stateful Mode (`/webhooks`)
```
Storage ──► Webhook ──► Session ──► Process ──► Database
         (Event)     (Create)    (Async)    (Persist)
```

## Core Endpoints

| Endpoint | Method | Purpose | Mode |
|----------|--------|---------|------|
| `/upload` | POST | Direct C3D processing | Stateless |
| `/webhooks/storage/c3d-upload` | POST | Background processing | Stateful |
| `/health` | GET | Health check | Monitor |
| `/logs/frontend` | POST | Error logging | Debug |

## Service Layer Interactions

```
         API Routes                    Service Layer
    ┌────────────────┐           ┌─────────────────────┐
    │ upload.py      │──────────►│ processor.py        │
    │ (194 lines)    │           │ (1,505 lines)      │
    └────────────────┘           └─────────────────────┘
                                          │
    ┌────────────────┐                    ▼
    │ webhooks.py    │           ┌─────────────────────┐
    │ (349 lines)    │──────────►│ therapy_session_    │
    └────────────────┘           │ processor.py        │
                                 │ (1,840 lines)      │
                                 └──────┬──────────────┘
                                        │
                              ┌─────────▼──────────┐
                              │   Repositories     │
                              │  (Sync Supabase)   │
                              └────────────────────┘
```

## Error Handling & Resilience

```
Request ──► Validation ──► Processing ──► Response
   │            │              │             │
   ▼            ▼              ▼             ▼
400 Bad     401 Unauth    500 Server    200 Success
Request     No/Invalid    Processing    + Data
            JWT           Error
```

### Error Response Format
```json
{
  "error": "Processing failed",
  "detail": "Invalid EMG channel data",
  "status_code": 422,
  "request_id": "uuid-here"
}
```

## Authentication Flow

```
Frontend          Supabase          FastAPI          Database
────────          ────────          ───────          ────────
    │                 │                 │                │
    ├──Login──────────►                 │                │
    │                 │                 │                │
    ◄──JWT Token──────┤                 │                │
    │                 │                 │                │
    ├──API Request──────────────────────►                │
    │                 │           Validate JWT           │
    │                 │                 │                │
    │                 │                 ├──Query─────────►
    │                 │                 │           RLS Filter
    │                 │                 ◄──Results───────┤
    │                 │                 │                │
    ◄──Response───────────────────────────┤                │
```

## Implementation Patterns

### FastAPI Pattern
```javascript
// Complex processing requiring server
const response = await fetch(`${API_CONFIG.baseUrl}/upload`, {
  method: 'POST',
  body: formData  // C3D file
})
```

### Direct Supabase Pattern
```javascript
// Simple CRUD - no backend needed
const { data } = await supabase
  .from('therapy_sessions')
  .select('*')
  .eq('patient_id', userId)
```

## Quick Reference

```yaml
Decision Matrix:
  ┌──────────────────┬─────────────┬──────────────┐
  │ Operation        │ FastAPI     │ Supabase     │
  ├──────────────────┼─────────────┼──────────────┤
  │ EMG Processing   │ ✅          │              │
  │ CRUD Operations  │             │ ✅           │
  │ Authentication   │             │ ✅           │
  │ File Processing  │ ✅          │              │
  │ Real-time        │             │ ✅           │
  │ Heavy Compute    │ ✅          │              │
  │ Webhooks         │ ✅          │              │
  │ Storage          │             │ ✅           │
  └──────────────────┴─────────────┴──────────────┘
```

## Caching Strategy

```
Request → Redis Cache → Hit? ──Yes──► Return Cached
            │            │
            │            No
            │            ▼
            │        Process → Store → Return Fresh
            │                    │
            └────────────────────┘
                  TTL: 3600s
```

### Cache Keys
- `session:{id}` - Therapy session data
- `emg:{file_hash}` - Processed EMG results
- `score:{session_id}` - Performance scores

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/upload` | 10 requests | 1 min |
| `/webhooks` | 100 requests | 1 min |
| `/api/*` | 1000 requests | 1 min |

## Best Practices

1. **Choose Wisely**: Direct Supabase for simple ops, FastAPI for complex
2. **Cache Heavy Operations**: Use Redis for expensive EMG calculations
3. **Validate Early**: Check JWT and permissions at API boundary
4. **Monitor Performance**: Track p50, p95, p99 latencies
5. **Version APIs**: Use headers for versioning, not URLs