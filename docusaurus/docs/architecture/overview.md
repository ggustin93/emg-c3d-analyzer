---
sidebar_position: 1
title: Architecture Overview
---

# 1. System Architecture

Simple 4-layer architecture for EMG data processing.
## Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React + TypeScript]:::frontend
        State[Zustand Store]:::frontend
        Chart[Recharts Visualization]:::frontend
    end
    
    subgraph "API Layer"
        A1[upload.py - 194 lines]:::api
        A2[webhooks.py - 349 lines]:::api
        A3[FastAPI Router]:::api
    end
    
    subgraph "Orchestration Layer"
        O1[therapy_session_processor.py - 1,669 lines]:::orchestration
        O2[Service Layer]:::orchestration
        O3[Repository Pattern]:::orchestration
    end
    
    subgraph "Processing Layer"
        P1[processor.py - 1,341 lines]:::processing
        P2[EMG Analysis Engine]:::processing
        P3[Signal Processing]:::processing
    end
    
    subgraph "Persistence Layer"
        D1[Repository Interfaces]:::database
        D2[Supabase Client]:::database
        D3[PostgreSQL + RLS]:::database
        D4[File Storage]:::database
    end
    
    subgraph "Cache Layer"
        C1[Redis 7.2]:::cache
        C2[Session Cache]:::cache
    end
    
    UI --> A3
    A1 --> O1
    A2 --> O1
    O1 --> P1
    O1 --> D1
    P1 --> C1
    D1 --> D2
    D2 --> D3
    D2 --> D4
    
    classDef frontend fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#000
    classDef api fill:#fff3e0,stroke:#f57c00,stroke-width:2px,color:#000
    classDef orchestration fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#000
    classDef processing fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000
    classDef database fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,color:#000
    classDef cache fill:#e0f2f1,stroke:#00796b,stroke-width:2px,color:#000
```

## Tech stack

![/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/docusaurus/docs/architecture/architecture_stack.webp](file:///Users/pwablo/Documents/GitHub/emg-c3d-analyzer/docusaurus/docs/architecture/architecture_stack.webp)


## 4 Layers

### 1. API Layer
- `upload.py` (194 lines) - Direct file processing
- `webhooks.py` (349 lines) - Background webhook processing
- FastAPI routes and validation

### 2. Orchestration Layer  
- `therapy_session_processor.py` (1,669 lines) - Session management
- Repository pattern for data access
- Service layer coordination

### 3. Processing Layer
- `processor.py` (1,341 lines) - EMG analysis engine
- Single source of truth for all processing
- Signal processing algorithms

### 4. Persistence Layer
- Supabase PostgreSQL with RLS
- File storage for C3D files
- Redis cache for performance

## 2 Processing Modes (2 routes)

### Stateless (Upload)
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Processor
    
    Client->>API: Upload C3D
    API->>Processor: Process file
    Processor-->>API: Complete results
    API-->>Client: JSON response
```

### Stateful (Webhook)
```mermaid
sequenceDiagram
    participant Storage
    participant Webhook
    participant Session
    participant Processor
    participant Database
    
    Storage->>Webhook: File uploaded
    Webhook->>Session: Create session
    Session->>Processor: Process C3D
    Processor->>Database: Save results
```
