---
sidebar_position: 1
title: React Architecture
---

# React Architecture

The frontend uses React 19 with TypeScript for type safety and modern component patterns.

## Technology Stack

- **React 19**: Latest concurrent features
- **TypeScript**: Strict mode for type safety
- **Zustand**: Lightweight state management
- **Recharts**: Data visualization
- **Tailwind CSS**: Utility-first styling
- **Shadcn/ui**: Component library

## Component Architecture

### Directory Structure

```
frontend/src/
├── components/      # Reusable UI components
│   ├── tabs/       # Tab-based interface
│   ├── charts/     # Visualization components
│   └── ui/         # Base UI components
├── hooks/          # Custom React hooks
├── store/          # Zustand state stores
├── services/       # API integration
└── config/         # Configuration files
```

## State Management

### Zustand Store Architecture

```typescript
interface SessionStore {
  // Session data
  sessionData: SessionData | null;
  
  // Processing state
  isProcessing: boolean;
  
  // Actions
  setSessionData: (data: SessionData) => void;
  resetSession: () => void;
}
```

## Performance Optimization

### Key Strategies

1. **React.memo** for expensive components
2. **useMemo** for complex calculations
3. **Lazy loading** for code splitting
4. **Virtual scrolling** for large datasets
5. **Debouncing** for user inputs

## Data Visualization

### EMG Plot Component

The EMG visualization uses Recharts with:
- Real-time data updates
- Downsampling for large datasets (175.1s at 990Hz)
- Interactive zoom/pan
- Contraction highlighting

## Custom Hooks

### Key Business Logic Hooks

- `usePerformanceMetrics` - Calculate performance scores
- `useContractionAnalysis` - Analyze contractions
- `useSessionManagement` - Handle session lifecycle
- `useAuth` - Authentication state

## Next Steps

- [Zustand State Management](./zustand-state)
- [Data Visualization](./data-visualization)
- [Component Patterns](./component-patterns)