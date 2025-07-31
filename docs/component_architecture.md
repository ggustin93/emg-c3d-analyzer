# Component Architecture

React/TypeScript frontend component organization, patterns, and relationships.

## Architecture Overview

```
App (AuthProvider wrapper)
├── AuthGuard (authentication boundary)
│   ├── SessionLoader (file selection state)
│   └── GameSessionTabs (analysis state)
│       ├── Signal Plots Tab
│       ├── Analytics Tab  
│       ├── Performance Tab
│       ├── BFR Monitoring Tab
│       └── Settings Tab
```

## Core State Management

### Zustand Store (Global State)
```typescript
// store/sessionStore.ts - Single source of truth
interface SessionState {
  // Analysis data
  analysisResult: EMGAnalysisResult | null
  
  // User configuration
  sessionParams: GameSessionParameters
  
  // UI state
  selectedChannel: string | null
  viewMode: 'single' | 'comparison'
  
  // Actions
  setAnalysisResult: (result: EMGAnalysisResult | null) => void
  updateSessionParams: (params: Partial<GameSessionParameters>) => void
}
```

### Authentication Context
```typescript
// contexts/AuthContext.tsx - Singleton pattern
interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
}

// Single initialization prevents multiple auth instances
const isInitializedRef = useRef(false)
```

## Component Patterns

### 1. Container vs Presentational
```typescript
// Container: Handles data and state
const StatsPanel: React.FC = () => {
  const analytics = useLiveAnalytics(selectedChannel) // Data fetching
  const sessionParams = useSessionStore(state => state.sessionParams)
  
  return <StatsPanelPresentation analytics={analytics} params={sessionParams} />
}

// Presentational: Pure UI rendering
const StatsPanelPresentation: React.FC<Props> = ({ analytics, params }) => {
  return <div>{/* Pure UI based on props */}</div>
}
```

### 2. Custom Hook Pattern
```typescript
// hooks/useLiveAnalytics.ts - Encapsulated logic
export const useLiveAnalytics = (channelName: string) => {
  const { analysisResult, sessionParams } = useSessionStore()
  
  return useMemo(() => {
    // Complex calculations with reactive updates
    return recalculateAnalytics(analysisResult, sessionParams, channelName)
  }, [analysisResult, sessionParams, channelName])
}

// Component usage
const MyComponent = () => {
  const analytics = useLiveAnalytics('CH1') // Clean separation
  return <div>{analytics.rms}</div>
}
```

### 3. Compound Component Pattern
```typescript
// components/sessions/game-session-tabs.tsx
const GameSessionTabs = () => {
  return (
    <Tabs defaultValue="signal-plots">
      <TabsList>
        <TabsTrigger value="signal-plots">Signal Plots</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
      </TabsList>
      
      <TabsContent value="signal-plots">
        <EMGChart />
        <ChartControlHeader />
      </TabsContent>
      
      <TabsContent value="analytics">
        <StatsPanel />
        <MuscleComparisonTable />
      </TabsContent>
    </Tabs>
  )
}
```

## Component Hierarchy

### Authentication Layer
```typescript
// Top-level authentication boundary
App.tsx
├── AuthProvider (Context wrapper)
├── AuthGuard (Route protection)
│   ├── AuthLoadingSpinner (Loading states)
│   ├── LoginPage (Unauthenticated state)
│   └── AppContent (Authenticated content)
```

### Main Application Flow
```typescript
// Core application states
AppContent
├── SessionLoader (No analysis data)
│   ├── FileUpload (Local file upload)
│   ├── C3DFileBrowser (Supabase storage browser)
│   │   ├── QuickSelect (File filtering)
│   │   └── FileMetadataBar (File info display)
│   └── Header (App navigation)
└── GameSessionTabs (Analysis data loaded)
    ├── FileMetadataBar (File context)
    └── [Tab Content Components]
```

### Tab Content Architecture
```typescript
// Signal Plots Tab
SignalPlotsTab
├── EMGChart (Main visualization)
│   ├── ResponsiveContainer (Recharts wrapper)
│   ├── ComposedChart (Chart container)
│   ├── Line (Signal data)
│   ├── ReferenceLine (MVC threshold)
│   └── ReferenceArea (Contraction periods)
├── ChartControlHeader (Chart options)
│   ├── SignalTypeSwitch (Raw/RMS toggle)
│   ├── ChannelSelection (Channel picker)
│   └── ContractionVisualizationSettings (Display options)

// Analytics Tab  
AnalyticsTab
├── StatsPanel (Primary metrics)
│   ├── MetricCard (Individual metrics)
│   └── ChannelFilter (Channel selection)
├── MuscleComparisonTable (Side-by-side comparison)
└── DownsamplingControl (Performance settings)

// Performance Tab
PerformanceTab
├── OverallPerformanceCard (Global score)
├── MusclePerformanceCard (Per-muscle analysis)
├── MuscleSymmetryCard (L/R comparison)
├── SubjectiveFatigueCard (RPE display)
└── GHOSTLYGameCard (Game metadata)

// Settings Tab
SettingsTab
└── SettingsPanel (Configuration interface)
    ├── CollapsibleSettingsCard (Organized sections)
    ├── ChannelConfiguration (Muscle mapping)
    ├── TherapeuticParametersSettings (Clinical params)
    ├── BFRParametersSettings (BFR monitoring)
    ├── ScoringWeightsSettings (Performance weights)
    └── PatientOutcomesSettings (RPE configuration)
```

## State Flow Patterns

### 1. Unidirectional Data Flow
```typescript
// Props down, events up pattern
Parent Component (has state)
    ↓ (props)
Child Component (pure)
    ↑ (events/callbacks)
Parent Component (updates state)
```

### 2. Global State Updates
```typescript
// Zustand store updates trigger component re-renders
const updateMvcValue = (channel: string, value: number) => {
  updateSessionParams({
    session_mvc_values: {
      ...sessionParams.session_mvc_values,
      [channel]: value
    }
  })
  // All components consuming this data automatically re-render
}
```

### 3. Derived State Pattern
```typescript
// Computed values based on store state
const derivedAnalytics = useMemo(() => {
  if (!analysisResult || !sessionParams) return null
  
  return {
    goodContractions: calculateGoodContractions(analysisResult, sessionParams),
    performanceScore: calculatePerformanceScore(analysisResult, sessionParams)
  }
}, [analysisResult, sessionParams])
```

## UI Component Library

### Shadcn/UI Components
```typescript
// components/ui/ - Reusable UI primitives
├── button.tsx          // Button variants and sizes
├── card.tsx            // Content containers
├── tabs.tsx            // Tab navigation
├── slider.tsx          // Range inputs
├── badge.tsx           // Status indicators
├── tooltip.tsx         // Help text overlays
├── collapsible.tsx     // Expandable content
├── progress.tsx        // Progress indicators
└── clinical-tooltip.tsx // Medical-specific tooltips
```

### Custom Components
```typescript
// domain-specific components
├── EMGChart.tsx           // Main visualization component
├── MetricCard.tsx         // Individual metric display
├── MuscleNameDisplay.tsx  // Muscle identification
├── FileMetadataBar.tsx    // File context information
└── Spinner.tsx            // Loading states
```

## Component Communication

### 1. Props Interface Pattern
```typescript
// Well-defined component interfaces
interface EMGChartProps {
  channelName: string
  showRawSignal?: boolean
  showContractions?: boolean
  height?: number
}

const EMGChart: React.FC<EMGChartProps> = ({ 
  channelName, 
  showRawSignal = false,
  showContractions = true,
  height = 400 
}) => {
  // Component implementation
}
```

### 2. Event Handler Pattern
```typescript
// Consistent event handling
interface ComponentProps {
  onValueChange?: (value: number) => void
  onSelectionChange?: (selection: string) => void
}

// Usage in parent
<Component 
  onValueChange={(value) => updateSessionParam(key, value)}
  onSelectionChange={(selection) => setSelectedChannel(selection)}
/>
```

### 3. Context Consumers
```typescript
// Authentication context consumption
const SomeComponent = () => {
  const { isAuthenticated, user, logout } = useAuth()
  
  if (!isAuthenticated) return <LoginPrompt />
  
  return (
    <div>
      <span>Welcome {user.email}</span>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

## Performance Patterns

### 1. Memoization Strategy
```typescript
// Expensive calculations cached
const expensiveData = useMemo(() => {
  return processLargeDataset(rawData, parameters)
}, [rawData, parameters]) // Only recalculate when inputs change

// Component memoization
export const ExpensiveComponent = React.memo<Props>(({ data }) => {
  return <ComplexVisualization data={data} />
})
```

### 2. Lazy Loading
```typescript
// Code splitting for large components
const HeavyComponent = lazy(() => import('./HeavyComponent'))

const App = () => (
  <Suspense fallback={<Loading />}>
    <HeavyComponent />
  </Suspense>
)
```

### 3. Virtual Scrolling (Future)
```typescript
// For large data lists (not currently implemented)
const VirtualizedList = () => {
  // Would use react-window or similar for large datasets
}
```

## Error Boundaries

### Component-Level Error Handling
```typescript
// Error boundary pattern (would be implemented as needed)
class ComponentErrorBoundary extends Component {
  state = { hasError: false }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true }
  }
  
  render() {
    if (this.state.hasError) {
      return <FallbackComponent />
    }
    return this.props.children
  }
}
```

## Testing Strategy

### Component Testing Approach
```typescript
// Unit tests for components (future implementation)
describe('EMGChart', () => {
  it('renders signal data correctly', () => {
    render(<EMGChart channelName="CH1" data={mockData} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })
  
  it('handles channel switching', () => {
    const onChannelChange = jest.fn()
    render(<EMGChart onChannelChange={onChannelChange} />)
    // Test implementation
  })
})
```

## Development Guidelines

### 1. Component Organization
- **One component per file** with matching filename
- **Group related components** in folders by feature
- **Export default** for main component, named exports for utilities

### 2. Props and TypeScript
- **Define interfaces** for all component props
- **Use optional props** with sensible defaults
- **Document complex props** with JSDoc comments

### 3. State Management
- **Local state** for UI-only concerns (expanded/collapsed, input focus)
- **Global state** (Zustand) for business data and cross-component state
- **Derived state** for computed values that depend on multiple sources

### 4. Performance Considerations
- **Memoize expensive calculations** with useMemo
- **Memoize callbacks** with useCallback when passed to child components
- **Use React.memo** for pure components that re-render frequently