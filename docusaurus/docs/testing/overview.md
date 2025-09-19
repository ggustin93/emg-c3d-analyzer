---
sidebar_position: 1
title: Testing Overview
---

# Testing Strategy

135-test suite across backend and frontend with comprehensive coverage.

## Test Breakdown

- **Backend Tests (33 total)**
  - 11 Unit tests → Core EMG algorithms
  - 19 API tests → FastAPI endpoints  
  - 3 E2E tests → Real C3D file processing
- **Frontend Tests (78 total)**
  - Component tests → React components
  - Hook tests → Custom hooks and state management
  - All tests use React.StrictMode for compatibility

**Total**: 135 tests with 100% frontend pass rate

## Critical Testing Rules

### 🚨 NEVER Use AsyncMock for Supabase

**Why**: Supabase Python client is synchronous. AsyncMock returns coroutines that break sync calls.

**Always Use**: `MagicMock()` from `unittest.mock`

```python
# ✅ Correct
from unittest.mock import MagicMock
mock_service = MagicMock()

# ❌ Wrong - causes coroutine errors
from unittest.mock import AsyncMock
mock_service = AsyncMock()  # DON'T DO THIS
```

## Running Tests

### Backend Tests
```bash
cd backend
source venv/bin/activate                  # Required
python -m pytest tests/ -v               # All 33 tests
python -m pytest tests/test_e2e* -v -s   # E2E tests (3)
python -m pytest tests/test_api* -v      # API tests (19)
python -m pytest tests/ --cov=backend    # With coverage
```

### Frontend Tests
```bash
cd frontend
npm test                                  # Watch mode
npm test -- --run                       # Run once (78 tests)
npm test -- --coverage                  # With coverage
```

### Complete Test Suite
```bash
./start_dev_simple.sh --test             # All 135 tests
```

## E2E Testing Philosophy

Uses **real C3D files** with known expected results for validation.

**Test Files**: 
- `tests/fixtures/` → Real C3D data from GHOSTLY game
- Known baselines for performance metrics
- Validates entire EMG processing pipeline

**Reference**: `backend/tests/test_e2e_*.py`

## Test Architecture

### Backend Testing
- **Unit Tests** → `emg_analysis.py`, `signal_processing.py` 
- **API Tests** → FastAPI endpoints with mock dependencies
- **E2E Tests** → Full C3D processing pipeline
- **Coverage** → 62% EMG analysis coverage

### Frontend Testing  
- **Component Tests** → React components with @testing-library/react
- **Hook Tests** → Custom hooks with @testing-library/react-hooks
- **Integration** → Full user workflows
- **Compatibility** → React.StrictMode support

## Key Testing Patterns

### Mock Supabase Services
```python
from unittest.mock import MagicMock

def test_service():
    mock_supabase = MagicMock()
    mock_supabase.table().select().execute.return_value = mock_data
    # Test logic here
```

### Test React Components
```typescript
import { render, screen } from '@testing-library/react'
import { UserProvider } from '@/contexts/UserContext'

test('renders component', () => {
  render(
    <UserProvider>
      <Component />
    </UserProvider>
  )
  expect(screen.getByText('Expected text')).toBeInTheDocument()
})
```

## Quality Gates

1. **Unit Tests** → Core algorithms validated
2. **API Tests** → Endpoint contracts verified  
3. **E2E Tests** → Real data processing confirmed
4. **Frontend Tests** → UI components work correctly
5. **Build Tests** → TypeScript compilation passes

## Testing Anti-Patterns

❌ **Don't**:
- Use AsyncMock with Supabase services
- Skip E2E tests for "faster" builds
- Mock everything in integration tests
- Test implementation details instead of behavior

✅ **Do**:
- Use real C3D files for E2E validation
- Test user workflows end-to-end
- Mock external dependencies only
- Focus on testing behavior, not implementation