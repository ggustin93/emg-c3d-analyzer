# Active Context

## Current Status (January 2025)

### System Architecture
- **Backend**: FastAPI with Domain-Driven Design (135 tests passing)
- **Frontend**: React 19 + TypeScript + Tailwind (78 tests passing)  
- **Database**: Supabase PostgreSQL with Row Level Security
- **Processing**: EMG analysis pipeline with dual signal detection
- **Testing**: 223 tests passing (100% success rate)

### Recent Achievements

#### Database Schema Alignment (January 31, 2025)
- Consolidated migration files into single comprehensive schema
- Created database reset/populate tool with Storage integration
- Aligned performance_scores table with metricsDefinitions.md
- Implemented MVC workflow with priority cascade

#### Test Infrastructure (January 2025)
- **Backend**: 135/135 tests passing (47% coverage)
- **Frontend**: 78/78 tests passing (React.StrictMode compatible)
- **E2E**: Complete webhook integration with real C3D data
- **CI/CD**: GitHub Actions with quality gates

#### Clinical Features
- GHOSTLY+ performance scoring algorithm
- MVC threshold optimization (10% based on 2024-2025 research)
- Dual signal detection (Raw + Activated channels)
- BFR monitoring system
- Therapeutic compliance tracking

### Development Environment
- Native development script: `./start_dev_simple.sh`
- Docker support: `./start_dev.sh`
- Webhook testing: `./start_dev.sh --webhook` with ngrok
- Database management: `scripts/database/reset_populate.py`

### Current Branch
- `feature/schema-therapeutic-targets` - Schema optimization and alignment

### Key Documentation
- `/memory-bank/metricsDefinitions.md` - Clinical business logic
- `/memory-bank/projectbrief.md` - Project foundation
- `/CLAUDE.md` - Development guidelines
- `/backend/CLAUDE.md` - Backend specific patterns