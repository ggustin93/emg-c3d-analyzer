# EMG C3D Analyzer - Documentation

## 🚀 Quick Start
1. **Backend**: `cd backend && uvicorn main:app --reload`
2. **Frontend**: `cd frontend && npm start`
3. **Access**: http://localhost:3000

## 📁 Documentation Structure

### Working Documentation
- [`api.md`](./api.md) - API endpoints and models
- [`db_schema.md`](./db_schema.md) - Database schema
- [`auth_system.md`](./auth_system.md) - Should explains how Supabase Auth works and data flow.
- [`data_flows.md`](./data_flows.md) - Business Logic Diagrams (To Complete)
- [`supabase.md`](./supabase.md) - Overview of Supabase client documentation (To Do)
- [`deployment.md`](./deployment.md) - Production deployment guide (Docker, Coolify - To Do)
- [`setup.md`](./setup.md) - Development setup guide (To Do)

### Architecture
- See [`/memory-bank/systemPatterns.md`](../memory-bank/systemPatterns.md) for system architecture
- See [`/memory-bank/techContext.md`](../memory-bank/techContext.md) for technology stack

## 🔧 Development
- **Authentication**: Supabase-based with role-based access
- **State Management**: Zustand for session parameters
- **Visualization**: Recharts for EMG signal plots
- **Processing**: FastAPI backend with stateless architecture

## 📋 Current Status
See [`/memory-bank/activeContext.md`](../memory-bank/activeContext.md) for current implementation status.