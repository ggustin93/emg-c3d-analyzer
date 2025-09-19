---
sidebar_position: 4
title: Testing Strategy
---

# Testing Strategy

135-test suite across multiple layers.

## Test Breakdown

- **Unit Tests** (11) - Core EMG algorithms
- **API Tests** (19) - FastAPI endpoints  
- **Integration Tests** (3) - Service integration
- **E2E Tests** (3) - Real C3D files
- **Frontend Tests** (78) - React components
- **Total:** 135 tests

## Critical Testing Rule

**NEVER use `AsyncMock` for Supabase client testing.**

**Why:** Supabase Python client is synchronous. AsyncMock returns coroutines that break sync calls.

**Always use:** `MagicMock()` from `unittest.mock`

## Running Tests

```bash
# Backend tests
cd backend
python -m pytest tests/ -v

# Frontend tests  
cd frontend
npm test

# All tests
./start_dev_simple.sh --test
```

## Test Files

- `backend/tests/` - Backend test suite
- `frontend/src/tests/` - React component tests
- `tests/fixtures/` - Test C3D files

## E2E Testing

Uses real C3D files with known expected results.

Reference: `tests/test_e2e_*.py`