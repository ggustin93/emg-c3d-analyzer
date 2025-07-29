# GHOSTLY+ Database Schema

PostgreSQL 15.8.1.121 on Supabase with Row Level Security.

**Database**: `db.egihfsmxphqcsjotmhmm.supabase.co`
**Status**: Live verification completed 2025-07-29

## Tables

### Public Schema
- **researcher_profiles**: 1 profile, 64KB
- **therapists**: 2 therapists, 48KB  
- **patients**: 2 patients, 48KB
- **emg_sessions**: 28 sessions, 48KB

### Auth Schema (Supabase managed)
- **users**: 5 users, 152KB
- Plus standard Supabase auth tables

## Entity Relationships

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        varchar email UK
        timestamptz created_at
    }

    RESEARCHER_PROFILES {
        uuid id PK,FK
        text full_name
        text institution
        text role
        text access_level
    }

    THERAPISTS {
        uuid id PK
        uuid user_id FK,UK
        text first_name
        text last_name
    }

    PATIENTS {
        uuid id PK
        uuid therapist_id FK
        text patient_code UK
        text first_name
        text last_name
        date date_of_birth
    }

    EMG_SESSIONS {
        uuid id PK
        uuid patient_id FK
        text file_path UK
        timestamptz recorded_at
        text notes
    }

    AUTH_USERS ||--o| RESEARCHER_PROFILES : "extends"
    AUTH_USERS ||--o| THERAPISTS : "extends"
    THERAPISTS ||--o{ PATIENTS : "manages"
    PATIENTS ||--o{ EMG_SESSIONS : "has"
```

## Key Features

- **RLS Enabled**: All public tables have Row Level Security
- **Auto-generated**: Patient codes (P001, P002, ...)
- **File Storage**: EMG sessions link to Supabase Storage paths
- **Foreign Keys**: All relationships enforced with CASCADE delete

## Current Data
- Active users: 5
- Therapists managing patients: 2
- Patients in system: 2
- EMG sessions recorded: 28

## Future Improvements

Future improvements may include analysis results caching, treatment protocols, progress tracking, and multi-institution support.