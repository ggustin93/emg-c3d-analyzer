# Technical Context

## Technology Stack

### Core Backend Technologies
- Python 3.10
- FastAPI
- Poetry (Package Management)
- ezc3d (C3D File Processing)

### Core Frontend Technologies
- React (via Vite, assumed)
- TypeScript
- Tailwind CSS (via shadcn/ui)
- shadcn/ui (for UI components)

### Key Backend Dependencies
```toml
[Dependencies]
python = ">=3.10.0,<3.11"
ezc3d = "^1.5.18"
fastapi = "^0.115.12"
pydantic = "^2.11.4"
numpy = "^2.2.5"
pandas = "^2.2.3"
scipy = "^1.15.3"
matplotlib = "^3.10.3"
seaborn = "^0.13.2"
uvicorn = "^0.34.2"
requests = "^2.32.3"
annotated-types = "^0.7.0"
anyio = "^4.9.0"
certifi = "^2025.4.26"
charset-normalizer = "^3.4.2"
# Note: Additional dependencies from poetry.lock (e.g., exceptiongroup, idna, sniffio, typing_extensions)
# are often transitive dependencies pulled in by the ones listed above.
# The lock file provides the exact resolved versions.
```

### Key Frontend Dependencies (Managed via npm/yarn/pnpm - typically in `frontend/package.json`)
- `react`
- `react-dom`
- `typescript`
- `tailwindcss`
- `lucide-react` (for icons)
- Specific `shadcn/ui` components (e.g., `collapsible`, `button`, `card`) - these are added individually.

## Development Environment

### Required Tools
- Python 3.10
- Poetry package manager
- Node.js and npm/yarn/pnpm (for frontend development)
- Git version control
- Code editor with Python support
- C3D file viewer (optional)

### Setup Instructions
1. Install Python 3.10
2. Install Poetry
3. Clone repository
4. Backend: Run `poetry install` in the project root.
5. Frontend: Navigate to `frontend/` directory. Run `npm install` (or `yarn install` / `pnpm install`).
6. Frontend: Initialize `shadcn/ui` if not already done: `npx shadcn-ui@latest init` (run from `frontend/` or project root depending on `components.json` configuration).
7. Add required `shadcn/ui` components: e.g., `npx shadcn-ui@latest add button card collapsible` (run from where `components.json` is configured).
8. Create data directories (for backend).
9. Configure environment variables (if any).

### Development Commands
```bash
# Install backend dependencies (from project root)
poetry install

# Run backend development server (from project root)
poetry run uvicorn main:app --reload

# Install frontend dependencies (from frontend/ directory)
cd frontend
npm install # or yarn install / pnpm install

# Run frontend development server (from frontend/ directory)
npm run dev # or yarn dev / pnpm dev (actual command depends on frontend setup e.g. Vite)

# Add a new shadcn/ui component (run from where components.json is configured - likely project root or frontend/)
npx shadcn-ui@latest add <component-name>

# Run backend tests (from project root)
poetry run pytest

# Format code (from project root)
poetry run ruff format .
```

## Configuration

### Project Configuration
- Backend: Poetry for dependency management (`pyproject.toml`).
- Frontend: npm/yarn/pnpm for dependency management (`frontend/package.json`).
- Frontend: `shadcn/ui` configured via `components.json` (typically in `frontend/` or project root).
- Ruff for Python code formatting.
- Pyright for Python type checking.

### Path Aliases & Imports (Frontend)
- Currently, path aliases like `@/*` are not configured for frontend imports.
- Imports for `shadcn/ui` components (e.g., from `frontend/src/components/sessions/` to `frontend/src/components/ui/`) use relative paths: `../ui/<component-name>`.
- Consider configuring path aliases in `frontend/tsconfig.json` and bundler settings (e.g., Vite) for cleaner imports if desired in the future.

### Environment Variables
- No sensitive environment variables currently required
- Future additions may include:
  - Database credentials
  - API keys
  - Storage paths
  - Service endpoints

### Code Style
```toml
[tool.ruff]
select = ['E', 'W', 'F', 'I', 'B', 'C4', 'ARG', 'SIM']
ignore = ['W291', 'W292', 'W293']
```

## Technical Constraints

### Performance Requirements
- Fast C3D file processing
- Real-time EMG analysis
- Quick plot generation
- Efficient file storage

### Security Requirements
- Input validation
- File type verification
- Size limits on uploads
- Access control (future)

### Compatibility Requirements
- C3D file format compliance
- REST API standards
- JSON data format
- PNG image format

## Infrastructure

### File Storage
- Local file system structure
- Organized by data type
- Unique file identification
- Regular cleanup required

### API Server
- FastAPI application
- CORS middleware enabled
- Static file serving
- Async request handling

### Processing Pipeline
- EMG data extraction
- Signal processing
- Analytics calculation
- Visualization generation

## Monitoring and Maintenance

### Logging
- Standard Python logging
- Error tracking
- Performance metrics
- API request logging

### Testing
- Unit tests with pytest
- API integration tests
- Performance benchmarks
- Error case validation

### Deployment
- Local development setup
- Production deployment TBD
- Scaling considerations
- Backup procedures 