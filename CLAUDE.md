# EMG C3D Analyzer - Claude Development Context

An organized and streamlined version of the document is presented below, tailored for a senior software architect's perspective.

### **1. Introduction and Core Principles**

#### **1.1. Project Overview**

The GHOSTLY+ EMG C3D Analyzer is a rehabilitation technology platform designed to process C3D files from the GHOSTLY game. Its primary function is to extract and analyze Electromyography (EMG) data for therapeutic assessment.

#### **1.2. Core Development Philosophy**

*   **KISS (Keep It Simple, Stupid):** Simplicity is a primary goal in our design. We will always opt for straightforward solutions over complex ones, as they are easier to comprehend, maintain, and debug.
*   **YAGNI (You Aren't Gonna Need It):** We will avoid developing functionalities based on speculation. New features will only be implemented when there is a clear and immediate need.

#### **1.3. Design Principles**

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
*   [ ] Create a plan in `memory-bank/tasks/TASK_NAME.md`.
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

*   [ ] Perform MVP critical testing of the implementation.
*   [ ] Document all tests in `memory-bank/tests/TEST_NAME.md`.
*   [ ] **Backend Testing:** Test API endpoints, C3D file processing, and EMG analysis.
*   [ ] **Frontend Testing:** Test all UI components, data visualization, and user interactions.
*   [ ] **Integration Testing:** Test the full workflow from upload to analysis.
*   [ ] Review against the original plan.
*   [ ] If requested, update the project docs.
*   [ ] Archive the completed plan.
*   [ ] Return to `# Mode: PLAN`.

### **3. System Architecture**

#### **3.1. Current Architecture**

*   **Backend:** FastAPI with Python is used for processing C3D files and calculating EMG metrics.
*   **Frontend:** The frontend is built with React/TypeScript and the CRACO build system, with Recharts used for visualization.
*   **State Management:** Zustand is used for managing session parameters.
*   **Data Flow:** The data flow follows the pattern of Upload → Process → Analyze → Visualize.

#### **3.2. Key Technical Decisions**

1.  **Client-Side Plotting:** All data visualization is handled by React/Recharts on the client side.
2.  **Bundled Response:** A single API response contains all the necessary data.
3.  **Flexible Channel Handling:** The system is robust enough to handle different C3D channel naming conventions.
4.  **Advanced EMG Analysis:** The platform provides comprehensive biomedical metrics complete with clinical documentation.

#### **3.3. Project Architecture**

We will follow a strict vertical slice architecture, with tests living next to the code they are testing:
```
src/project/
    __init__.py
    main.py
    tests/
        test_main.py
    conftest.py

    # Core modules
    database/
        __init__.py
        connection.py
        models.py
        tests/
            test_connection.py
            test_models.py

    auth/
        __init__.py
        authentication.py
        authorization.py
        tests/
            test_authentication.py
            test_authorization.py

    # Feature slices
    features/
        user_management/
            __init__.py
            handlers.py
            validators.py
            tests/
                test_handlers.py
                test_validators.py

        payment_processing/
            __init__.py
            processor.py
            gateway.py
            tests/
                test_processor.py
                test_gateway.py
```

### **4. Documentation and Knowledge Management**

#### **4.1. 🧠 MANDATORY: READ MEMORY BANK FIRST**

**BEFORE ANY TASK - READ ALL 5 CORE FILES:**

1.  `projectbrief.md` - The foundation of the project.
2.  `activeContext.md` - The current status and recent work.
3.  `progress.md` - A log of what has been completed.
4.  `systemPatterns.md` - An explanation of how the system works (architecture).
5.  `techContext.md` - Details of the tech stack and development setup.

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
    *   **📁 Organized Context:**
        *   `future-work/` - A log of planned features.
        *   `research/` - A record of active investigations.
        *   `archived/` - Historical context and completed features.

*   **📁 `/docs/` - Working Technical Documentation**
    *   **For Developers RIGHT NOW:**
        *   `README.md` - A quick start guide.
        *   `api.md` - A reference for FastAPI endpoints.
        *   `supabase_client.md` - Details of Supabase client methods and authentication patterns.
        *   `db_schema.md` - The database schema.
        *   `setup/` - Information on setting up the development environment.

*   **Git-Based Archival**
    *   **Historical context is preserved through:**
        *   Git commit history and branches.
        *   `/memory-bank/archived/` for important historical context.

**Critical:** The memory bank is the ONLY link to previous work. It is essential to read the 5 core files before starting ANY task to ensure continuity and prevent any duplicate work.

#### **4.3. Documentation Standards**

*   **Working Documentation (`/docs/`)**
    *   **API Documentation:** A concise FastAPI endpoint reference (Swagger-style).
    *   **Database Schema:** The current Supabase state, via MCP inspection only.
    *   **Setup Guides:** Guides for setting up the development environment and tools.
    *   **NO HALLUCINATION:** Only document actual, verified implementations.

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
    uvicorn main:app --reload --port 8000

    # Frontend
    cd frontend
    npm start         # Start development server with CRACO
    ```

*   **Building and Testing**
    ```bash
    # Backend
    cd backend
    python -m pytest tests/                    # Run backend tests
    python -m pytest tests/ -v --cov=.        # Run with coverage
    python -m pylint *.py                     # Lint Python code
    uvicorn main:app --reload --port 8000     # Test server startup

    # Frontend
    cd frontend
    npm run build     # TypeScript check and production build
    npm run test      # Run frontend tests (Jest via CRACO)
    npm run lint      # Run ESLint (if configured)
    npm start         # Test development server startup

    # Integration Testing
    # Test full upload → process → analyze → visualize flow
    # Test with sample C3D files from different sources
    # Test EMG signal processing accuracy
    ```

#### **5.2. MCP Servers Configuration**

*   ✅ **Configured and Active:**
    *   **Context7** - For documentation lookup (`claude mcp list` to verify).
    *   **Sequential** - For complex multi-step analysis and structured thinking.
    *   **Supabase** - For database operations with an access token.
    *   **Playwright** - For browser automation & E2E testing.
    *   **Perplexity** - For AI-powered web search.
    *   **Shadcn-ui**
    *   **Serena**


#### **5.3. 🧱 Code Structure & Modularity**

*   **File and Function Limits**
    *   A file should never be longer than 500 lines of code. If it is approaching this limit, it should be refactored by splitting it into modules.
    *   Functions should be under 50 lines and have a single, clear responsibility.
    *   Classes should be under 100 lines and represent a single concept or entity.
    *   Code should be organized into clearly separated modules, grouped by feature or responsibility.

### **6. Project Status and Roadmap**


#### **6.2. Latest Update: Configurable Data Retrieval System ✅ (July 31, 2025)**

*   **Status:** PRODUCTION READY - This system provides consistent data resolution across all components.
*   It features a unified Patient ID/Session Date resolution with a priority-based configuration.
*   It is built with SOLID engineering patterns and self-documenting configuration headers.
*   It includes a Storage subfolder (highest) → C3D metadata (fallback) priority system.
*   It has robust TypeScript support with comprehensive logging and error handling.





