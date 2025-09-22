---
sidebar_position: 1
title: Architecture
---

# GHOSTLY+ EMG C3D Analyzer - Architecture

## Overview

The GHOSTLY+ system transforms electromyography data from rehabilitation therapy sessions into clinical insights. This document provides an architectural overview of how React, FastAPI, and Supabase work together to process EMG signals and help therapists track patient progress.

**Quick Navigation:**
- **Backend Development** → [Backend Architecture](./backend.md)
- **Frontend Development** → [Frontend Overview](./frontend/overview.md)
- **DevOps & Deployment** → [DevOps Guide](./devops/devops.md)

## Technology Stack

The system combines modern frameworks selected for reliability and developer experience:

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 19 + TypeScript | Type-safe component development with modern hooks |
| **Backend** | FastAPI + Python 3.10 | High-performance API with automatic documentation |
| **Database** | PostgreSQL via Supabase | Structured data with Row Level Security |
| **Storage** | Supabase Storage | C3D file storage with webhook triggers |
| **Cache** | Redis 7.2 | Session caching and performance optimization |
| **Deployment** | Coolify + Docker | Self-hosted platform with SSL and monitoring |

> **Note**: When deploying with Coolify, the built-in Traefik proxy handles SSL/TLS termination, domain routing, and load balancing automatically - no separate NGINX required.

## System Architecture

The GHOSTLY+ system uses a sophisticated 6-layer architecture with a dual API strategy:

```mermaid
graph TB
    subgraph "1. Presentation Layer"
        UI[React Components]
        State[State Management]
    end
    
    subgraph "2. API Gateway Layer"
        FastAPI[FastAPI<br/>Complex Processing]
        SupaAPI[Supabase REST API<br/>CRUD & Auth]
    end
    
    subgraph "3. Application Layer"
        Orchestration[Session Orchestration]
        Workflow[Business Workflows]
    end
    
    subgraph "4. Domain Layer"
        EMG[EMG Processing]
        Clinical[Clinical Algorithms]
    end
    
    subgraph "5. Infrastructure Layer"
        Repos[Repository Pattern]
        SupaClient[Supabase Client]
    end
    
    subgraph "6. Persistence Layer"
        DB[(PostgreSQL + RLS)]
        Cache[(Redis)]
        Storage[File Storage]
    end
    
    UI --> FastAPI
    UI --> SupaAPI
    FastAPI --> Orchestration
    FastAPI --> SupaClient
    Orchestration --> EMG
    Orchestration --> Repos
    EMG --> Clinical
    Repos --> SupaClient
    SupaClient --> DB
    SupaAPI --> DB
    
    style UI fill:#e3f2fd
    style FastAPI fill:#fff3e0
    style SupaAPI fill:#c8e6c9
    style Orchestration fill:#fce4ec
    style EMG fill:#f3e5f5
    style SupaClient fill:#fff9c4
    style DB fill:#e8f5e9
```

## Dual API Strategy

The system implements a dual API approach for optimal efficiency:

### When to Use Each API

#### Frontend → Direct Supabase
**Use when**: Simple CRUD, authentication, real-time subscriptions, file uploads
- **Examples**: 
  - Loading user profiles and patient lists
  - Saving clinical notes
  - Uploading files to storage buckets
  - Real-time session status updates
- **Benefits**: Lower latency, reduced backend load, automatic RLS security

#### Frontend → FastAPI → Processing → Supabase
**Use when**: Complex computations, multi-step workflows, business logic
- **Examples**:
  - C3D file processing and EMG analysis
  - Performance score calculations
  - Therapy session orchestration
  - Webhook processing from external events
- **Benefits**: Complex logic handling, data transformation, error recovery

#### Backend (FastAPI) → Supabase Client
**Use when**: Backend needs database access during processing
- **Examples**:
  - Storing EMG analysis results
  - Updating therapy session status
  - Reading patient MVC thresholds
  - Managing transaction boundaries
- **Benefits**: Centralized business logic, transactional integrity

### Decision Criteria
```
Need EMG/C3D processing? ──Yes──► FastAPI
       │
       No
       ▼
Need business logic?     ──Yes──► FastAPI
       │
       No
       ▼
Is it simple CRUD?       ──Yes──► Direct Supabase
       │
       No
       ▼
Real-time updates?       ──Yes──► Direct Supabase
       │
       No
       ▼
External webhook?        ──Yes──► FastAPI
```

## Layer Descriptions

#### 1. Presentation Layer
- **React Components**: User interface and interactions
- **State Management**: Zustand store and TanStack Query
- **Visualization**: Charts and real-time data display

#### 2. API Gateway Layer  
- **FastAPI**: Complex processing endpoints, webhooks, C3D analysis
- **Supabase REST API**: Auto-generated CRUD endpoints via PostgREST
- **Authentication**: Supabase Auth with JWT tokens

#### 3. Application Layer
- **Session Orchestration**: Therapy session lifecycle management
- **Business Workflows**: Complex multi-step operations
- **Service Coordination**: Cross-domain orchestration

#### 4. Domain Layer
- **EMG Processing**: Signal filtering and analysis
- **Clinical Algorithms**: Contraction detection, fatigue analysis
- **Performance Scoring**: Clinical metrics calculation

#### 5. Infrastructure Layer
- **Repository Pattern**: Data access abstraction
- **Supabase Client**: Used by both frontend and backend
- **External Services**: Webhook handlers, cache services

#### 6. Persistence Layer
- **PostgreSQL Database**: Structured data with Row Level Security
- **Redis Cache**: Session data and performance optimization
- **File Storage**: C3D files in Supabase buckets

## Key System Files

The most important files to understand the system's architecture:

| File | Purpose |
|------|---------|
| `therapy_session_processor.py` | Core orchestration engine - coordinates entire workflow |
| `processor.py` | EMG signal processing - single source of truth for analysis |
| `performance_scoring_service.py` | Clinical scoring algorithms and metrics calculation |
| `emg_analysis.py` | Scientific EMG algorithms and clinical metrics |
| `signal_processing.py` | Low-level signal operations and filtering |
| `upload.py` | Stateless C3D processing endpoint for direct analysis |
| `webhooks.py` | Event-driven processing for Supabase storage events |
| `AppContent.tsx` | Main router with role-based access control |
| `TherapistOverview.tsx` | Primary clinical dashboard interface for patient monitoring |
| `AdminDashboard.tsx` | System administration and user management interface |
| `C3DFileBrowser.tsx` | File navigation and selection hub |
| `GameSessionTabs.tsx` | Multi-tab session analysis interface |
| `useAuth.ts` | Central authentication orchestrator |

## Processing Modes

The system supports two processing modes sharing the same core engine:

### Stateless Mode (Direct Upload)

Immediate, synchronous processing without persistence:

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Processor
    
    Client->>API: Upload C3D
    API->>Processor: Process file
    Processor-->>API: Analysis results
    API-->>Client: JSON response
```

**Use Cases**: Quick assessments, testing, development

### Stateful Mode (Webhook)

Asynchronous, event-driven processing with full persistence:

```mermaid
sequenceDiagram
    participant Storage
    participant Webhook
    participant Session
    participant Database
    
    Storage->>Webhook: File uploaded
    Webhook->>Session: Create session
    Session->>Database: Save results
```

**Use Cases**: Clinical workflow, patient tracking, performance history


## Key Architectural Patterns

### Domain-Driven Design

Services organized by business domain:
```
backend/services/
├── clinical/          # Therapy sessions, patient management
├── c3d/              # C3D file processing
├── analysis/         # EMG analysis coordination
├── user/             # User management
└── shared/           # Common utilities
```

### Repository Pattern

Clean separation between business logic and data access:
```python
class TherapySessionRepository:
    def create(self, session_data: dict) -> dict
    def get_by_id(self, session_id: str) -> dict
    def update(self, session_id: str, updates: dict) -> dict
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

Webhook endpoints enable background processing without blocking user interactions.

## Deep Dive Resources

For detailed information about specific areas:

### 🔧 Backend Development
→ [Backend Architecture](./backend.md)
- FastAPI patterns and best practices
- Domain service organization
- EMG processing pipeline details
- Database and repository patterns

### 🎨 Frontend Development  
→ [Frontend Overview](./frontend/overview.md)
- React component architecture
- State management with Zustand
- TanStack Query patterns
- UI/UX implementation details

### 🚀 DevOps & Deployment
→ [DevOps Guide](./devops/devops.md)
- Environment configurations
- Docker and Coolify setup
- CI/CD pipeline
- Production deployment

### 🧪 Testing
→ [Testing Architecture](./testing.md)
- 227+ comprehensive tests
- Testing strategies and patterns
- E2E validation approaches

## Quick Start

```bash
# Start both frontend and backend
./start_dev_simple.sh

# Or start individually:
cd backend && uvicorn main:app --reload --port 8080
cd frontend && npm start
```

For detailed setup instructions, see the specialized documentation linked above.

## Summary

The GHOSTLY+ system uses a sophisticated 6-layer architecture with a dual API strategy that separates concerns across presentation, API gateway, application orchestration, domain logic, infrastructure services, and persistence. The key architectural decision is choosing between direct Supabase access and FastAPI processing based on complexity and requirements.

For implementation details and best practices, refer to the specialized documentation for your area of interest.