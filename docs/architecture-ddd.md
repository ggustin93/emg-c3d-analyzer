### Backend Architecture (Domain-Driven Scaffold)

- domain/: pure domain logic and models (compatibility re-exports for now)
  - analysis.py → EMG analysis functions
  - models.py → session/game Pydantic models
  - processing.py → standardized signal processing
- application/: orchestration services
  - processor_service.py → wrapper for legacy processor
- infrastructure/: integrations (export, storage)
  - exporting.py → export utilities

Notes
- Legacy modules remain; new modules re-export for non-breaking migration.
- Gradually replace imports to use `backend.domain.*`, `backend.application.*`, `backend.infrastructure.*`.

