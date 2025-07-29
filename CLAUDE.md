# EMG C3D Analyzer - Claude Development Context

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

**Memory Bank Structure**:
- `projectbrief.md` - Foundation document (project scope and requirements)
- `productContext.md` - Why this project exists and how it should work
- `activeContext.md` - Current work focus and recent changes
- `systemPatterns.md` - System architecture and design patterns
- `techContext.md` - Technologies used and development setup
- `progress.md` - What works, what's left to build, current status

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

## Project Overview
GHOSTLY+ EMG C3D Analyzer - A rehabilitation technology platform that processes C3D files from the GHOSTLY game to extract and analyze EMG (Electromyography) data for therapeutic assessment.

## Current Architecture
- **Backend**: FastAPI with Python, processes C3D files, calculates EMG metrics
- **Frontend**: React/TypeScript with Recharts for visualization
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

## Latest Update: Supabase Authentication System Fixes ✅ (July 29, 2025)
**Status**: PRODUCTION READY - Complete authentication flow with proper login/logout functionality
**Final Achievement**: 
- ✅ Fixed infinite re-render loops in authentication hooks and components
- ✅ Resolved login blocking issue preventing user authentication
- ✅ Implemented proper Supabase logout flow following official best practices
- ✅ Automatic redirect to login page on logout without page refresh
- ✅ Persistent auth state listener handling both SIGNED_IN and SIGNED_OUT events
- ✅ Clean separation of concerns between Supabase auth and React UI state
- ✅ Eliminated excessive debug logging causing performance issues
- ✅ Enhanced error handling and state management reliability

**Technical Architecture**: Standard Supabase React authentication pattern with persistent `onAuthStateChange` listener. Logout flow: `supabase.auth.signOut()` → `SIGNED_OUT` event → auth state update → AuthGuard → LoginPage redirect. Login state management uses forced state updates to bypass stability protection during authentication flow.

**Critical Authentication Flow**: 
1. **Login**: Reset stable state → force loading state → call Supabase → handle response → mark stable
2. **Logout**: Call `supabase.auth.signOut()` → Supabase triggers `SIGNED_OUT` → listener updates state → automatic redirect
3. **State Persistence**: Auth listener remains active throughout app lifecycle for reliable event handling

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