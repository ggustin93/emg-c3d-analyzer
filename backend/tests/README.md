# Backend Tests

This directory contains tests for the EMG C3D Analyzer backend. The goal is reliable feedback with minimal assumptions. Tests prefer clear assertions over extensive fixtures and avoid external side effects unless explicitly marked.

## Structure

- Root (`backend/tests/`): core unit/integration tests (e.g., `test_emg_analysis.py`, `test_processor.py`, `test_contraction_flags.py`, `test_serialization.py`).
- `backend/tests/webhook/`: webhook validation and integration tests. See `webhook/README.md` for details.
- `backend/tests/integration/`: integration tests that exercise database/service paths (migrated from ad‑hoc scripts).
- `backend/tests/e2e/`: end‑to‑end tests that may talk to real services. These are marked and can be excluded by default.

## Running

```bash
# From repo root or backend/
pytest backend/tests -v                  # run all collected tests
pytest backend/tests -m "not e2e" -v     # exclude end‑to‑end tests
pytest backend/tests/e2e -m e2e -v       # run only end‑to‑end tests

# Examples
pytest backend/tests/test_emg_analysis.py -v
pytest backend/tests/webhook -v

# Coverage
pytest backend/tests --cov=backend --cov-report=term-missing
```

## Running in Docker

Using the provided `docker-compose.yml`:

```bash
# Start dependencies (Redis) and backend container
docker compose up -d redis backend

# Option A: install dev deps in the running backend container and run tests
docker compose exec backend sh -lc "pip install -r backend/requirements-dev.txt && pytest backend/tests -m 'not e2e' -v"

# Option B: run one-off container for tests
docker compose run --rm backend sh -lc "pip install -r backend/requirements-dev.txt && pytest backend/tests -m 'not e2e' -v"

# Run e2e tests when services and env are configured
docker compose exec backend sh -lc "pytest backend/tests/e2e -m e2e -v"
```

Notes:
- The compose file sets `REDIS_URL=redis://redis:6379/0`; bring `redis` up first.
- Ensure required env vars (e.g., `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`) are available to the backend service.
- The default backend image target is production; installing `backend/requirements-dev.txt` adds pytest at runtime.

Pytest markers are declared in `pytest.ini`:

```ini
[pytest]
markers =
    e2e: end-to-end tests requiring external services
```

## Prerequisites

- Python 3.10+
- Backend dependencies installed (see `backend/requirements.txt`)
- For e2e/webhook tests: running backend, Supabase credentials (if applicable), and any required services (e.g., Redis) configured via environment variables.
- Sample C3D files for integration/e2e tests under `backend/tests/samples/`.

## Notes

- Some tests interact with external systems. They should be clearly marked and skipped by default.
- If a test relies on configuration, prefer environment variables and document expected values in the test or an adjacent README.
- We welcome incremental improvements: small, focused tests are better than none.