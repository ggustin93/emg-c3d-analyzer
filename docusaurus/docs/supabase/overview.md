---
sidebar_position: 1
title: Supabase Overview
---

# Supabase Integration

PostgreSQL database with built-in auth, storage, and real-time features.

## What We Use

- **Database** → PostgreSQL with Row Level Security (RLS)
- **Authentication** → JWT-based auth with role management  
- **Storage** → C3D file uploads with webhook processing
- **Real-time** → Live EMG data updates via subscriptions

## Database Schema

### Core Tables
- `sessions` → Therapy session records
- `session_parameters` → EMG analysis results
- `contractions` → Individual muscle contraction data
- `users` → Patient/therapist/admin accounts

### Key Features
- **18+ RLS policies** for role-based data access
- **Foreign key constraints** maintaining data integrity
- **Indexes** optimized for EMG data queries
- **Triggers** for automatic timestamps and validation

## Authentication Strategy

**Architecture**: Supabase Auth → React Hook → FastAPI (validation only) → RLS (authorization)

1. **Frontend** → `useAuth` hook manages auth state and tokens
2. **Backend** → JWT validation via `get_current_user` dependency
3. **Database** → RLS policies enforce permissions at row level

**Roles**: 
- `patient` → Own data only
- `therapist` → Assigned patients 
- `admin` → Full system access

## File Storage

**Bucket**: `c3d-examples`
**Workflow**: Upload → Webhook → Background processing → Database storage

1. Patient uploads C3D file → Supabase Storage
2. Storage webhook triggers → `/webhooks/storage/c3d-upload`
3. Backend downloads → EMG processing → Results to database
4. Frontend shows → Real-time progress updates

## RLS Security Model

**Single Source of Truth**: Database-level authorization via RLS policies

**Example Policy**:
```sql
-- Patients see only their own sessions
CREATE POLICY "Users can view own sessions" ON sessions
FOR SELECT USING (
  auth.uid() = user_id OR 
  auth.jwt() ->> 'role' = 'admin'
);
```

## Client Configuration

**Python** (Backend):
```python
from supabase import create_client
# Uses synchronous client (not async)
supabase = create_client(url, key)
```

**JavaScript** (Frontend):
```javascript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)
```

## When to Use Direct vs FastAPI

**Use Supabase Directly**:
- Authentication and user management
- Simple CRUD operations
- Real-time subscriptions  
- File uploads and storage

**Use FastAPI**:
- EMG signal processing
- Complex computations
- External API integrations
- Heavy algorithms requiring server resources

## Key Files

- `backend/core/supabase.py` → Client configuration
- `backend/core/auth.py` → JWT validation  
- `supabase/migrations/` → Database schema
- Frontend auth via `@supabase/supabase-js`