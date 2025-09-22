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

## Best Practices

1. **Choose Wisely**: Direct Supabase for simple ops, FastAPI for complex
2. **Minimize Latency**: Avoid unnecessary backend round-trips
3. **Single Source of Truth**: Processing logic in FastAPI, data in Supabase
4. **Monitor Performance**: Track response times for both surfaces
5. **Document Usage**: Specify which API in component docs