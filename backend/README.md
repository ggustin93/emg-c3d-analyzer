# GHOSTLY+ EMG C3D Analyzer - Backend

FastAPI-based backend for processing C3D files and performing EMG analysis in the GHOSTLY+ rehabilitation system.

## Quick Start

```bash
# Setup environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment (.env file)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-jwt-secret
REDIS_URL=redis://localhost:6379

# Run development server
uvicorn main:app --reload --port 8080

# Run with webhook support (requires ngrok)
./start_dev.sh --webhook
```

## Testing

```bash
# Recommended: Use the test runner script
./run_tests_with_env.sh              # Run all 227 tests
./run_tests_with_env.sh e2e          # Run only E2E tests
./run_tests_with_env.sh quick        # Run quick tests (excludes E2E)

# Manual execution
python -m pytest tests/ -v           # All tests with verbose output
python -m pytest tests/ --cov=.      # With coverage report
```

## Project Structure

```
backend/
├── api/routes/           # API endpoints
├── services/            # Business logic (domain-driven)
├── models/              # Pydantic data models
├── emg/                 # Signal processing algorithms
├── database/            # Supabase client
├── tests/               # 227 pytest tests
└── main.py              # FastAPI application
```

## Documentation

For comprehensive documentation, see:

📚 **[Backend Architecture Guide](../docusaurus/docs/backend.md)**
- Complete architecture overview
- API endpoint specifications  
- Database schema with all 12 tables
- Authentication and RLS patterns
- Domain-driven design principles

🔗 **Quick Links**:
- **API Docs**: http://localhost:8080/docs
- **Database Schema**: [Supabase Dashboard](https://supabase.com/dashboard/project/egihfsmxphqcsjotmhmm/database/schemas)
- **Frontend Docs**: [Frontend Overview](../docusaurus/docs/frontend/overview.md)
- **Signal Processing**: [EMG Algorithms](../docusaurus/docs/signal-processing/overview.md)