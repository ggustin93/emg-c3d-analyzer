---
sidebar_position: 1
title: Architecture Overview
---

# Architecture Overview

The EMG C3D Analyzer follows a **4-layer architecture** with Domain-Driven Design (DDD) principles.

## System Architecture

```
┌─────────────────────────┐      ┌───────────────────────────┐      ┌─────────────────────────┐
│    React 19 Frontend    │◄──── │     FastAPI Backend       │ ───► │   Supabase Platform     │
│ (Zustand, TypeScript)   │ HTTP │  (EMG Processing Engine)  │ SQL  │ (PostgreSQL & Storage)  │
└─────────────────────────┘      └───────────────────────────┘      └─────────────────────────┘
```

## Architecture Principles

### 1. Domain-Driven Design (DDD)
- Clear separation of concerns
- Domain boundaries around business logic
- Services organized by domain (clinical, data, infrastructure)

### 2. Single Source of Truth (SSoT)
- Database: Supabase PostgreSQL
- Configuration: Environment variables
- Design tokens: Tailwind configuration

### 3. SOLID Principles
- **Single Responsibility**: Each module has one purpose
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Derived classes are substitutable
- **Interface Segregation**: No unused interface dependencies
- **Dependency Inversion**: Depend on abstractions

## Processing Pipeline

The EMG processing pipeline consists of three main stages:

1. **Signal Processing** - Filtering and envelope detection
2. **Contraction Detection** - MVC threshold analysis
3. **Clinical Metrics** - Statistical analysis and scoring

## Key Components

### Backend Services
- `processor.py` (1,341 lines) - Core EMG processing
- `therapy_session_processor.py` (1,669 lines) - Session orchestration
- `upload.py` - Stateless processing route
- `webhooks.py` - Stateful webhook handling

### Frontend Components
- `sessionStore.ts` - Zustand state management
- `EMGPlot.tsx` - Real-time visualization
- `usePerformanceMetrics.ts` - Business logic hooks

## Next Steps

- [Processing Pipeline Details](./processing-pipeline)
- [Domain-Driven Design](./domain-driven-design)
- [SOLID Principles in Practice](./solid-principles)