---
sidebar_position: 1
title: API Design
---

# API Design

The EMG C3D Analyzer backend follows RESTful principles with FastAPI.

## API Architecture

### Routing Strategy

The API uses a clean routing architecture without `/api` prefix on the backend:

- **Frontend**: Uses `/api/*` pattern for consistency
- **Vite Proxy**: Strips `/api` prefix when forwarding
- **Backend**: Serves routes without prefix

```javascript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:8080',
    rewrite: (path) => path.replace(/^\/api/, '')
  }
}
```

## Core Endpoints

### Upload Endpoint (Stateless)
```python
POST /upload/c3d
```
- Processes C3D files without session state
- Returns complete analysis results
- 194 lines of implementation

### Webhook Endpoint (Stateful)
```python
POST /webhooks/storage/c3d-upload
```
- Handles Supabase storage events
- Maintains session state
- 349 lines of implementation

## Processing Modes

### Stateless Processing
- Direct file upload
- Immediate response
- No database persistence
- Ideal for quick analysis

### Stateful Processing
- Webhook-triggered
- Database persistence
- Session management
- Redis caching (50x performance)

## Error Handling

All endpoints follow consistent error patterns:

```python
{
  "detail": "Error description",
  "status_code": 400,
  "error_type": "ValidationError"
}
```

## Authentication

JWT validation via Supabase:
- Bearer token authentication
- Role-based access control
- RLS policies at database level

## Next Steps

- [FastAPI Patterns](./fastapi-patterns)
- [Webhook Processing](./webhook-processing)
- [Redis Caching](./redis-caching)