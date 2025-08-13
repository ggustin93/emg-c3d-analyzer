# Backend Reorganization Action Plan (FastAPI + Services)
Date: 2025-08-13
Owners: Backend

## Goal
Minimal, safe reorganization to improve clarity and testability:
- Split oversized scoring service into small modules
- Separate routers by domain
- Isolate legacy/alternate flows
- Update and verify all imports

## Scope (no functional changes)
- No API behavior changes
- Only file moves, re-exports, and import updates
- Documentation alignment

---

## Phase 1 — Scoring package extraction

- [ ] Create `backend/services/scoring/` with:
  - [ ] `__init__.py` (re-exports)
  - [ ] `weights.py` — move `class ScoringWeights` from `services/performance_scoring_service.py`
  - [ ] `models.py` — move `@dataclass SessionMetrics`
  - [ ] `logic.py` — extract pure math:
    - compliance components (completion, intensity, duration)
    - symmetry score
    - effort score
    - game score
    - overall aggregation
  - [ ] `repositories/supabase.py` — wrap Supabase access currently in the service
  - [ ] `service.py` — `PerformanceScoringService` orchestrates `logic` + `repositories`

- [ ] Add compatibility shim to avoid breakage while updating imports:
  - `backend/services/performance_scoring_service.py`:
    ```python
    from .scoring import PerformanceScoringService, ScoringWeights, SessionMetrics
    __all__ = ["PerformanceScoringService", "ScoringWeights", "SessionMetrics"]
    ```

- [ ] Update preferred import path everywhere:
  - Before:
    - `from backend.services.performance_scoring_service import PerformanceScoringService, SessionMetrics, ScoringWeights`
  - After:
    - `from backend.services.scoring import PerformanceScoringService, SessionMetrics, ScoringWeights`

- [ ] Ripgrep scans (pre and post-change):
  ```bash
  rg -n "PerformanceScoringService|SessionMetrics|ScoringWeights" backend | cat
  rg -n "from\s+backend\.services\.performance_scoring_service" backend | cat
  ```

- Acceptance
  - [ ] `rg` shows no old import path usage
  - [ ] Server starts: `python -m uvicorn backend.api.api:app --reload --port 8080`

---

## Phase 2 — Router separation by domain

- [ ] Create `backend/api/routes/`:
  - [ ] `analysis.py` — move `/upload`, `/export`, `/recalc` from `api/api.py`
  - [ ] `mvc.py` — move `/mvc/estimate`
  - [ ] `webhooks.py` — move current `api/webhooks.py` as-is
  - [ ] `scores.py` — scaffold only if exposing scoring endpoints now (optional)

- [ ] Make `backend/api/api.py` app assembly only:
  ```python
  from fastapi import FastAPI
  from ..config import API_TITLE, API_VERSION, API_DESCRIPTION, CORS_ORIGINS, CORS_CREDENTIALS, CORS_METHODS, CORS_HEADERS
  from fastapi.middleware.cors import CORSMiddleware
  from .routes.analysis import router as analysis_router
  from .routes.mvc import router as mvc_router
  from .routes.webhooks import router as webhook_router

  app = FastAPI(title=API_TITLE, description=API_DESCRIPTION, version=API_VERSION)
  app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=CORS_CREDENTIALS, allow_methods=CORS_METHODS, allow_headers=CORS_HEADERS)
  app.include_router(analysis_router)
  app.include_router(mvc_router)
  app.include_router(webhook_router)
  ```

- [ ] Update root `GET /` description to list only existing endpoints (don’t advertise `/scores/*` unless implemented)

- [ ] Ripgrep scans:
  ```bash
  rg -n "from\s+\.webhooks\s+import\s+router" backend/api | cat
  rg -n "include_router\(" backend/api | cat
  ```

- Acceptance
  - [ ] App still imports via `backend.api.api:app`
  - [ ] All routes listed at `GET /` and reachable

---

## Phase 3 — Legacy isolation with re-export shims

- [ ] Move alternates to `backend/services/_legacy/`:
  - `c3d_reader.py`
  - `mvp_processor.py`
  - `stats_first_processor.py`
  - `stats_first_webhook_service.py`

- [ ] Leave thin files at original paths re-exporting legacy modules:
  ```python
  # backend/services/stats_first_processor.py
  from ._legacy.stats_first_processor import *  # noqa: F401,F403
  ```

- [ ] Ripgrep for references:
  ```bash
  rg -n "stats_first_processor|mvp_processor|c3d_reader" backend | cat
  ```

- Acceptance
  - [ ] No accidental runtime dependency on legacy paths (unless intended)
  - [ ] Tests (if any) still import via re-export shims

---

## Phase 4 — Import verification and cleanup

- [ ] Global scans:
  ```bash
  rg -n "from\s+backend\.services\.performance_scoring_service" backend | cat
  rg -n "services\.scoring" backend | cat
  rg -n "from\s+\.webhooks\s+import\s+router" backend/api | cat
  rg -n "include_router" backend/api | cat
  ```

- [ ] Fix any remaining imports to:
  - `from backend.services.scoring import ...`
  - `from backend.api.routes.webhooks import router as webhook_router`
  - `from backend.api.routes.analysis import router as analysis_router`
  - `from backend.api.routes.mvc import router as mvc_router`

- Acceptance
  - [ ] Scans return no outdated imports

---

## Phase 5 — Verification

- [ ] Start server:
  ```bash
  python -m uvicorn backend.api.api:app --reload --port 8080
  ```
- [ ] Exercise endpoints:
  - `GET /`
  - `POST /upload` with sample C3D
  - `POST /export` (small sample)
  - `POST /recalc` with captured response
  - `POST /mvc/estimate`
  - `POST /webhooks/storage/c3d-upload` (local/dev flow)
- [ ] Backend tests (if active):
  ```bash
  cd backend && python -m pytest tests -q | cat
  ```

- Acceptance
  - [ ] All endpoints functional as before
  - [ ] No import/runtime errors

---

## Phase 6 — Docs and commits

- [ ] Update `backend/README.md` tree and component roles:
  - Reflect `api/routes/*` and `services/scoring/*`
- [ ] Update root endpoint description in `api/routes/analysis.py` (if defined there) or ensure `/` response is accurate

- [ ] Commit sequence:
  - `chore(api): split routes into api/routes/* and convert api.py to app assembly`
  - `refactor(scoring): extract scoring into services/scoring package with logic and repo layers`
  - `chore(services): quarantine alternates under services/_legacy with re-export shims`
  - `docs(backend): update README and root route description`

---

## Rollback Plan
- Keep compatibility shim (`services/performance_scoring_service.py`) and re-export files for legacy modules.
- Revert router moves by restoring old `api/webhooks.py` and handlers back to `api/api.py` if needed.
- Git revert per-commit allows partial rollback (routes, scoring, legacy) independently.

## Timeline
- Phase 1: 1–1.5h
- Phase 2: 45m
- Phase 3: 20m
- Phase 4: 20m
- Phase 5: 30–45m
- Phase 6: 20m
Total: ~3.5–4.5h

## Notes
- No functional logic changes; import paths only.
- Maintain `main.py` entry unchanged: `backend.api.api:app`.


