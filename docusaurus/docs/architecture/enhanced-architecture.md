---
sidebar_position: 4
title: Enhanced Architecture
description: Four-layer architecture design
---

# Enhanced Architecture

## Four-Layer Architecture

The Ghostly+ Dashboard implements a clean four-layer architecture:

### 1. API Layer
**Responsibility**: HTTP endpoints and request/response handling
- FastAPI routes (`/api/routes/`)
- Request validation
- Response formatting
- Error handling

### 2. Orchestration Layer  
**Responsibility**: Business workflow coordination
- `TherapySessionProcessor`: Session lifecycle management
- Service coordination
- Transaction boundaries
- Workflow sequencing

### 3. Processing Layer
**Responsibility**: Core business logic and computations
- `GHOSTLYC3DProcessor`: EMG signal processing
- `PerformanceScoringService`: Clinical scoring
- Algorithm implementation
- Data transformation

### 4. Persistence Layer
**Responsibility**: Data storage and retrieval
- Supabase integration
- Repository pattern
- Database transactions
- File storage

## Key Patterns

### Domain-Driven Design
- Clinical domain (`/services/clinical/`)
- C3D processing domain (`/services/c3d/`)
- User management domain (`/services/user/`)

### Repository Pattern
```python
class TherapySessionRepository:
    def create(self, session_data: dict) -> dict
    def update(self, session_id: str, updates: dict) -> dict
    def get_by_id(self, session_id: str) -> dict
```

### Dependency Injection
Services receive dependencies through constructors:
```python
class TherapySessionProcessor:
    def __init__(self, 
                 supabase_client: Client,
                 c3d_processor: GHOSTLYC3DProcessor,
                 scoring_service: PerformanceScoringService)
```

### Event-Driven Processing
Webhook endpoints enable asynchronous file processing without blocking user interactions.

## Data Flow

```
Frontend Request
    ↓
API Layer (validation)
    ↓
Orchestration Layer (workflow)
    ↓
Processing Layer (computation)
    ↓
Persistence Layer (storage)
    ↓
Response to Frontend
```

## Benefits

1. **Separation of Concerns**: Each layer has distinct responsibilities
2. **Testability**: Layers can be tested independently
3. **Maintainability**: Changes isolated to specific layers
4. **Scalability**: Layers can scale independently

---

*Last updated: September 2025*