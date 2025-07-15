# EMG C3D Analyzer - Claude Development Context

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

## Testing Strategy
- Preserve existing functionality during refactoring
- Validate with sample C3D files
- Ensure clinical metrics remain accurate
- Test cross-browser compatibility

## Deployment Target
- Render free tier compatibility
- Minimal resource usage
- Fast startup and processing