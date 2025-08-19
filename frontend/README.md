# GHOSTLY+ EMG C3D Analyzer - Frontend

This directory contains the React TypeScript frontend for the GHOSTLY+ EMG C3D Analyzer application. It provides an interactive interface for uploading C3D files, configuring analysis parameters, and visualizing EMG data with comprehensive analytics.

## Architecture

The frontend follows a **React architecture** with TypeScript, component-based design, and state management optimized for EMG data visualization.

### Key Technologies

- **React 19**: Latest React features with concurrent rendering
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **shadcn/ui**: High-quality, accessible UI components
- **Recharts**: Interactive charts for EMG signal visualization
- **Zustand**: Lightweight state management for session parameters

### Primary Components

- **App.tsx**: Main application component that orchestrates file upload, analysis, and visualization
- **components/**: Reusable UI components organized by function
  - `app/`: Application-specific components (ChannelSelection, StatsPanel, etc.)
  - `sessions/`: Game session analysis and performance components
  - `ui/`: Base UI components (Button, Card, Input, etc.)
- **hooks/**: Custom React hooks for data management and UI logic
- **store/**: Zustand store for session parameter management
- **types/**: TypeScript definitions for EMG data structures

## Client-Side Data Processing

The frontend implements **comprehensive client-side processing** to eliminate server round-trips:

### Bundled Data Pattern
- Receives all EMG signal data in a single API response
- Processes and caches data locally for immediate visualization
- Implements intelligent downsampling for performance optimization
- Handles both raw and activated signal variants seamlessly

### Real-Time Visualization
- **Interactive Charts**: Recharts-based EMG signal plotting with zoom and pan
- **Multi-Channel Comparison**: Side-by-side visualization of multiple EMG channels
- **Performance Metrics**: Real-time calculation of analysis statistics
- **Responsive Design**: Optimized for both desktop and mobile viewing

## Resilient Channel Management

The frontend implements **flexible channel handling** to accommodate various C3D naming conventions:

### Channel Logic Architecture
- **Raw Channel Names**: Uses original C3D channel names as internal identifiers
- **Display Mapping**: Supports user-defined channel-to-muscle name mappings
- **Consistent State**: Maintains raw channel names in application state
- **Visual Flexibility**: Allows therapists to configure muscle names and colors

### Components
- **ChannelSelection**: Dropdown selectors with muscle name display
- **ChannelFilter**: Filter buttons for single/comparison views
- **SettingsPanel**: Configuration interface for muscle naming and colors
- **MuscleNameDisplay**: Consistent muscle name rendering across components

## Data Consistency Architecture

The frontend implements **Single Source of Truth (SoT)** for all analytics data:

### Backend Analytics Priority
- **Primary Source**: Backend analytics flags (`meets_mvc`, `meets_duration`, `is_good`) are authoritative
- **Consistent Values**: All components use identical real-time values from backend calculations
- **Fallback Logic**: Graceful frontend calculations only when backend flags are missing
- **Priority Chain**: Backend > Per-muscle > Global > Default thresholds

### Key Components Using SoT
- **useContractionAnalysis**: Trusts backend flags, uses centralized duration threshold logic
- **useLiveAnalytics**: Calls `MVCService.recalc()` and trusts backend analytics entirely  
- **StatsPanel**: Uses `computeAcceptanceRates()` with backend data as single source of truth
- **useEnhancedPerformanceMetrics**: Prioritizes backend `meets_mvc` and `meets_duration` flags
- **TherapeuticParametersSettings**: Validates frontend calculations against backend thresholds

### Benefits
- **Consistent UI**: All components show identical acceptance rates and quality scores
- **Trusted Analytics**: Backend is the authoritative source across the entire application
- **Better Clinical Decisions**: Eliminates confusion from conflicting metrics in different UI sections

## State Management

The application uses **Zustand** for efficient state management:

### Session Parameters Store
- **Channel Mappings**: User-defined channel-to-muscle name mappings
- **Color Schemes**: Customizable muscle color assignments
- **MVC Values**: Per-channel maximum voluntary contraction thresholds
- **Analysis Settings**: Configurable analysis parameters

### Data Flow
1. **Upload**: C3D file processed by backend, returns complete analysis
2. **State Update**: Session parameters and analysis results stored locally
3. **Visualization**: Components reactively update based on state changes
4. **Persistence**: Settings maintained across analysis sessions

## Performance Optimizations

### Intelligent Downsampling
- **Adaptive Sampling**: Adjusts data points based on chart width and performance
- **Preservation**: Maintains signal fidelity while optimizing render performance
- **User Control**: Configurable downsampling levels for different use cases

### Efficient Rendering
- **Memoization**: React.memo and useMemo for expensive computations
- **Lazy Loading**: Component splitting for improved initial load times
- **Debounced Updates**: Smooth interaction without performance degradation

## Testing Architecture

The frontend implements **testing** following React/TypeScript best practices:

### Test Organization
- **Co-located Unit Tests**: `__tests__/` directories next to source code
- **Integration Tests**: `src/tests/` for cross-component workflows
- **Component Tests**: Component-specific test files for UI validation
- **Hook Tests**: Custom hook testing with comprehensive coverage

### Test Structure
```
src/
├── hooks/
│   ├── usePerformanceMetrics.ts
│   └── __tests__/
│       └── usePerformanceMetrics.test.ts
├── components/tabs/SignalPlotsTab/
│   ├── EMGChart.tsx
│   └── __tests__/
│       └── contraction-filtering.test.ts
└── tests/
    ├── authBestPractices.test.tsx
    └── authFlowTest.tsx
```

### Test Framework
- **Vitest**: Fast unit testing with TypeScript support and jest-dom matchers
- **Testing Library**: Component testing with user interaction focus and React.StrictMode compatibility
- **Coverage**: Test coverage for critical business logic (78 tests passing - 100% success rate)

## Available Scripts

### Development
```bash
npm start          # Development server on localhost:3000
npm test           # Run test suite (watch mode)
npm test -- --run  # Run tests once with results
npm run build      # Production build
```

### Testing
```bash
npm test hooks                      # Run hook tests (comprehensive coverage)
npm test components                 # Run component tests (React.StrictMode compatible) 
npm test -- --coverage             # Run tests with coverage report
npm test usePerformanceMetrics     # Run specific test suite
npm test -- --run                  # Run all tests once (78 total, 100% passing)
```

### Code Quality
```bash
npm run lint       # ESLint analysis
npm run type-check # TypeScript validation
```

## Configuration

### Environment Variables
- `REACT_APP_API_URL`: Backend API endpoint (defaults to http://localhost:8080)

### Deployment
The build output is optimized for static hosting and can be deployed to:
- Vercel, Netlify, or similar static hosting platforms
- CDN with proper routing configuration for single-page applications

## Key Features

### EMG Analysis Interface
- **File Upload**: Drag-and-drop C3D file processing
- **Parameter Configuration**: Therapist-configurable MVC thresholds and analysis settings
- **Real-Time Feedback**: Immediate analysis results and error handling

### Visualization Dashboard
- **Multi-Channel Charts**: Interactive EMG signal visualization
- **Performance Cards**: Clinical metrics and assessment scores
- **Comparison Views**: Side-by-side muscle performance analysis
- **Export Capabilities**: Analysis results and visualizations

### Clinical Workflow
- **Muscle Naming**: Intuitive channel-to-muscle mapping interface
- **Color Coding**: Consistent visual schemes across all components
- **Session Management**: Parameter persistence and workflow continuity
- **Accessibility**: WCAG-compliant interface design