# System Patterns

## Architecture Overview

### Core Components
1. FastAPI Application (`c3d_api.py`)
   - REST API endpoints
   - File handling
   - Request validation
   - Response serialization

2. C3D Processor (`c3d_processor.py`)
   - EMG data extraction
   - Signal processing
   - Contraction detection
   - Analytics calculation

3. Data Models (`models.py`)
   - Pydantic models
   - Data validation
   - Type definitions
   - Default configurations

4. Frontend Application (React/TypeScript)
   - User Interface components (e.g., `game-session-tabs.tsx`)
   - Interaction logic
   - API communication
   - UI components sourced from `shadcn/ui`

### Directory Structure
```
emg-c3d-analyzer/
├── data/
│   ├── uploads/    # Uploaded C3D files
│   ├── results/    # Analysis results
│   └── plots/      # Generated visualizations
├── frontend/       # Frontend components (React, TypeScript, shadcn/ui)
│   ├── src/
│   │   ├── components/
│   │   │   ├── app/      # Application-specific reusable components
│   │   │   ├── sessions/ # Components related to game session display
│   │   │   └── ui/       # shadcn/ui components (e.g., button.tsx, card.tsx)
│   │   ├── types/      # TypeScript type definitions for frontend
│   │   ├── App.tsx     # Main application component
│   │   └── main.tsx    # Frontend entry point
├── c3d_api.py     # FastAPI application
├── c3d_processor.py # EMG processing logic
├── models.py      # Data models
├── main.py        # Application entry point
└── pyproject.toml # Project configuration
```

## Design Patterns

### API Design
- RESTful endpoints
- Clear resource hierarchy
- Consistent error handling
- Proper HTTP method usage
- Standardized response formats

### Data Processing
- Pipeline architecture
- Modular processing steps
- Configurable parameters
- Caching of results
- Error recovery

### Frontend Development Patterns
- Component-based architecture (React).
- UI components primarily from `shadcn/ui`, added via CLI (e.g., `npx shadcn-ui@latest add <component-name>`).
- Components are typically located in `frontend/src/components/ui/`.
- Imports from sibling directories (e.g., from `frontend/src/components/sessions/` to `frontend/src/components/ui/`) use relative paths (e.g., `../ui/<component-name>`).
- Path aliases (e.g., `@/`) are not currently configured for frontend imports; relative paths are used instead.
- Custom React Hooks for State Management and Side Effects:
  - Logic related to specific concerns (e.g., data fetching, channel management, game session data) is encapsulated within custom hooks in `frontend/src/hooks/`.
  - This pattern promotes separation of concerns, reusability, and makes components cleaner.
  - Examples:
    - `useDataDownsampling`: Manages data point selection for charts and the downsampling algorithm.
    - `useChannelManagement`: Handles selection and availability of EMG channels for plotting.
    - `useEmgDataFetching`: Manages fetching raw EMG data for main plots and calculating primary statistics.
    - `useGameSessionData`: Derives game session objects and fetches/manages data specific to session tabs.

### File Management
- Unique file identification
- Organized directory structure
- Cleanup procedures
- Storage optimization
- Access control

## Component Relationships

### Data Flow
1. File Upload → Storage
2. Storage → Processing
3. Processing → Analysis
4. Analysis → Visualization
5. Visualization → Storage
6. Storage → API Access

### Dependencies
- FastAPI ← Pydantic Models
- C3D Processor ← EMG Analysis
- API ← File Storage
- Visualization ← Analysis Results

## Technical Patterns

### Error Handling
- Consistent error types
- Detailed error messages
- Error recovery procedures
- Logging and monitoring
- User feedback

### Performance Optimization
- Async operations
- Result caching
- Efficient file handling
- Memory management
- Resource cleanup

### Security
- Input validation
- File type checking
- Size limitations
- Access control
- Data protection

## Testing Patterns
- Unit tests for components
- Integration tests for API
- Performance benchmarks
- Error case validation
- Security testing 