# SettingsTab role/data-source badges and lock states

## Objectives
- Apply role-gated and source-indicator badges across settings.
- Lock production inputs where values should come from data sources; unlock only where specified via Debug Mode.

## Tasks
- Therapeutic Parameters (role Therapist)
  - Remove "Clinical Parameters" badge.
  - Add right-aligned badges: `Therapist`, `Locked` (switch to `Debug Unlocked` when Debug Mode is on).
  - Editing gated by Debug Mode only (role shown as badge, not used for unlocking).
  - Session Goals header: add badges `c3d` and `×` (extracted from C3D in future, not implemented yet). Keep inputs read-only.

- ePRO (Patient Outcomes)
  - Keep read-only in production.
  - Add top-card badges: `Locked`, `c3d`, `×`.

- BFR Parameters
  - Measured Values section: add badges `c3d` and `×` on the header; keep read-only.
  - Therapeutic Range section: remove `Customizable` badge. Add right-aligned `Therapist` and `Locked` badges; keep inputs read-only.

## Notes
- Use existing `Badge` component with `variant="outline"` for informational tags; use `warning` for `Debug Unlocked` if needed.
- Keep section headers using `flex items-center justify-between` with a right-side badge group (`justify-end`).

## Rationale
- Production honesty: parameters sourced from backend/C3D remain read-only and visibly locked.
- Clear role communication: display role badges without silently unlocking.
- Debug Mode is the explicit switch for temporary editing where allowed.


