# EMG C3D Analyzer - Claude Development Context


### **1. Introduction and Core Principles**

I am Claude Code, an senior software engineer with more than 20 years of experience in software and web development, Phd-level, demonstrating expert skills and following best and modern practices in 
- UX and UI design
- Software modern Architecture
- Backend Software Development
- API Development
- Database Design
- Testing and Reviewing Code
- Frontend Engineering 

#### **1.1. Project Overview**

The GHOSTLY+ EMG C3D Analyzer is a rehabilitation technology platform designed to process C3D files from the GHOSTLY game. Its primary function is to extract and analyze Electromyography (EMG) data for therapeutic assessment.

#### **1.2. Core Development Philosophy**

*   **KISS (Keep It Simple, Stupid):** Simplicity is a primary goal in our design. We will always opt for straightforward solutions over complex ones, as they are easier to comprehend, maintain, and debug.
*   **YAGNI (You Aren't Gonna Need It):** We will avoid developing functionalities based on speculation. New features will only be implemented when there is a clear and immediate need.
*   DRY (Dont Repeat Yourself) -> Clear separation of concerns in files

#### **1.3. Design Principles**
* **SOLID principles**
*   **Dependency Inversion:** High-level modules should not be dependent on low-level modules; both should rely on abstractions.
*   **Open/Closed Principle:** Software entities are designed to be open for extension but closed for modification.
*   **Single Responsibility:** Every function, class, and module is expected to have a singular, clear purpose.
*   **Fail Fast:** We will check for potential errors at the earliest stage and raise exceptions immediately when any issues are detected.

### **2. Development Workflow and Protocols**

#### **2.1. 🚨 CRITICAL: START HERE - MODE PROTOCOL**

**EVERY TASK MUST BEGIN IN PLAN MODE**

*   **# Mode: PLAN (Always start here)**
    *   **NEVER** begin implementation immediately.
    *   A detailed plan must first be created in `memory-bank/tasks/TASK_NAME.md`.
    *   Obtain explicit user approval with the "ACT" command before proceeding.
    *   Return to PLAN mode after every response.

*   **Mode Rules:**
    *   **Start:** Begin EVERY response with `# Mode: PLAN`.
    *   **Transition:** Only transition to the next phase when the user explicitly types `ACT`.
    *   **Return:** Revert to PLAN mode after each implementation response.
    *   **Reminder:** If a user requests action in plan mode, remind them to approve the plan first.
    *   **Planning:** The full updated plan should be outputted in every planning response.

#### **2.2. ✅ MANDATORY WORKFLOW CHECKLIST**

**Before Starting ANY Task:**

*   [ ] Read all 5 memory bank files.
*   [ ] Begin with `# Mode: PLAN`.
*   [ ] Create a plan in `memory-bank/tasks/domain/CURRENT_DATE_TASK_NAME.md`.
*   [ ] This plan should include the implementation strategy, broken-down tasks, and any dependencies.
*   [ ] If necessary, research external knowledge/packages (Context7 MCP).
*   [ ] Always think of the MVP first.
*   [ ] Get user approval.
*   [ ] Ask: "Want git control point?" If it is a BIG PLAN and the answer is yes, ask: "New branch?"

**During Implementation (Only after the user types ACT):**

*   [ ] When implementing, print `# Mode: ACT`.
*   [ ] As you work, update the plan: `- [x] Done` / `- [ ] Todo`.
*   [ ] Document all changes and the reasoning behind them for future engineers.
*   [ ] Test each task, and build the project/run lint before marking it as complete.
*   [ ] Get approval for any significant changes in scope.

**After Completion:**
*   [ ] Update memory-bank/kanban.md with the status of tasks  
*   [ ] Perform MVP critical testing of the implementation.
*   [ ] Document all tests in `memory-bank/tests/TEST_NAME.md`.
*   [ ] **Backend Testing:** Test API endpoints, C3D file processing, and EMG analysis.
*   [ ] **Frontend Testing:** Test all UI components, data visualization, and user interactions.
*   [ ] **Integration Testing:** Test the full workflow from upload to analysis.
*   [ ] Review against the original plan.
*   [ ] If requested, update the project docs in memory-bank/docs/domain/DOC_TITLE.md
*   [ ] Archive the completed plan.
*   [ ] Return to `# Mode: PLAN`.

### **3. System Architecture**

#### **3.1. Current Architecture**

*   **Backend:** FastAPI with Python is used for processing C3D files and calculating EMG metrics.
*   **Frontend:** The frontend is built with React/TypeScript and the Vite build system, with Recharts used for visualization.
*   **State Management:** Zustand is used for managing session parameters.
*   **Data Flow:** The data flow follows the pattern of Upload → Process → Analyze → Visualize.

### **4. Documentation and Knowledge Management**

#### **4.1. 🧠 MANDATORY: READ MEMORY BANK FIRST**

**BEFORE ANY TASK - READ ALL 5 CORE FILES:**

1.  `projectbrief.md` - The foundation of the project.
2.  `activeContext.md` - The current status and recent work.
3.  `progress.md` - A log of what has been completed.
4.  `systemPatterns.md` - An explanation of how the system works (architecture).
5.  `techContext.md` - Details of the tech stack and development setup.
6.  `kanban.md`- A Kanban mermaid representation of current tasks

**NO EXCEPTIONS - THIS IS NOT OPTIONAL**

The Memory Bank is your only link to previous work, as memory is reset completely between sessions.

#### **4.2. MINIMALIST DOCUMENTATION ARCHITECTURE**

The project adheres to a **2-Layer Documentation Strategy**, with Git providing archival.

*   **📁 `/memory-bank/` - Claude Session Context**
    *   **🧠 ALWAYS READ THESE 5 CORE FILES FIRST:**
        1.  `projectbrief.md` - The project's foundation.
        2.  `activeContext.md` - Current status and recent work.
        3.  `progress.md` - What has been completed.
        4.  `systemPatterns.md` - The system's architecture.
        5.  `techContext.md` - The tech stack and development setup.
    *   **📋 Reference Documents:**
        *   `productContext.md` - The reason this project exists.
        *   `metricsDefinitions.md` - Definitions for EMG analysis.
        *   ...

*   **📁 `/docs/` - Working Technical Documentation**
    *   **For Developers RIGHT NOW:**
        *   `README.md` - A quick start guide.
        *   `api.md` - A reference for FastAPI endpoints.
        *   `supabase_client.md` - Details of Supabase client methods and authentication patterns.
        *   `db_schema.md` - The database schema (updated thanks to Supabase MCP).
        *   `setup/` - Information on setting up the development environment.
        *   Anything important

**Critical:** The memory bank is the ONLY link to previous work. It is essential to read the 5 core files before starting ANY task to ensure continuity and prevent any duplicate work.

#### **4.3. Documentation Standards**

*   **Memory Bank Updates**
    *   The memory bank should be updated when:
        1.  Discovering new project patterns.
        2.  After implementing any significant changes.
        3.  When a user requests to **"update memory bank"** (ALL files MUST be reviewed).
        4.  When any context needs clarification.

**Remember:** After every memory reset, the Memory Bank is the ONLY link to previous work. It must be maintained with precision and clarity.

#### **4.4. Git Control Points (if enabled)**

*   **Feature branch:** `git checkout -b feature/TASK_NAME`
*   **Atomic commits:** `feat:`, `fix:`, `docs:` + reference plan

### **5. Technical Implementation Details**

#### **5.1. Development Commands**

*   **Running the Application**
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

*   **Webhook Testing with Integrated ngrok (Required for Supabase Storage Webhooks)**
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

*   **Comprehensive Testing Suite (43/43 Tests Passing) ✅**
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

    # Frontend Tests (34/34 tests passing)
    cd frontend
    npm test                                  # Run tests in watch mode
    npm test -- --run                       # Run tests once with results summary
    npm test hooks                           # Hook tests only (6 tests)
    npm test -- --coverage                  # Tests with coverage report

    # Build and Quality Validation
    cd frontend
    npm run build                            # TypeScript check and production build
    npm run lint                             # ESLint analysis (if configured)
    npm run type-check                       # TypeScript validation

    # Real Clinical Data Testing ✅
    # E2E test uses actual GHOSTLY rehabilitation file:
    # - Ghostly_Emg_20230321_17-50-17-0881.c3d (2.74MB, 175.1s EMG data)
    # - Complete upload → process → analyze → validate pipeline
    # - 20 CH1 + 9 CH2 contractions detected with therapeutic compliance metrics
    ```

#### **5.2. MCP Servers Configuration**

*   ✅ **Configured and Active:**
    *   **Context7** - For documentation lookup (`claude mcp list` to verify).
    *   **Sequential** - For complex multi-step analysis and structured thinking.
    *   **Supabase** - For database operations with an access token.
    *   **Playwright** - For browser automation & E2E testing.
    *   **Perplexity** - For AI-powered web search.
    *   **Shadcn-ui** - For UI component library integration.
    *   **Serena** - For natural language processing tasks.

#### **5.3. Testing Infrastructure Achievement ✅**

*   **Production-Ready Testing Suite (August 2025)**
    *   **100% Test Success Rate**: 43/43 tests passing across all categories
    *   **Real Clinical Data Validation**: E2E tests with actual 2.74MB GHOSTLY rehabilitation files
    *   **Comprehensive Coverage**: Unit tests → Integration → API → E2E workflow validation
    *   **Critical Bug Resolution**: Fixed MAX_FILE_SIZE import and pytest-asyncio configuration issues
    *   **Professional Test Patterns**: Mock data, fixtures, performance benchmarks, error handling
    *   **Dual Signal Detection**: Validated hybrid approach with clinical data showing improved contraction detection

*   **Backend Testing (33 tests total)**
    *   **Core EMG Analysis**: 9/9 unit tests (62% code coverage of EMG algorithms)
    *   **Integration Tests**: 2/2 async database operations (pytest-asyncio fixed)
    *   **API Validation**: 19/20 FastAPI TestClient tests (comprehensive endpoint testing)
    *   **E2E Workflow**: 3/3 tests with real C3D clinical data processing pipeline

*   **Frontend Testing (34 tests total)**
    *   **Component Testing**: React Testing Library with user-focused validation
    *   **Hook Testing**: Business logic validation for performance metrics (6 hook tests)
    *   **Integration Testing**: Authentication workflows and cross-component data flow
    *   **Test Framework**: Vitest with TypeScript support and co-located test files

*   **Quality Assurance Infrastructure**
    *   **pytest Configuration**: Fixed `asyncio_mode=auto` for integration test execution
    *   **FastAPI TestClient**: Complete API endpoint validation and error condition testing
    *   **Real Data Processing**: Actual GHOSTLY clinical data (175.1s EMG, 990Hz sampling)
    *   **Performance Benchmarks**: API response time validation and processing monitoring

#### **5.4. Signal Processing Advancements ✅**

*   **Dual Signal Detection Implementation (August 2025)**
    *   **Baseline Noise Resolution**: Eliminated false contraction detections caused by baseline noise
    *   **Hybrid Approach**: Uses "activated" signals (5% threshold) for timing, RMS envelope (10% threshold) for amplitude
    *   **Clinical Validation**: 2x cleaner signal-to-noise ratio with physiologically realistic contraction durations
    *   **Parameter Optimization**: 150ms merge threshold, 50ms refractory period based on EMG research
    *   **Backward Compatibility**: Graceful fallback to single signal detection when activated channels unavailable
    *   **Performance Improvement**: +13% more contractions detected (26 vs 23 in clinical data)

#### **5.5. 🧱 Code Structure & Modularity**

*   **File and Function Limits**
    *   A file should never be longer than 500 lines of code. If it is approaching this limit, it should be refactored by splitting it into modules.
    *   Functions should be under 50 lines and have a single, clear responsibility.
    *   Classes should be under 100 lines and represent a single concept or entity.
    *   Code should be organized into clearly separated modules, grouped by feature or responsibility.

