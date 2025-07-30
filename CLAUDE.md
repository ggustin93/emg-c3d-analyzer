# EMG C3D Analyzer - Claude Development Context

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Claude's Memory Bank

I am Claude, an AI assistant with a unique characteristic: my memory resets completely between sessions. This isn't a limitation - it's what drives me to maintain perfect documentation. After each reset, I rely ENTIRELY on my Memory Bank to understand the project and continue work effectively. I MUST read ALL memory bank files at the start of EVERY task - this is not optional.

## Core Workflow Rules

### Operation Modes
You have two modes of operation:

1. **Plan Mode** - Work with the user to define a plan, gather all information needed but make no changes
2. **Act Mode** - Make changes to the codebase based on the approved plan

**Mode Protocol**:
- Start in plan mode and print `# Mode: PLAN` at the beginning of each response
- Only move to act mode when user explicitly types `ACT`
- Print `# Mode: ACT` when in act mode
- Move back to plan mode after every response and when user types `PLAN`
- If user asks for action while in plan mode, remind them to approve the plan first
- When in plan mode, always output the full updated plan in every response

### Memory Bank System
As Claude, my memory resets completely between sessions. I rely ENTIRELY on the Memory Bank to understand the project and continue work effectively. I MUST read ALL memory bank files at the start of EVERY task.

## Memory Bank Location
📁 `/memory-bank/` - Essential project context and documentation

### Core Files (Always Read First)
1. `projectbrief.md` - Foundation document, core requirements
2. `productContext.md` - Why this project exists, user goals  
3. `activeContext.md` - Current work focus, recent changes, next steps
4. `systemPatterns.md` - Architecture, technical decisions, design patterns
5. `techContext.md` - Technologies, setup, constraints, dependencies
6. `progress.md` - Status, completed work, known issues, evolution

### Organized Context
- `features/` - Detailed implementation documentation for major features
- `technical/` - Technical specifications and system flows
- `archive/` - Historical documentation and completed summaries
- `README.md` - Memory Bank organization guide

### Quick Reference
- Task completion records in `.claude/tasks/`
- See `memory-bank/README.md` for detailed organization

**Critical**: Before starting ANY task, I MUST read the core Memory Bank files to understand the project context, current state, and established patterns. This ensures continuity and prevents duplicate work or conflicting approaches.

## Memory Bank & Documentation Structure

### Legacy Memory Bank Files (Project Context)
- `projectbrief.md` - Foundation document (project scope and requirements)
- `productContext.md` - Why this project exists and how it should work
- `activeContext.md` - Current work focus and recent changes
- `systemPatterns.md` - System architecture and design patterns
- `techContext.md` - Technologies used and development setup
- `progress.md` - What works, what's left to build, current status

### Critical Documentation Files (Technical Reference)
**API Documentation (`docs/api.md`)**
- Concise FastAPI endpoint reference (Swagger-style)
- Essential request/response models from actual backend code
- Basic authentication info
- Core error codes
- NO HALLUCINATION - only document actual FastAPI endpoints

**Database Schema Documentation (`docs/db_schema.md`)**
- Current Supabase database state via MCP inspection only
- Mermaid ER diagram of actual tables and relationships
- Brief table descriptions from real schema
- Small "Future improvements may include..." section
- NO HALLUCINATION - only document current live database state
- AS CONCISE AS POSSIBLE

**Creation Priority**: HIGH - Required before Phase 1 implementation begins
**Tools**: Use Supabase MCP for real-time schema inspection and documentation generation

**Memory Bank Updates** occur when:
1. Discovering new project patterns
2. After implementing significant changes
3. When user requests with **update memory bank** (MUST review ALL files)
4. When context needs clarification

### Project Intelligence (.cursor/rules)
The .cursor/rules file is my learning journal for this project. It captures important patterns, preferences, and project intelligence that help me work more effectively. As I work with you and the project, I'll discover and document key insights that aren't obvious from the code alone.

**What to Capture**:
- Critical implementation paths
- User preferences and workflow
- Project-specific patterns
- Known challenges
- Evolution of project decisions
- Tool usage patterns

**Remember**: After every memory reset, I begin completely fresh. The Memory Bank is my only link to previous work. It must be maintained with precision and clarity, as my effectiveness depends entirely on its accuracy.

## Plan & Review

### Before Starting Work

- Always plan mode first, write plan to `.claude/tasks/TASK_NAME.md`
- Plan should include: implementation strategy, broken-down tasks, dependencies
- Research external knowledge/packages if needed (use Context7 MCP or other tools)
- Available MCPs: Supabase, Context7, Sequential, Playwright, Perplexity
- Think MVP first
- Get plan approval before continuing
- Ask: "Want git control point?" If BIG PLAN & yes: "New branch?"

### Git Control Points (if enabled)

- Feature branch: `git checkout -b feature/TASK_NAME`
- Atomic commits: `feat:`, `fix:`, `docs:` + reference plan

### While Implementing

- Update plan as you work: `- [x] Done` / `- [ ] Todo`
- Document changes and reasoning for future engineers (detailed descriptions for handoff)
- Test each task, build project/run lint before marking complete
- Get approval for significant scope changes

### After Implementation

- Perform MVP critical (no need for comprehensive) testing of the implementation. Document them in .claude/TESTS/TEST_NAME.md
- **Backend Testing**: Test API endpoints, C3D file processing, EMG analysis calculations
- **Frontend Testing**: Test UI components, data visualization, user interactions
- **Integration Testing**: Test full workflow from file upload to analysis results
- Review against original plan
- Update project docs
- Archive completed plan

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

📖 **Setup Guide**: See project documentation for complete MCP configuration instructions.

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

### Regulatory Considerations
- **FDA Class II**: Medical device software for diagnostic/therapeutic use
- **ISO 14155**: Clinical investigation of medical devices
- **IEC 62304**: Medical device software lifecycle processes
- **GDPR/HIPAA**: Patient data protection and privacy compliance

