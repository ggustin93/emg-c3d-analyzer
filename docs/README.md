# EMG C3D Analyzer - Documentation

## 🚀 Quick Start
1. **Backend**: `cd backend && uvicorn main:app --reload`
2. **Frontend**: `cd frontend && npm start`
3. **Access**: http://localhost:3000

## 📁 Documentation Structure

### Working Documentation
- [`api.md`](./api.md) - API endpoints and models
- [`db_schema.md`](./db_schema.md) - Database schema
- [`setup/`](./setup/) - Development setup guides

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