# Backend SoT Scoring Migration and UI Synchronization (Action Plan)

Purpose: Move all performance scoring to the backend as the single source of truth, expose a stable API contract, and convert the frontend to a thin presenter. Eliminate drift like “Total = 73%” vs gauge 66% by using backend-derived values everywhere.

Status: Draft – ready for execution

Owners: Backend + Frontend

---

## Goals

- Authoritative backend computation for P_overall and all components: S_c (Compliance), S_s (Symmetry), S_e (Effort), S_g (Game)
- Return contributions and weights_used in the API, so the UI can render the formula and insights without local math
- Frontend consumes backend values only; no re-derivation
- Consistent terminology and accessible UI/UX

---

## Deliverables

- Backend scoring module integrated into `backend/services/c3d_processor.py`
- API additions to `EMGAnalysisResult`:
  - `performance.overall_score: number`
  - `performance.components: { compliance: number, symmetry: number, effort: number, game: number }`
  - `performance.contributions: { compliance: number, symmetry: number, effort: number, game: number }`
  - `performance.weights_used: { compliance: number, symmetry: number, effort: number, gameScore: number }` (normalized, sum = 1)
  - `performance.provenance: { compliance: 'backend'|'fallback', symmetry: 'backend'|'fallback', effort: 'backend'|'fallback', game: 'backend'|'fallback' }`
- Frontend reads `analysisResult.performance.*` to drive formula, contributions bar, and gauge
- Tests: unit + integration; docs updated

---

## Phased Plan

### Phase 1 – Backend SoT Implementation

- [ ] Implement scoring functions per `memory-bank/metricsDefinitions.md`
  - [ ] S_c (Therapeutic Compliance):
    - Use backend flags `meets_mvc`, `meets_duration`, `is_good` from analytics
    - Per-muscle compliance S_comp = weighted average of completion, intensity, duration (weights configurable; default 1/3 each)
    - S_c = ((S_comp_left + S_comp_right) / 2) × C_BFR
    - BFR gate C_BFR = 1.0 if %AOP ∈ [45%,55%], else 0.0
  - [ ] S_s (Symmetry): `S_s = (1 - |S_comp^L - S_comp^R| / (S_comp^L + S_comp^R)) × 100`, default 100 when both 0
  - [ ] S_e (Effort): post-session RPE mapping
    - 4–6 → 100%; {3,7} → 80%; {2,8} → 60%; {0,1,9,10} → 20%
  - [ ] S_g (Game): normalize raw score to 0–100 using configured algorithm (default linear; echo params)
  - [ ] P_overall: `w_c·S_c + w_s·S_s + w_e·S_e (+ w_g·S_g)` with normalized weights
  - [ ] Contributions: `w_i·S_i` in percentage points
  - [ ] Echo `weights_used` and `provenance`

- [ ] Integrate into `backend/services/c3d_processor.py` after analytics assembly; keep stateless
- [ ] Update Pydantic models in `backend/models/models.py`:
  - `PerformanceComponents`, `PerformanceContributions`, `PerformanceProvenance`, `PerformancePayload`
  - Extend `EMGAnalysisResult` with `performance: PerformancePayload`
- [ ] Serialization and caching key include weights and critical params

### Phase 2 – Frontend Consumption (Thin Client)

- [ ] Types: extend `frontend/src/types/emg.ts` `EMGAnalysisResult` with the `performance` object
- [ ] `performance-card.tsx`
  - [ ] Use `analysisResult.performance.overall_score` to drive the circle gauge
  - [ ] Pass `backendComponents = analysisResult.performance.components` and contributions to `OverallPerformanceCard`
  - [ ] Remove/disable local P_overall math; retain only formatting
- [ ] `OverallPerformanceCard.tsx`
  - [ ] Use backend S_i and contributions for numeric formula and bar
  - [ ] Fallback banner if backend `performance` missing
- [ ] `SubjectiveFatigueCard.tsx`
  - [ ] Display RPE and qualitative label only; no S_e mapping here
  - [ ] Add helper text clarifying performance uses backend S_e
- [ ] Deprecate/remove local derivations in `usePerformanceMetrics` and `useEnhancedPerformanceMetrics`
  - [ ] Keep temporary fallbacks behind a feature flag until backend change is live

### Phase 3 – Validation & Documentation

- [ ] Backend unit tests
  - [ ] Golden example from `metricsDefinitions.md` (expect P_overall ≈ 91.6%)
  - [ ] BFR gating on/off
  - [ ] RPE mapping edges (0–10)
  - [ ] One/both channels missing
- [ ] Backend integration test: endpoint returns `performance` with coherent values
- [ ] Frontend tests (Vitest)
  - [ ] Snapshot `OverallPerformanceCard` fed with mocked `performance`
  - [ ] Weight change → refetch → UI updates (debounced)
- [ ] Update documentation
  - [ ] `docs/api.md`: new `performance` payload with example
  - [ ] `memory-bank/metricsDefinitions.md`: mark backend as SoT and reference fields

### Phase 4 – Cleanup

- [ ] Remove `frontend/src/lib/effortScore.ts` and any fallback scoring once backend is authoritative in prod
- [ ] Remove dead code and comments related to legacy client-side scoring
- [ ] Align terminology: Effort vs Exertion (choose one; update UI labels)

---

## API Contract (Proposed)

```jsonc
"performance": {
  "overall_score": 66,
  "components": { "compliance": 66, "symmetry": 96, "effort": 60, "game": 0 },
  "contributions": { "compliance": 29.7, "symmetry": 28.8, "effort": 15.0, "game": 0.0 },
  "weights_used": { "compliance": 0.45, "symmetry": 0.30, "effort": 0.25, "gameScore": 0.00 },
  "provenance": { "compliance": "backend", "symmetry": "backend", "effort": "backend", "game": "backend" }
}
```

Notes:
- `overall_score` rounds to nearest integer for display; keep raw double internally if needed
- Contributions can be returned with 1–2 decimals for precise tooltips

---

## MCP-Assisted Workflows

Use MCP tools to accelerate and standardize implementation.

### Context 7 MCP (Docs/Standards Acceleration)

- [ ] Pull the latest docs for:
  - Pydantic v2 model patterns and `model_config` for JSON serialization
  - FastAPI response models and dependency injection best practices
  - Vitest + React Testing Library patterns for component snapshots
- [ ] Cross-check formula definitions against industry math/notation examples
- [ ] Generate example payloads and schema snippets to include in `docs/api.md`

### Serena MCP (Change Orchestration)

- [ ] Plan multi-file edits and apply in safe, minimal diffs (models → services → api → frontend types → components)
- [ ] Run builds and tests after each logical group; gate merges on green build
- [ ] Use parallel read/edit operations to keep the feedback loop tight

---

## Risk & Mitigation

- Inconsistent weights between client and server → always echo `weights_used` from backend; frontend displays and never assumes
- Missing analytics fields → mark provenance as `fallback`, still return coherent S_i=0 and contributions=0
- Performance impact → keep scoring O(n) on contractions; measure & log timing; reuse cached analytics

---

## Definition of Done

- Backend returns `performance` for all analyzed sessions
- Frontend gauge and formula reflect backend `overall_score` and S_i/contributions with no local re-derivation
- Unit/integration tests pass; Vercel build green
- Documentation updated; legacy client-side scoring removed


