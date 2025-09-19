---
sidebar_position: 1
title: Database Overview
---

# Database

PostgreSQL database with repository pattern for clean data access.

## Core Tables

```mermaid
erDiagram
    therapy_sessions ||--o{ emg_statistics : contains
    therapy_sessions ||--o{ performance_scores : has
    therapy_sessions }o--|| patients : belongs_to
    patients }o--|| therapists : assigned_to
    
    therapy_sessions {
        uuid id PK
        uuid patient_id FK
        uuid therapist_id FK
        timestamp created_at
        json processing_parameters
        ...
    }
    
    emg_statistics {
        uuid session_id FK
        int channel
        float rms_mean
        float mav_mean
        float contraction_count
        ...
    }
```

## Repository Pattern

```python
# backend/services/clinical/repositories/therapy_session_repository.py
class TherapySessionRepository(AbstractRepository):
    async def create(self, data: dict) -> dict:
        # Create with Supabase client
        
    async def get_by_patient(self, patient_id: str) -> List[dict]:
        # Query with RLS automatically applied
```

## Key Tables

- **therapy_sessions** - Core session data
- **emg_statistics** - Processed EMG metrics
- **performance_scores** - GHOSTLY+ scoring
- **session_parameters** - MVC thresholds
- **patients** - Patient profiles with therapist links

## Migration Management

```bash
# Naming convention
supabase/migrations/YYYYMMDDHHMMSS_description.sql

# Example
20240815120000_create_therapy_sessions.sql
20240816090000_add_rls_policies.sql
```

## Usage Pattern

```python
# Backend service uses repository
repository = TherapySessionRepository(supabase_client)
session = await repository.create(session_data)

# Frontend queries directly
const { data } = await supabase
  .from('therapy_sessions')
  .select('*')
  .eq('patient_id', patientId)