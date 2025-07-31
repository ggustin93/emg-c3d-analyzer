# EMG C3D Analyzer - Claude Development Context

## 🚨 CRITICAL: START HERE - MODE PROTOCOL
**EVERY TASK MUST BEGIN IN PLAN MODE**

### # Mode: PLAN (Always start here)
- **NEVER start implementing immediately**
- Create detailed plan first in `memory-bank/tasks/TASK_NAME.md`
- Get explicit user approval with "ACT" command
- Return to PLAN mode after every response

### Mode Rules:
- **Start**: `# Mode: PLAN` at beginning of EVERY response
- **Transition**: Only when user explicitly types `ACT`
- **Return**: Back to PLAN mode after every implementation response
- **Reminder**: If user asks for action in plan mode, remind them to approve plan first
- **Planning**: Always output the full updated plan in every planning response

## 🧠 MANDATORY: READ MEMORY BANK FIRST
**BEFORE ANY TASK - READ ALL 5 CORE FILES:**
1. `projectbrief.md` - What this project is (foundation)
2. `activeContext.md` - Current status & recent work
3. `progress.md` - What's completed
4. `systemPatterns.md` - How the system works (architecture)
5. `techContext.md` - Tech stack & development setup

**NO EXCEPTIONS - THIS IS NOT OPTIONAL**

Memory resets completely between sessions. The Memory Bank is your ONLY link to previous work.

## ✅ MANDATORY WORKFLOW CHECKLIST

### Before Starting ANY Task:
- [ ] Read all 5 memory bank files
- [ ] Start with `# Mode: PLAN`
- [ ] Create plan in `memory-bank/tasks/TASK_NAME.md`
- [ ] Include: implementation strategy, broken-down tasks, dependencies
- [ ] Research external knowledge/packages if needed (Context7 MCP)
- [ ] Think MVP first
- [ ] Get user approval
- [ ] Ask: "Want git control point?" If BIG PLAN & yes: "New branch?"

### During Implementation (Only after user types ACT):
- [ ] Print `# Mode: ACT` when implementing
- [ ] Update plan as you work: `- [x] Done` / `- [ ] Todo`
- [ ] Document changes and reasoning for future engineers
- [ ] Test each task, build project/run lint before marking complete
- [ ] Get approval for significant scope changes

### After Completion:
- [ ] Perform MVP critical testing of the implementation
- [ ] Document tests in `memory-bank/tests/TEST_NAME.md`
- [ ] **Backend Testing**: Test API endpoints, C3D file processing, EMG analysis
- [ ] **Frontend Testing**: Test UI components, data visualization, user interactions
- [ ] **Integration Testing**: Test full workflow from upload to analysis
- [ ] Review against original plan
- [ ] Update project docs if requested
- [ ] Archive completed plan
- [ ] Return to `# Mode: PLAN`

## **MINIMALIST DOCUMENTATION ARCHITECTURE**

The project follows a **2-Layer Documentation Strategy** (Git provides archival):

### **📁 `/memory-bank/` - Claude Session Context**
**🧠 ALWAYS READ THESE 5 CORE FILES FIRST:**
1. `projectbrief.md` - What this project is (foundation)
2. `activeContext.md` - Current status & recent work
3. `progress.md` - What's completed
4. `systemPatterns.md` - How the system works (architecture)
5. `techContext.md` - Tech stack & development setup

**📋 Reference Documents:**
- `productContext.md` - Why this project exists
- `metricsDefinitions.md` - EMG analysis definitions

**📁 Organized Context:**
- `future-work/` - Planned features
- `research/` - Active investigations  
- `archived/` - Historical context & completed features

### **📁 `/docs/` - Working Technical Documentation**
**For Developers RIGHT NOW:**
- `README.md` - Quick start guide
- `api.md` - FastAPI endpoint reference
- `supabase_client.md` - Supabase client methods and authentication patterns
- `db_schema.md` - Database schema
- `setup/` - Development environment setup

### **Git-Based Archival**
**Historical context preserved through:**
- Git commit history and branches
- `/memory-bank/archived/` for important context

**Critical**: The memory bank is your ONLY link to previous work. Read the 5 core files before starting ANY task to ensure continuity and prevent duplicate work.

## **Documentation Standards**

### **Working Documentation (`/docs/`)**
- **API Documentation**: Concise FastAPI endpoint reference (Swagger-style)
- **Database Schema**: Current Supabase state via MCP inspection only
- **Setup Guides**: Development environment and tool configuration
- **NO HALLUCINATION**: Only document actual, verified implementations

### **Memory Bank Updates**
Update memory bank when:
1. Discovering new project patterns
2. After implementing significant changes  
3. When user requests **"update memory bank"** (MUST review ALL files)
4. When context needs clarification

### **Project Intelligence**
The `.cursor/rules` file captures important patterns and insights:
- Critical implementation paths
- User preferences and workflow patterns
- Project-specific technical decisions
- Known challenges and solutions
- Evolution of architectural decisions

**Remember**: After every memory reset, the Memory Bank is your ONLY link to previous work. It must be maintained with precision and clarity.

### Git Control Points (if enabled)

- Feature branch: `git checkout -b feature/TASK_NAME`
- Atomic commits: `feat:`, `fix:`, `docs:` + reference plan

### Known Issues & Solutions

1. **Authentication Loading Loop** - Fixed infinite "Waiting for authentication to initialize..." loop
2. **C3D File Processing** - Backend must handle various C3D channel naming conventions
3. **EMG Signal Quality** - Ensure proper filtering and noise floor requirements
4. **Stateless Architecture** - Process data on-demand without persistent file storage
5. **Clinical Standards** - Maintain FDA Class II medical device compliance

## MCP Servers Configuration

✅ **Configured and Active**:
- **Context7** - Documentation lookup (`claude mcp list` to verify)
- **Sequential** - Complex multi-step analysis and structured thinking
- **Supabase** - Database operations with access token
- **Playwright** - Browser automation & E2E testing
- **Perplexity** - AI-powered web search

📖 **Setup Guide**: See [`docs/setup/mcp-setup.md`](./docs/setup/mcp-setup.md) for complete MCP configuration instructions.

## Development Commands

### Running the Application
```bash
# Backend
cd backend
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm start         # Start development server with CRACO
```

### Building and Testing
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

## Project Overview
GHOSTLY+ EMG C3D Analyzer - A rehabilitation technology platform that processes C3D files from the GHOSTLY game to extract and analyze EMG (Electromyography) data for therapeutic assessment.

## Current Architecture
- **Backend**: FastAPI with Python, processes C3D files, calculates EMG metrics
- **Frontend**: React/TypeScript with CRACO build system, Recharts for visualization
- **State Management**: Zustand for session parameters
- **Data Flow**: Upload → Process → Analyze → Visualize

## Development Guidelines
- **No Breaking UI Changes**: Maintain current user experience
- **Stateless Backend**: Process data on-demand without persistent file storage
- **Clarity First**: Prioritize code readability and maintainability
- **Clinical Relevance**: Focus on medically meaningful EMG analysis

## Key Technical Decisions
1. **Client-Side Plotting**: All visualization handled by React/Recharts
2. **Bundled Response**: Single API response contains all necessary data
3. **Flexible Channel Handling**: Robust to different C3D channel naming
4. **Advanced EMG Analysis**: Comprehensive biomedical metrics with clinical documentation

## Current Phase: Implementation
Working through todo.md tasks to refactor for:
- Backend streamlining (remove server-side plotting)
- Stateless architecture (bundled signal data)
- Enhanced EMG analysis integration
- Improved frontend chart capabilities

## Latest Update: Configurable Data Retrieval System ✅ (July 31, 2025)
**Status**: PRODUCTION READY - Consistent data resolution across components
- Unified Patient ID/Session Date resolution with priority-based configuration
- SOLID engineering patterns with self-documenting configuration headers
- Storage subfolder (highest) → C3D metadata (fallback) priority system
- Robust TypeScript support with comprehensive logging and error handling

## Recent Updates:

### Authentication System ✅ (July 30, 2025)  
**Status**: PRODUCTION READY - Complete authentication with perfect UX
- Fixed logout loops with immediate state transitions
- Singleton Context API eliminating initialization loops
- Professional medical device UI standards maintained

### Dynamic Thresholds & Game Metadata ✅ (July 25, 2025)
**Status**: PRODUCTION READY - Complete dynamic threshold system  
- Game metadata integration via component props chain
- LaTeX tooltip integration for performance equations
- Color-coded performance weight sliders with visual consistency

### Performance & BFR Systems ✅ (July 17-18, 2025)
**Status**: PRODUCTION READY - Complete clinical monitoring systems
- BFR monitoring with clinical safety compliance and real-time validation
- Interactive performance scoring with configurable therapeutic parameters
- Contraction visualization with memoized processing and toggle controls