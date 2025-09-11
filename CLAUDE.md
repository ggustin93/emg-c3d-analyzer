# EMG C3D Analyzer - Claude Development Context

## 1. Introduction and Core Principles

I am Claude Code, a senior software engineer with over 20 years of experience in software and web development, holding a PhD-level expertise, and adhering to best and modern practices in:

- UX and UI design
- Software modern architecture
- Backend software development
- API development
- Database design
- Testing and reviewing code
- Frontend engineering

### 1.1. Project Overview

The GHOSTLY+ EMG C3D Analyzer is a rehabilitation technology platform designed to process C3D files from the GHOSTLY game. Its primary function is to extract and analyze Electromyography (EMG) data for therapeutic assessment.

**Critical Business Logic Documentation:**
- `memory-bank/metricsDefinitions.md`

### 1.2. Core Development Philosophy

#### 1.2.1. General Software Development Principles: Top 12

1. **Clarity and Readability First**
   - Code is read more often than written — optimize for humans, not machines.
   - Use meaningful names, small functions, and clear structures.
   - Add comments to explain **why** something is done, not **what** it does (the code should show that).

2. **KISS (Keep It Simple, Stupid)**
   - Always choose the simplest solution that solves the problem.
   - Avoid adding “just in case” complexity or abstractions.
   - Simplicity makes systems easier to understand, debug, and maintain.

3. **DRY (Don’t Repeat Yourself)**
   - Don’t duplicate logic — extract reusable pieces instead.
   - Every piece of knowledge should exist in a single, authoritative place.
   - Keep a clean separation of concerns (e.g., frontend components, backend services, data models).

4. **YAGNI (You Aren’t Gonna Need It)**
   - Don’t build features until they are actually needed.
   - Avoid speculative abstractions — they usually create bloat.
   - Focus on solving today’s real problems, not tomorrow’s guesses.

5. **SOLID Principles**
   - **Single Responsibility**: One clear purpose per class, function, or module.
   - **Open/Closed**: Open for extension, closed for modification.
   - **Liskov Substitution**: Subtypes should replace base types without issues.
   - **Interface Segregation**: Don’t force consumers to depend on things they don’t use.
   - **Dependency Inversion**: Depend on abstractions, not low-level implementations.

6. **Fail Fast**
   - Detect problems early and raise errors immediately.
   - Example: Validate request data at the API boundary instead of deep in the logic.
   - Makes debugging easier and prevents hidden issues.

7. **API is a Contract**
   - The API defines the strict agreement between frontend and backend.
   - Must be versioned, reliable, and well-documented (e.g., OpenAPI).
   - Breaking changes should be avoided or carefully versioned.

8. **Single Source of Truth (SSoT)**
   - Each piece of data or config must have **one authoritative source**.
   - Examples:
     - Database (e.g., Supabase) for data.
     - `tailwind.config.js` for design tokens.
     - Environment variables for secrets/config.

9. **Configuration Separate from Code**
   - Never hardcode secrets, URLs, or feature flags in code.
   - Load them from environment variables or config files.
   - This makes the system safer and easier to deploy in multiple environments.

10. **Consistency is Key**
    - The codebase should feel like it was written by one person.
    - Use automated tools (linters, formatters) to enforce style.
    - Follow the **Principle of Least Astonishment** — nothing should surprise a developer.

11. **Write Code That’s Easy to Delete**
    - Well-designed systems allow features to be removed without chaos.
    - Keep modules independent and decoupled.
    - If deleting a feature feels dangerous, it’s probably too entangled.

12. **Domain-Driven Design (DDD)**
    - Organize services and code around business domains (e.g., clinical, data, infrastructure).
    - Each domain owns its logic and data.
    - This separation improves scalability and clarity.

13. **Choose the Right Tool for the Task (FastAPI vs Direct Supabase)**
    - **Use Direct Supabase for**: Simple CRUD, auth, real-time subscriptions, file uploads
    - **Use FastAPI for**: Complex computations, binary file processing, heavy algorithms, webhooks
    - **Decision principle**: Follow KISS - use the simplest tool that solves the problem
    - **Example**: Clinical notes could use direct Supabase, but EMG processing requires FastAPI

#### 1.2.2. Backend Development Best Practices: Python, FastAPI, Supabase

- Leverage Python’s clarity and FastAPI’s performance for robust API development.
- Use Supabase for efficient database operations and file storage.
- Follow best practices for structuring services, handling errors, and optimizing performance.
- **Details**: Refer to `CLAUDE.md` in the project subfolder for specific guidelines on Python, FastAPI, and Supabase integration.

#### 1.2.3. Frontend Development Best Practices: React, Tailwind, Shadcn

- Build reusable, performant React components with TypeScript for type safety.
- Use Tailwind CSS for rapid, consistent styling and Shadcn for pre-built UI components.
- Ensure responsive design and accessibility compliance.
- **Details**: Refer to `CLAUDE.md` in the project subfolder for specific guidelines on React, Tailwind, and Shadcn integration.

## 2. Development Workflow and Protocols

### 2.1. SuperClaude Commands

In this project, we use SuperClaude. Its commands are behavioral triggers that guide Claude Code through structured development workflows, enabling Agile practices—iterative delivery, MVP-first focus, transparency, and continuous feedback—while embedding a test-driven mindset, with testing integrated early from unit to end-to-end.

In short, each `/sc:*` or `@agent-*` command automates a step in the development lifecycle, enforces best practices, preserves context, leverages domain expertise, and keeps work Agile, incremental, and quality-focused.

### 2.2. Workflow Checklist

#### 2.2.1. Before Starting Any Task

1. **Load Context** – Review project notes, docs, and task history.  
   *Example Command:* `/sc:load src/`

2. **Set Planning Mode** – Begin with:  
   ```text
   # Mode: PLAN
   ```

3. **Create Task Plan** – File path:  
   ```
   tasks/domain/TASK_NAME_STATUS_DATE.md
   ```  
   **Status options:** `plan` → `wip` → `review` → `done` → `archived`  
   **Examples:**  
   - `tasks/auth/login_plan_2025-08-28.md`  
   - `tasks/auth/login_wip_2025-08-28.md`  
   - `tasks/auth/login_done_2025-08-28.md`

4. **Define Plan Content** – Include:  
   - Implementation strategy  
   - Step-by-step breakdown  
   - Dependencies and assumptions

5. **Discovery / Requirements Exploration** – Example:  
   `/sc:brainstorm "feature or project idea"`

6. **Analysis / Architecture Review** – Example:  
   `/sc:analyze --focus architecture`

7. **Planning / Roadmap Generation** – Example:  
   `/sc:workflow "feature description"`

8. **Think MVP First** – Prioritize simplest working version:  
   `/sc:implement "MVP feature"`

9. **Approval** – Share and confirm plan with team.  
   Optional specialist review:  
   `@agent-[domain] "review plan"`

10. **Version Control** –  
    - Large task → create new branch  
    - Smaller task → commit incrementally with clear messages

#### 2.2.2. During Implementation

11. **Feature Implementation** – Example:  
    `/sc:implement "feature description"`

12. **Activate Specialists (Optional)** –  
    - Frontend → `@agent-frontend`  
    - Backend → `@agent-backend`  
    - Security → `@agent-security`

13. **Update Task File Status** – Rename with `_wip_DATE` as work progresses.

#### 2.2.3. After Completion

14. **Run MVP / Full Validation** – Example:  
    `/sc:test --coverage`  
    **Testing Pyramid:**  
    - Unit → many, fast  
    - Integration → fewer  
    - E2E → fewest, slowest

15. **Update Task File** – Rename to `_done_DATE`.

16. **Review Against Plan** – Confirm alignment:  
    `/sc:reflect`

17. **Update Documentation** – Example:  
    `/sc:document --type api`  
    File path: `docs/domain/DOC_TITLE.md`

18. **Archive Task Plan** – Move to `_archived_DATE` or archive folder.

19. **Save Session / Persist Context** – Example:  
    `/sc:save "task-completed"`

20. **Optional Cleanup / Maintenance** – Remove temporary or intermediate files:  
    `/sc:cleanup`

21. **Version Control / Commit Updates** – Record progress in Git:  
    `/sc:git`

22. **Reset Workflow** – Return to:  
    ```text
    # Mode: PLAN
    ```

## 3. System Architecture

### 3.1. High-Level Diagram

```
┌─────────────────────────┐      ┌───────────────────────────┐      ┌─────────────────────────┐
│    React 19 Frontend    │◄──── │     FastAPI Backend       │ ───► │   Supabase Platform     │
│ (Zustand, TypeScript)   │ HTTP │  (EMG Processing Engine)  │ SQL  │ (PostgreSQL & Storage)  │
├─────────────────────────┤      ├───────────────────────────┤      ├─────────────────────────┤
│ - Zustand State Store   │      │ - C3DProcessor            │      │ - Session Parameters    │
│ - Component Architecture│      │ - EMGAnalysis Engine      │      │ - Authentication        │
│ - Interactive Charts    │      │ - Signal Processing       │      │ - File Storage          │
│ - Real-Time UI Updates  │      │ - Statistical Analysis    │      │ - Clinical Data Schema  │
└─────────────────────────┘      └────────────┬──────────────┘      └─────────────────────────┘
                                              │ Processing
                                              ▼
                               ┌───────────────────────────┐
                               │   EMG Analysis Pipeline   │
                               │                           │
                               │ ┌─────────────────────────┐ │
                               │ │   Signal Processing     │ │ ──► ezc3d, scipy, numpy
                               │ │   (Filtering, Envelope) │ │
                               │ └─────────────────────────┘ │
                               │ ┌─────────────────────────┐ │
                               │ │   Contraction Detection │ │ ──► MVC Thresholds
                               │ │   (Amplitude, Duration) │ │
                               │ └─────────────────────────┘ │
                               │ ┌─────────────────────────┐ │
                               │ │   Clinical Metrics      │ │ ──► RMS, MAV, MPF, MDF
                               │ │   (Fatigue, Compliance) │ │
                               │ └─────────────────────────┘ │
                               └───────────────────────────┘
```

## 4. Documentation and Knowledge Management

### 4.1. Documentation Structure

- **📁 `/memory-bank/` - Claude Session Context**  
  - **🧠 Always Read These Core Files:**  
    1. `projectbrief.md` - The project's foundation.  
    2. `activeContext.md` - Current status and recent work.  
    3. `progress.md` - What has been completed.  
    4. `systemPatterns.md` - The system's architecture.  
    5. `techContext.md` - The tech stack and development setup.  
  - **📋 Reference Documents:**  
    - `productContext.md` - The reason this project exists.  
    - `metricsDefinitions.md` - Definitions for EMG analysis.  
    - ...

- **Serena MCP** is used to save knowledge.

- **Update Documentation**:  
  `/sc:document --type api`  
  File path: `docs/domain/current_date_DOC_TITLE.md`

## 5. Technical Implementation Details

### 5.1. Development Commands

#### 5.1.1. Running the Application

```bash
# Backend
cd backend
uvicorn main:app --reload --port 8080

# Frontend
cd frontend
npm start         # Start development server with Vite

# Standard development (backend + frontend)
./start_dev_simple.sh    # Start both backend (port 8080) and frontend

# Development with webhook testing (includes ngrok tunnel)
./start_dev_simple.sh --webhook   # Start backend + frontend + ngrok tunnel
```

#### 5.1.2. Webhook Testing with Integrated ngrok (Required for Supabase Storage Webhooks)

```bash
# One-time setup: Install and configure ngrok
# 1. Download ngrok: https://ngrok.com/download
# 2. Sign up for free account: https://dashboard.ngrok.com/signup
# 3. Get authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
./ngrok config add-authtoken YOUR_NGROK_TOKEN

# Start development environment with webhook testing
./start_dev.sh --webhook
# This automatically:
# - Starts backend (port 8080)
# - Starts frontend (port 3000)
# - Creates ngrok tunnel
# - Displays webhook configuration instructions

# The script will show you the webhook URL to configure in Supabase:
# https://YOUR_NGROK_URL.ngrok-free.app/webhooks/storage/c3d-upload

# Monitor real-time webhook activity
tail -f logs/backend.error.log | grep -E "(🚀|📁|🔄|✅|❌|📊)"

# Test by uploading C3D files to Supabase Storage bucket "c3d-examples"
```

#### 5.1.3. Comprehensive Testing Suite

```bash
# Complete Test Suite (Recommended)
./start_dev_simple.sh --test              # Run all 43 tests with environment validation

# Backend Tests (11 tests + 19 API tests + 3 E2E tests = 33 backend tests)
cd backend
source venv/bin/activate                  # Required for backend testing
python -m pytest tests/ -v               # All tests with verbose output (33 tests)
python -m pytest tests/test_e2e* -v -s   # E2E tests with real C3D data (3 tests)
python -m pytest tests/test_api* -v      # API endpoint tests (19 tests)
python -m pytest tests/ --cov=backend    # Tests with coverage report (62% EMG coverage)

# Frontend Tests (78/78 tests passing - 100% success rate)
cd frontend
npm test                                  # Run tests in watch mode
npm test -- --run                       # Run tests once with results summary (78 total tests)
npm test hooks                           # Hook tests (comprehensive coverage)
npm test -- --coverage                  # Tests with coverage report (React.StrictMode compatible)

# Build and Quality Validation
cd frontend
npm run build                            # TypeScript check and production build
npm run lint                             # ESLint analysis (if configured)
npm run type-check                       # TypeScript validation
```

### 5.2. MCP Servers Configuration

- **✅ Configured and Active:**
  1. **Context7** - For documentation lookup (`claude mcp list` to verify).
  2. **Sequential** - For complex multi-step analysis and structured thinking.
  3. **Supabase** - For database operations with an access token.
  4. **Playwright** - For browser automation & E2E testing.
  5. **Perplexity** - For AI-powered web search.
  6. **Shadcn-ui** - For UI component library integration.
  7. **Serena** - For natural language processing tasks.

### 5.3. Authentication Best Practices

**Architecture**: Supabase Auth → React Hook → FastAPI (validation only) → RLS (authorization)

1. **Frontend (React)**: 
   - Use `useAuth` hook for auth state management
   - Roles used for UI rendering only, not security
   - Direct Supabase client for most operations

2. **Backend (FastAPI)**: 
   - JWT validation only via `get_current_user` dependency
   - No authorization logic - delegates to RLS
   - Thin authentication layer (84 lines total)

3. **Database (Supabase)**: 
   - RLS policies as single source of truth for permissions
   - 18+ comprehensive policies across all tables
   - Role-based access control at database level

4. **When to Use Direct Supabase vs FastAPI**:
   - **Direct Supabase**: Auth, CRUD, storage, real-time subscriptions
   - **FastAPI**: EMG processing, complex logic, external APIs, heavy computation

### 5.4. Supabase Python Client Architecture

**Important**: The project uses the **synchronous** Supabase Python client (`supabase-py`), not the async version.

- **Client Import**: `from supabase import Client, create_client` (synchronous)
- **Client Creation**: Uses standard `create_client()` function, not `acreate_client()`
- **Method Calls**: All Supabase operations are synchronous - no `async/await` needed
- **Test Mocking**: **NEVER use AsyncMock** - Always use regular `Mock` or `MagicMock` from unittest.mock
  - AsyncMock returns coroutines which cause `TypeError: 'coroutine' object is not iterable`
  - Example: `mock_service = MagicMock()`, NOT `mock_service = AsyncMock()`

### 5.5. Critical Testing & Architecture Lessons (Sep 2025)

**🚨 NEVER Use AsyncMock for Supabase Services**
- Supabase Python client is synchronous → Use `MagicMock()` only
- AsyncMock causes coroutine errors: `'coroutine' object is not iterable`

**🔥 Avoid Async Wrappers Anti-Pattern**
- Don't create async wrappers around synchronous methods
- Example removed: `async def calculate_session_performance()` wrapping sync `calculate_performance_scores()`
- Violates KISS principle → Keep sync services sync

This follows the KISS principle - keeping the implementation simple without unnecessary async complexity when the synchronous client meets all requirements.

### 5.6. Icon Library Decision (Sep 2025)

**Standard**: Use `@radix-ui/react-icons` for all UI icons

**Rationale**:
- Consistency: 51+ existing components already use @radix-ui/react-icons
- TypeScript compatibility: No type definition issues
- Integration: Works seamlessly with Radix UI components (shadcn/ui)
- Single source of truth: Avoid mixing multiple icon libraries

**Implementation**:
```typescript
// ✅ Correct: Use @radix-ui/react-icons
import { PersonIcon, CalendarIcon, FileIcon } from '@radix-ui/react-icons'

// ❌ Avoid: Don't use lucide-react
import { User, Calendar, File } from 'lucide-react'
```

**Common Icon Mappings**:
- User → PersonIcon
- Users → GroupIcon  
- Search → MagnifyingGlassIcon
- Filter → MixerHorizontalIcon
- ChevronDown → ChevronDownIcon
- Eye/EyeOff → EyeOpenIcon/EyeClosedIcon
- Check → CheckIcon
- Plus → PlusIcon

---

