---
sidebar_position: 1
title: Architecture Overview
---

# System Architecture

4-layer architecture with Domain-Driven Design (DDD) for the EMG C3D Analyzer.

## 4-Layer Architecture

```mermaid
graph TB
    subgraph "API Layer"
        A1[upload.py - 194 lines]
        A2[webhooks.py - 349 lines]
    end
    
    subgraph "Orchestration Layer"
        O1[therapy_session_processor.py - 1,669 lines]
    end
    
    subgraph "Processing Layer"
        P1[processor.py - 1,341 lines]
    end
    
    subgraph "Persistence Layer"
        D1[Repositories]
        D2[Supabase]
    end
    
    A1 --> O1
    A2 --> O1
    O1 --> P1
    O1 --> D1
    D1 --> D2
```

## Layer Responsibilities

### API Layer
- **upload.py**: Stateless C3D processing
- **webhooks.py**: Supabase Storage integration
- HTTP concerns, validation, responses

### Orchestration Layer
- **therapy_session_processor.py**: Session lifecycle
- Workflow coordination
- Repository pattern with dependency injection

### Processing Layer
- **processor.py**: GHOSTLYC3DProcessor
- Single Source of Truth for EMG analysis
- Signal processing algorithms

### Persistence Layer
- Repository pattern implementation
- Supabase client operations
- File storage management

## Domain Organization

```
backend/services/
├── clinical/       # Healthcare domain
├── c3d/           # File processing domain
├── data/          # Export/metadata domain
├── infrastructure/ # Cross-cutting concerns
└── cache/         # Performance optimization
```

## Processing Modes

### Stateless (Upload Route)
```mermaid
sequenceDiagram
    Client->>API: Upload C3D
    API->>Processor: Process file
    Processor->>Processor: Analyze EMG
    Processor-->>API: Complete results
    API-->>Client: JSON response
```

### Stateful (Webhook Route)
```mermaid
sequenceDiagram
    Storage->>Webhook: File uploaded
    Webhook->>Session: Create session
    Session->>Processor: Process C3D
    Processor->>Database: Save results
    Database-->>Session: Confirm
```

## Key Design Patterns

- **Repository Pattern**: Clean data access
- **Dependency Injection**: Testable services
- **Single Source of Truth**: Processor as authority
- **Domain-Driven Design**: Business-focused organization

## Performance

- **Redis Caching**: 50x speed improvement
- **Async Processing**: Non-blocking operations
- **Background Tasks**: Webhook processing
- **Connection Pooling**: Database optimization