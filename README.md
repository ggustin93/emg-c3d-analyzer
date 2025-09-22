# GHOSTLY+ EMG C3D Analyzer

A rehabilitation technology platform for analyzing Electromyography (EMG) data from C3D motion capture files, developed as part of the GHOSTLY+ serious game project for elderly rehabilitation.

⚠️ **Research Software Notice**: This is a research-focused platform under active development. It is designed specifically for C3D files from the GHOSTLY game platform and is not intended for medical diagnosis or production clinical use.

## Quick Overview

### What It Does
Processes EMG signals from rehabilitation therapy sessions to assess muscle activity, detect contractions, and calculate clinical performance metrics for therapeutic assessment.

### Key Features
- 📊 **EMG Signal Processing** - RMS, MAV, frequency analysis, fatigue indices
- 🎮 **GHOSTLY Integration** - Processes C3D files from the serious game
- 📈 **Clinical Metrics** - Compliance, symmetry, effort, and game performance scoring
- 🔬 **Research Tools** - Export capabilities and detailed analytics
- 🏥 **Healthcare Ready** - HIPAA considerations, audit logging, role-based access

### Tech Stack
- **Frontend**: React 19, TypeScript, Zustand, Recharts
- **Backend**: FastAPI, Python, NumPy/SciPy
- **Database**: Supabase (PostgreSQL with RLS)
- **Infrastructure**: Docker, Redis caching

## Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/emg-c3d-analyzer.git
cd emg-c3d-analyzer

# Start development environment
./start_dev_simple.sh    # Starts both backend and frontend

# Or start services individually:
# Backend (port 8080)
cd backend
uvicorn main:app --reload --port 8080

# Frontend (port 5173)
cd frontend
npm install
npm run dev
```

## Documentation

### 📚 Comprehensive Guides
- **[Backend Documentation](docusaurus/docs/backend.md)** - Architecture, API, database schema
- **[Frontend Documentation](docusaurus/docs/frontend/overview.md)** - Components, state management, UI
- **[Signal Processing](docusaurus/docs/signal-processing/overview.md)** - EMG algorithms and clinical metrics
- **[Development Setup](docusaurus/docs/development/setup.md)** - Environment configuration

### 🚀 Quick References
- **API Documentation**: http://localhost:8080/docs (FastAPI Swagger)
- **Database Schema**: [Supabase Dashboard](https://supabase.com/dashboard/project/egihfsmxphqcsjotmhmm/database/schemas)
- **Component Library**: Run `npm run storybook` in frontend

## Architecture

```
┌─────────────────────────┐      ┌───────────────────────────┐      ┌─────────────────────────┐
│    React Frontend       │◄──── │     FastAPI Backend       │ ───► │   Supabase Platform     │
│ (TypeScript, Zustand)   │ HTTP │  (EMG Processing Engine)  │ SQL  │ (PostgreSQL & Storage)  │
└─────────────────────────┘      └───────────────────────────┘      └─────────────────────────┘
                                              │
                                              ▼
                               ┌───────────────────────────┐
                               │   EMG Analysis Pipeline   │
                               │   - Signal Processing     │
                               │   - Contraction Detection │
                               │   - Clinical Metrics      │
                               └───────────────────────────┘
```

## Testing

The project includes comprehensive test coverage:

- **Backend**: 227 tests (pytest) - `./run_tests_with_env.sh`
- **Frontend**: 78 tests (Vitest) - `npm test`
- **E2E Tests**: Full workflow validation with real clinical data

## Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (via Supabase)
- Redis (optional, for caching)

### Environment Setup
Create `.env` files in both frontend and backend directories:

**Backend `.env`:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-jwt-secret
REDIS_URL=redis://localhost:6379
```

**Frontend `.env`:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8080
```

## Project Structure

```
emg-c3d-analyzer/
├── frontend/            # React application
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── services/    # API services
│   │   └── stores/      # Zustand state management
│   └── tests/           # Frontend tests
├── backend/             # FastAPI server
│   ├── api/routes/      # API endpoints
│   ├── services/        # Business logic (domain-driven)
│   ├── models/          # Pydantic models
│   ├── emg/             # Signal processing algorithms
│   └── tests/           # Backend tests (227 tests)
└── docusaurus/          # Documentation site
    └── docs/            # Markdown documentation
```

## Contributing

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

See [Contributing Guidelines](CONTRIBUTING.md) for details.

## Research Context

This software was developed as part of the GHOSTLY+ project, a serious game for elderly rehabilitation. The system processes EMG data to assess therapeutic compliance and track patient progress in gamified rehabilitation exercises.

### Clinical Metrics
- **Compliance Score**: Measures exercise completion and intensity
- **Symmetry Score**: Evaluates bilateral muscle activation balance
- **Effort Score**: Assesses perceived exertion (RPE-based)
- **Game Performance**: Tracks achievement in the serious game

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- GHOSTLY+ Research Team
- VUB - Vrije Universiteit Brussel
- Clinical partners and therapists
- Open-source contributors

---

**Note**: This is research software. For production deployment or clinical use, additional validation, security hardening, and regulatory compliance would be required.