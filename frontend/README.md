# GHOSTLY+ EMG C3D Analyzer - Frontend

This directory contains the React TypeScript frontend for the GHOSTLY+ EMG C3D Analyzer application. It provides an interactive interface for uploading C3D files, configuring analysis parameters, and visualizing EMG data with comprehensive analytics.

## Architecture

The frontend follows a **modern React architecture** with TypeScript, component-based design, and comprehensive state management optimized for EMG data visualization.

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

## Available Scripts

### Development
```bash
npm start          # Development server on localhost:3000
npm test           # Run test suite
npm run build      # Production build
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