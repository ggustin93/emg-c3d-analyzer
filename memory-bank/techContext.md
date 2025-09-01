# Technical Context

## Technology Stack

### Backend
- Python 3.10+ (configured for >=3.10,<3.12)
- FastAPI
- Poetry (package management)
- ezc3d (C3D file processing)
- numpy, pandas, scipy (signal processing)
- pytest (testing)

### Frontend
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Recharts (data visualization)
- Zustand (state management)
- Vitest (testing)

### Infrastructure
- Supabase (PostgreSQL + Auth + Storage)
- Redis (caching layer)
- Docker (containerization)
- GitHub Actions (CI/CD)
- ngrok (webhook testing)

## Development Environment

### Setup
1. Clone repository
2. Backend: `poetry install` or use virtual environment
3. Frontend: `npm install`
4. Environment variables: Configure `.env` file

### Development Scripts

**Native Development (Recommended)**
```bash
./start_dev_simple.sh           # Full stack development
./start_dev_simple.sh --test    # Run all tests (223 total)
./start_dev_simple.sh --kill    # Clean shutdown
```

**Docker Development**
```bash
./start_dev.sh                  # Containerized stack
./start_dev.sh --rebuild        # Rebuild images
./start_dev.sh --logs           # View logs
```

**Webhook Testing**
```bash
./start_dev.sh --webhook        # Start with ngrok tunnel
# Configure webhook URL in Supabase Dashboard
```

### Service URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- API Docs: http://localhost:8080/docs
- Redis: redis://localhost:6379

## Testing

**Backend (135 tests)**
```bash
cd backend
source venv/bin/activate
python -m pytest tests/ -v
```

**Frontend (78 tests)**
```bash
cd frontend
npm test -- --run
```

**All Tests (223 total)**
```bash
./start_dev_simple.sh --test
```

## MCP Servers

- **Context7**: Documentation lookup
- **Sequential**: Complex analysis
- **Supabase**: Database operations
- **Playwright**: Browser automation
- **Serena**: Code analysis
- **shadcn-ui**: Component library