# URGENT — Compliance Score Averaging

Date: 2025-08-09
Priority: URGENT

## Issue
Left/Right muscle compliance score should be the arithmetic mean of the three subscores (Completion, Intensity, Duration), but current calculation does not reflect this.

## Plan
1) Identify the computation paths for compliance in backend and frontend.
2) Ensure the main compliance percentage is computed as `(completion + intensity + duration) / 3`.
3) Update UI labels so the displayed percentage is explicitly documented as the average of the three subscores.
4) Add tests to verify the displayed value equals the average given mocked subscores.

## Acceptance Criteria
- Gauges and L/R compliance percentages equal the arithmetic mean of the three subscores.
- StatsPanel and any derivative cards show the same value and pass snapshot tests.


