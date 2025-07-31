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

## Latest Update: Authentication System Complete ✅ (July 30, 2025)
**Status**: PRODUCTION READY - Complete authentication system with perfect UX
**Final Achievement**: 
- ✅ Fixed logout loop with immediate state transition preventing infinite loading spinner
- ✅ Perfect UI centering for consistent loading experience across all screen sizes
- ✅ Download button functionality with authentication protection preserved
- ✅ Therapist ID filtering with metadata integration fully operational
- ✅ Singleton Context API implementation eliminating all initialization loops
- ✅ Optimized React patterns with stable useCallback references
- ✅ Clean logout flow with immediate redirect to login page
- ✅ Professional medical device UI standards maintained throughout

**Technical Fixes**: 
1. **Logout Loop**: Changed `setAuthState(loading: true)` to `setAuthState(createLoggedOutState())` for immediate transition
2. **Spinner Centering**: Enhanced AuthLoadingSpinner with `w-full flex items-center justify-center` and inner `flex flex-col items-center`
3. **State Management**: Preserved singleton AuthProvider pattern while fixing logout flow

**Architecture**: Complete Context API singleton pattern with immediate logout transitions, perfect centering, and responsive design for professional medical device standards.

**Previous Update: Supabase Authentication System ✅ (July 29, 2025)**
**Status**: COMPLETED - Complete authentication flow with proper login/logout functionality
- ✅ Fixed infinite re-render loops in authentication hooks and components
- ✅ Resolved login blocking issue preventing user authentication
- ✅ Implemented proper Supabase logout flow following official best practices
- ✅ Automatic redirect to login page on logout without page refresh
- ✅ Persistent auth state listener handling both SIGNED_IN and SIGNED_OUT events
- ✅ Clean separation of concerns between Supabase auth and React UI state
- ✅ Eliminated excessive debug logging causing performance issues
- ✅ Enhanced error handling and state management reliability

## Previous Update: Dynamic Thresholds & Game Metadata Resolution ✅ (July 25, 2025)
**Status**: PRODUCTION READY - Complete dynamic threshold system and robust game metadata integration
**Final Achievement**: 
- ✅ Dynamic threshold displays: Duration Rate (muscle-specific avg) and Intensity Rate (MVC avg)
- ✅ Game metadata data flow via component props: analysisResult → SettingsPanel → ScoringWeightsSettings
- ✅ Robust TypeScript handling for threshold calculations with proper type filtering
- ✅ Game Score Normalization always visible regardless of debug mode
- ✅ Color-coded performance weight sliders with component-specific colors (green/purple/orange/cyan)
- ✅ Professional medical device UI standards maintained throughout settings
- ✅ Complete LaTeX tooltip integration for performance equation terms
- ✅ Unified settings architecture with consistent icons and color schemes

**Technical Architecture**: Dynamic threshold calculation using `getAverageDurationThreshold()` and `getAverageMvcThreshold()` functions with muscle-specific parameters. Game metadata flows through React component props chain (game-session-tabs → SettingsPanel → ScoringWeightsSettings) using `analysisResult?.metadata` pattern, matching successful GHOSTLYGameCard implementation.

**Critical Data Flow Patterns**: 
1. **Dynamic Thresholds**: `sessionParams.session_duration_thresholds_per_muscle` → averaged → displayed as "≥{avg}s"
2. **Game Metadata**: `analysisResult.metadata.{score,level}` → props chain → Settings display (no Zustand dependency)
3. **Performance Scoring**: Component-specific slider colors match equation variables for visual consistency

## Previous Update: Enhanced Performance System with BFR Configuration ✅ (July 18, 2025)
**Status**: PRODUCTION READY - Complete performance scoring with configurable BFR monitoring
**Technical Architecture**: React/TypeScript with Zustand state management, interactive equation components, configurable therapeutic parameters, and consistent UI patterns. System enables clinical customization while maintaining safety standards and professional medical device compliance.

## Previous Update: BFR Monitoring System Complete ✅ (July 17, 2025)
**Status**: PRODUCTION READY - Complete BFR monitoring with clinical safety compliance
**Technical Architecture**: Clean React/TypeScript components with Zustand state management, real-time compliance calculation, and professional medical device UI standards. System provides at-a-glance safety monitoring through tab indicators and detailed monitoring through dedicated BFR tab.

## Previous Update: Contraction Visualization System Complete ✅ (July 17, 2025)
**Status**: PRODUCTION READY - Full contraction visualization with interactive controls
**Technical Architecture**: ComposedChart with XAxis type="number" for decimal time coordinates, memoized contraction processing, and efficient rendering with proper component layering. Toggle controls provide independent visibility control over visualization elements.

## Testing Strategy
- Preserve existing functionality during refactoring
- Validate with sample C3D files
- Ensure clinical metrics remain accurate
- Test cross-browser compatibility

## Deployment Target
- Render free tier compatibility
- Minimal resource usage
- Fast startup and processing

## Clinical EMG Standards & Reference Ranges

### Signal Quality Requirements
- **Sampling Rate**: ≥1000 Hz (preferably 2000 Hz) for surface EMG
- **Bandwidth**: 20-500 Hz for surface EMG, 20-2000 Hz for intramuscular
- **Amplitude Range**: 50-2000 µV for surface EMG (muscle-dependent)
- **Noise Floor**: <5 µV RMS for clinical-grade measurements

### Clinical Reference Ranges
```
Time Domain Metrics:
- RMS: 50-500 µV (healthy muscle activation)
- MAV: 30-300 µV (typically 60-80% of RMS value)
- Peak Amplitude: 100-2000 µV (muscle-dependent)

Frequency Domain Metrics:
- MPF (Mean Power Frequency): 80-150 Hz (healthy muscle)
- MDF (Median Frequency): 60-120 Hz (shifts lower with fatigue)
- Spectral Bandwidth: 20-250 Hz (95% power content)

Fatigue Indicators:
- Fatigue Index: -0.1 to -0.5 Hz/s (MPF/MDF slope)
- Amplitude Increase: 10-30% during sustained contraction
- Spectral Compression: 15-25% frequency shift
```

### Biomedical Signal Processing Standards
- **Filtering**: 4th-order Butterworth bandpass (20-500 Hz)
- **Windowing**: Hamming window for spectral analysis
- **Overlap**: 50% for time-frequency analysis
- **Epoch Length**: 250ms for stationary analysis, 1-2s for fatigue assessment

### Clinical Validation Requirements
- **Reproducibility**: <10% coefficient of variation for repeated measures
- **Sensitivity**: Detect 15% changes in muscle activation
- **Specificity**: Distinguish between muscle groups and activation patterns
- **Temporal Resolution**: 50ms for dynamic movement analysis
