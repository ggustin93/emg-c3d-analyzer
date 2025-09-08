
# CLAUDE.md — Backend Guidelines (FastAPI & Supabase)

Refer to this document for modern backend development and architectural principles. For general software engineering guidance (KISS, DRY, SOLID) and project context, see the main CLAUDE.md in the project root.

This document establishes the **backend engineering** best practices for our stack (**FastAPI**, **Supabase Client**, **Pydantic**, and **Ruff**) to support the creation of a scalable, secure, and maintainable API.

---

## 1/ Mission

**Backend Engineer:** Build secure, scalable, and resilient APIs by implementing a clean, domain-driven, and testable architecture that leverages the full power of the Supabase ecosystem.

---

## 2/ Core Recommendations

### 2.1 Architecture & Domain-Driven Design

1.  **Organize by Domain, Not by Function (DDD)**
    Structure your entire application—services, repositories, and Pydantic models—around business domains (e.g., `clinical`, `user`, `c3d_processing`). This is our most important architectural principle for clarity and scalability.

2.  **Keep API Routers Thin; Business Logic in Services**
    An API route's only job is to handle HTTP concerns. It should parse the request, call a *single* high-level service method, and return a response. All core business logic **must** reside in the service layer.

3.  **Implement the Repository Pattern for Data Access**
    Decouple your services from the database. Services call methods on a repository (e.g., `patient_repository.get_by_id()`) instead of directly using the Supabase client. This makes your business logic pure and easy to unit test.

4.  **Isolate Core Algorithms from Business Logic**
    Complex, reusable algorithms (like signal processing or scoring formulas) should be in their own pure Python packages (e.g., `/emg`), completely independent of the FastAPI application framework. Services will then import and use these algorithms.

5.  **Decouple Everything with Dependency Injection (`Depends`)**
    Inject all shared resources—the Supabase client, service classes, configuration objects—into your API routes and even into other services. This makes your application's dependencies explicit and is critical for testing.

6.  **Use Row-Level Security (RLS) as Your Primary Authorization Layer**
    Your most important security boundary is the database itself. RLS is a PostgreSQL feature that lets you define granular access policies on a per-row basis.
    *   **Why it's our primary security model:**
        *   **Single Source of Truth:** Authorization logic lives directly in the database. Even if there's a bug in our API, it's impossible for it to fetch data that the RLS policy forbids.
        *   **Leverages Supabase Auth:** Supabase makes this incredibly powerful by exposing user details (like `auth.uid()` and `auth.role()`) directly within SQL policies.
        *   **Simplifies API Code:** Our FastAPI code doesn't need complex checks. It simply queries for data, and the database transparently filters the results based on the logged-in user.
    *   **Example Policy:** "A therapist can only see their own patients."
        ```sql
        -- in supabase/migrations/xxxx_add_patients_rls.sql
        CREATE POLICY "Therapists can view their own patients"
        ON public.patients FOR SELECT
        USING (auth.uid() = therapist_id);
        ```

7.  **Leverage Platform Features for Asynchronous Workflows**
    For non-blocking operations, use platform features like Supabase Storage webhooks. This allows for a stateless, scalable API design where heavy processing can happen in the background.

### 2.2 Data, Tooling & Quality

8.  **Define Strict, Domain-Organized Pydantic Contracts**
    Every data structure that crosses a boundary (API, service, repository) **must** be defined by a Pydantic model. Organize these models into domain-specific packages (e.g., `models/clinical/`) for clarity.

9.  **Manage Schema as Code with Supabase CLI Migrations**
    The database schema, including tables, RLS policies, and Postgres functions, is code. **All** changes **must** be managed via SQL migration files in the `/supabase/migrations` directory and committed to Git.

10. **Use Postgres Functions (`rpc`) for Atomic Transactions**
    For any business operation that must be all-or-nothing, create a `SECURITY DEFINER` Postgres function in a migration file and call it from your service layer using `supabase.rpc()`. This guarantees data integrity.

11. **Enforce Code Quality Religiously with Ruff**
    Ruff is our single source of truth for code style and quality. Its rules, configured in `pyproject.toml`, are integrated into pre-commit hooks and CI/CD to ensure a consistent and high-quality codebase.

12. **Write Comprehensive, Layered Tests with `pytest`**
    *   **Unit Tests:** Test core algorithms and services in complete isolation by mocking their dependencies (especially repositories).
    *   **Integration Tests:** Use FastAPI's `TestClient` to test the API layer, ensuring routes, dependencies, and services work together correctly.

13. **Centralize Configuration with Pydantic `BaseSettings`**
    Manage all configuration (including Supabase credentials) through environment variables loaded into a single, type-safe Pydantic `BaseSettings` model (e.g., in `config.py`).

14. **Supabase Python Client is Synchronous**
    The project uses the standard **synchronous** `supabase-py` client, not the async version. This is a deliberate choice following the KISS principle.
    
    **Critical Implementation Details:**
    - Import: `from supabase import Client, create_client` (NOT from `supabase._async.client`)
    - Client creation: `create_client(url, key)` returns a synchronous client
    - All Supabase operations are synchronous - no `async/await` needed for database calls
    - Service methods that only use Supabase should be regular functions, not `async def`
    - Example pattern:
      ```python
      # Service layer - SYNCHRONOUS
      def get_file_notes(self, file_path: str, author_id: UUID):
          result = self.supabase.table('clinical_notes').select('*').execute()
          enriched_notes = self._enrich_notes_with_patient_codes(notes)  # No await
          return enriched_notes
      
      # API route can still be async for other I/O
      @router.get("/file")
      async def get_file_notes(...):
          notes = notes_service.get_file_notes(file_path, author_id)  # No await needed
      ```
    
    **Testing Implications:**
    - Use regular `Mock` from `unittest.mock`, not `AsyncMock`
    - Test methods don't need `@pytest.mark.asyncio` for Supabase operations
    - Mock chains should return values directly, not coroutines

15. **Implement Resilient and Flexible Logic**
    As demonstrated in the C3D channel handling, design your services to be resilient to variations in input data. Implement fallbacks and flexible mapping to gracefully handle real-world inconsistencies.

---

## 3/ Recommended Backend File Organization

This structure is based on our successful domain-driven approach.

```text
/backend
├── api/                   # API Routers & Dependencies (Thin Controller Layer)
│   ├── routes/            # Feature-based routers (e.g., upload.py, mvc.py)
│   └── dependencies/      # Reusable dependency injection logic
├── core_algorithms/       # Pure, framework-agnostic algorithms (e.g., /emg)
├── database/              # Supabase client initialization
├── models/                # Pydantic models, organized by domain
│   ├── domain_a/
│   ├── domain_b/
│   └── shared/
├── services/              # Business logic, organized by domain
│   ├── domain_a/
│   │   ├── repositories/  # Data access for this domain
│   │   └── service_a.py
│   └── domain_b/
├── supabase/              # Supabase CLI generated migrations
│   └── migrations/
├── tests/                 # Pytest tests for all layers
├── config.py              # Centralized Pydantic settings
└── main.py                # FastAPI app instance, middleware, routers
```

---

## 4/ Guiding Principles

*   **KISS (Keep It Simple, Stupid):** Strive for simplicity within each component, even if the overall domain is complex.
*   **DRY (Don't Repeat Yourself):** Abstract repeated logic into services, repositories, or dependencies.
*   **SRP (Single Responsibility Principle):** Each function, class, and module should have one primary, well-defined job.
*   **Security First (Leverage RLS):** Default to secure. Your primary security model is in the database, not the application layer.
*   **Consistency is Key:** A consistent, domain-driven structure makes the codebase predictable and easy to navigate.

---

## 5/ Testing & Quality Assurance

### 5.1 Comprehensive Test Suite (135 Tests - 95% Success Rate ✅)

The backend includes a **production-ready test suite** with comprehensive coverage across multiple testing layers:

**Test Categories (Type-Based Organization):**
- **Unit Tests**: 7 files, 21 tests - Core EMG algorithms and business logic
- **Integration Tests**: 6 files, 54 tests - Component interactions, database operations
- **API Tests**: 3 files, 32 tests - FastAPI endpoint validation with TestClient  
- **E2E Tests**: 2 files, 9 tests - Complete integration workflows with real clinical data

**Test Metrics:**
- **135 total tests**: 128 passed, 7 skipped (95% success rate)
- **47% code coverage**: Comprehensive validation of critical components  
- **Real Clinical Data**: 2.74MB GHOSTLY C3D files for production-grade testing
- **18 test files**: Type-based organization with domain preservation

### 5.2 Test Execution Commands

```bash
# Complete test suite (recommended for CI/CD)
source venv/bin/activate
export PYTHONPATH="${PWD}:${PYTHONPATH:-}"
python -m pytest tests/ -v --tb=short --cov=. --cov-report=term

# By test category (type-based organization)
python -m pytest tests/unit/ -v           # Unit tests (21 tests, fast)
python -m pytest tests/integration/ -v   # Integration tests (54 tests)
python -m pytest tests/api/ -v           # API endpoint tests (32 tests)
python -m pytest tests/e2e/ -v -s        # E2E tests (9 tests, requires setup)

# Enable all skipped tests (C3D processor + E2E Supabase)
export SKIP_E2E_TESTS=false
export SUPABASE_URL="your-project-url"
export SUPABASE_SERVICE_KEY="your-service-key" 
python -m pytest tests/ -v --tb=short    # All 135 tests

# Coverage analysis
python -m pytest tests/ --cov=backend --cov-report=html
open htmlcov/index.html                   # View detailed coverage report
```

### 5.3 Production Integration Testing

**Complete Webhook Integration Validated:**
- **Real File Upload**: C3D files to Supabase Storage bucket `c3d-examples`
- **Webhook Processing**: Automatic patient/therapist lookup and session creation
- **EMG Analysis**: Full signal processing pipeline with 20+ contractions detected
- **Clinical Output**: Therapeutic assessment with compliance metrics
- **Database Population**: Session records with proper UUID relationships

**Test Results Example:**
```
Session: b101a1a9-5c28-4c76-a6ce-06075d52998f
Patient: P001 -> 15f3fd10-e3eb-4aa3-8c7d-9aed819b678b
Therapist: e7b43581-743b-4211-979e-76196575ee99
EMG Analysis: 20 contractions, 100% MVC compliance, therapeutic recommendation
```

### 5.4 Test Organization Structure (Type-Based with Domain Preservation)

```text
tests/
├── unit/                          # 7 files - Pure unit tests
│   ├── emg/                      # EMG algorithm tests (5 files, 11 tests)
│   │   ├── test_emg_analysis.py         # Core signal processing
│   │   ├── test_contraction_flags.py    # Validation flags
│   │   ├── test_processing_parameters.py # Parameter validation
│   │   ├── test_processor.py           # C3D processor core (4 tests skipped)
│   │   └── test_serialization.py       # Data serialization
│   └── clinical/                 # Clinical logic tests (2 files, 10 tests)
│       ├── test_performance_scoring_service_comprehensive.py # GHOSTLY+ scoring
│       └── validate_metrics_definitions_compliance.py # Spec compliance
├── integration/                   # 6 files - Component integration
│   ├── clinical/                 # Therapy workflows (3 files, 39 tests)
│   │   ├── test_therapy_session_processor_critical.py # Critical workflows
│   │   ├── test_therapy_session_processor_comprehensive.py # Complete integration
│   │   └── test_database_table_population.py # Database validation
│   ├── test_scoring_config_integration.py # Scoring integration
│   ├── test_database_improvement.py      # Database improvements
│   └── test_metadata_creation.py         # Metadata processing
├── api/                          # 3 files - API layer testing
│   ├── test_api_endpoints.py            # All FastAPI endpoints (20 tests)
│   ├── test_scoring_config_api.py       # Scoring API endpoints (5 tests)
│   └── test_webhook_system_critical.py  # Webhook API testing (7 tests)
├── e2e/                          # 2 files - End-to-end workflows
│   ├── test_e2e_complete_workflow.py    # Complete user workflow (3 tests)
│   └── test_webhook_complete_integration.py # Full webhook integration (6 tests, 3 skipped)
├── samples/                      # Real clinical data
│   └── Ghostly_Emg_20230321_17-50-17-0881.c3d # 2.74MB GHOSTLY file
├── conftest.py                   # Pytest configuration and fixtures
├── run_tests.py                  # Test runner script
├── run_tests.sh                  # Bash test runner
└── README.md                     # Comprehensive test documentation with visual diagrams
```

### 5.5 Testing Best Practices

1. **Test Isolation**: Each test is independent with proper setup/teardown
2. **Real Data Testing**: Uses actual 2.74MB GHOSTLY clinical C3D files
3. **Mocking Strategy**: Comprehensive mocking for external dependencies
4. **Async Testing**: Full support for FastAPI async operations
5. **Production Parity**: Integration tests match production workflows exactly

---

## 6/ Available tools in Claude Code CLI

Your AI agent has access to the following MCP (Model Context Protocol) tools to ensure backend quality, consistency, and data integrity:

*   **Context 7 MCP**: The AI agent's primary research tool. It provides access to up-to-date, context-aware documentation for any library, framework, or technology (e.g., Supabase, FastAPI, Python). Use this to learn best practices, understand APIs, and find correct code examples.
*   **Supabase MCP**: A specialized tool for safely interacting with our Supabase project. The agent should understand that schema is managed by the Supabase CLI in the `/supabase` directory, and that business logic should leverage RLS for security and `rpc` for transactions. This tool can be used to query data, inspect the schema, and understand the current state of the database.
