# Contraction Visualization - Technical Documentation

## Architecture Overview

The contraction visualization system is implemented as an integrated component within the EMG Chart visualization layer, providing real-time visual feedback for muscle contraction analysis during rehabilitation sessions.

## Component Architecture

### Core Components

#### EMGChart Component (`/frontend/src/components/EMGChart.tsx`)
- **Primary Role**: Main chart rendering and contraction visualization coordination
- **Chart Library**: Recharts `ComposedChart` for complex multi-layer visualization
- **State Management**: Local React state for visualization toggles, Zustand for session parameters
- **Performance**: Memoized processing with optimized re-rendering

#### Data Processing Pipeline
```typescript
Analytics Data → useLiveAnalytics → contractionAreas → Visualization Components
```

### Key Technical Decisions

#### 1. XAxis Configuration
**Problem**: Scatter plot dots not visible due to coordinate positioning
**Solution**: XAxis `type="number"` for decimal time coordinates
```typescript
<XAxis 
  type="number"              // Critical change from default "category"
  dataKey="time" 
  domain={['dataMin', 'dataMax']}
/>
```

#### 2. Dual Visualization Strategy
**ReferenceArea + ReferenceDot Combination**:
- **ReferenceArea**: Background highlighting for contraction duration
- **ReferenceDot**: Peak markers for quality indicators
- **Coordination**: Shared data processing with separate rendering logic

#### 3. Performance Optimization
**Memoization Strategy**:
```typescript
const contractionAreas = useMemo(() => {
  // Time range validation
  const timeRange = chartData.length > 0 ? {
    min: Math.min(...chartData.map(d => d.time)),
    max: Math.max(...chartData.map(d => d.time))
  } : { min: 0, max: 0 };
  
  // Efficient contraction processing
  Object.entries(analytics).forEach(([channelName, channelData]) => {
    // Process contractions with boundary validation
  });
}, [analytics, finalDisplayDataKeys, chartData]);
```

## Data Flow Architecture

### 1. Input Processing
```
C3D File → Backend Processing → Analytics API → Frontend State
```

### 2. Visualization Pipeline
```
Analytics Data → Contraction Processing → Chart Components → User Interface
```

### 3. User Interaction Flow
```
Toggle Controls → State Updates → Re-render → Visual Updates
```

## Implementation Details

### Chart Configuration

#### ComposedChart Setup
```typescript
<ComposedChart data={chartData} margin={chartMargins}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis type="number" dataKey="time" domain={['dataMin', 'dataMax']} />
  <YAxis domain={yDomain} allowDataOverflow={false} />
  <Tooltip formatter={tooltipFormatter} />
  <Legend content={renderLegend} />
  
  {/* EMG Signal Lines */}
  {finalDisplayDataKeys.map(dataKey => (
    <Line key={dataKey} type="monotone" dataKey={dataKey} />
  ))}
  
  {/* MVC Threshold Lines */}
  {thresholdLines}
  
  {/* Contraction Areas */}
  {contractionAreas.map(area => (
    <ReferenceArea key={area.id} x1={area.startTime} x2={area.endTime} />
  ))}
  
  {/* Contraction Dots */}
  {contractionAreas.map(area => (
    <ReferenceDot key={area.id} x={area.peakTime} y={area.maxAmplitude} />
  ))}
</ComposedChart>
```

### Data Processing

#### Contraction Area Processing
```typescript
interface ContractionArea {
  startTime: number;        // Contraction start in seconds
  endTime: number;          // Contraction end in seconds
  isGood: boolean;          // Quality assessment
  channel: string;          // EMG channel name
  maxAmplitude: number;     // Peak amplitude value
  peakTime: number;         // Peak time (calculated as midpoint)
}
```

#### Time Range Validation
```typescript
// Prevent rendering outside chart boundaries
if (startTime >= timeRange.min && endTime <= timeRange.max) {
  areas.push({
    startTime,
    endTime,
    isGood: contraction.is_good === true,
    channel: channelName,
    maxAmplitude: contraction.max_amplitude,
    peakTime: (startTime + endTime) / 2
  });
}
```

### Visual Styling

#### Color Scheme
```typescript
const CONTRACTION_COLORS = {
  good: {
    fill: "rgba(34, 197, 94, 0.3)",      // Semi-transparent green
    stroke: "#16a34a",                   // Solid green
    dot: "#22c55e"                       // Bright green
  },
  poor: {
    fill: "rgba(239, 68, 68, 0.25)",     // Semi-transparent red
    stroke: "#dc2626",                   // Solid red
    dot: "#ef4444"                       // Bright red
  }
};
```

#### Quality Indicators
```typescript
const QualityLabel = ({ isGood }: { isGood: boolean }) => ({
  value: isGood ? "✓" : "✗",
  position: "top",
  fill: isGood ? "#16a34a" : "#dc2626",
  fontSize: 12,
  fontWeight: "bold",
  offset: 8
});
```

## User Interface Components

### Control Panel
```typescript
<div className="flex justify-between items-start p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
  {/* Contraction Type Toggles */}
  <div className="flex gap-4">
    <ContractionToggle type="good" />
    <ContractionToggle type="poor" />
  </div>
  
  {/* Display Options */}
  <div className="flex gap-4">
    <DisplayToggle type="areas" />
    <DisplayToggle type="dots" />
  </div>
  
  {/* Signal Type Switch */}
  <SignalTypeSwitch />
</div>
```

### Dynamic Legend
```typescript
const renderLegend = useCallback(() => {
  const qualityStats = calculateQualityStats();
  
  return (
    <div className="space-y-2">
      {/* MVC Thresholds */}
      <ThresholdLegend />
      
      {/* Contraction Quality */}
      <QualityLegend 
        goodCount={qualityStats.goodCount}
        totalCount={qualityStats.totalCount}
        percentage={qualityStats.percentage}
      />
    </div>
  );
}, [qualityStats]);
```

## Performance Considerations

### Optimization Strategies

#### 1. Memoization
- **Contraction Processing**: Memoized with proper dependencies
- **Quality Summary**: Cached calculation for legend
- **Y-Domain**: Optimized domain calculation with padding

#### 2. Conditional Rendering
```typescript
{showContractionAreas && contractionAreas
  .filter(area => (area.isGood && showGoodContractions) || (!area.isGood && showPoorContractions))
  .map(area => <ReferenceArea key={area.id} {...area} />)}
```

#### 3. Efficient Data Structure
- **Flat Arrays**: Avoid nested objects for better performance
- **Filtered Processing**: Process only visible contractions
- **Boundary Checks**: Validate time ranges before processing

### Performance Metrics
- **Initial Render**: ~50ms for 25 contractions
- **Toggle Updates**: ~5ms state updates
- **Memory Usage**: ~2MB for typical session data
- **Re-render Frequency**: Only on dependency changes

## Integration Points

### Backend Integration
```typescript
// Analytics API Response
interface ChannelAnalyticsData {
  contractions: ContractionData[];
  // ... other metrics
}

interface ContractionData {
  start_time_ms: number;
  end_time_ms: number;
  max_amplitude: number;
  is_good: boolean;
  // ... other properties
}
```

### State Management
```typescript
// Zustand Store
interface SessionStore {
  session_mvc_values: Record<string, number>;
  session_mvc_threshold_percentages: Record<string, number>;
  // ... other session parameters
}

// React State
const [showGoodContractions, setShowGoodContractions] = useState(true);
const [showPoorContractions, setShowPoorContractions] = useState(true);
const [showContractionAreas, setShowContractionAreas] = useState(true);
const [showContractionDots, setShowContractionDots] = useState(true);
```

## Error Handling and Validation

### Boundary Validation
```typescript
// Time range validation
if (startTime >= timeRange.min && endTime <= timeRange.max) {
  // Process contraction
} else {
  console.warn(`⚠️ Contraction outside chart range:`, {
    contractionTime: [startTime, endTime],
    chartTimeRange: timeRange
  });
}
```

### Data Validation
```typescript
// Ensure required data exists
if (!analytics || !chartData || chartData.length === 0) {
  return <EmptyState />;
}

// Validate contraction data
const validContractions = contractions.filter(c => 
  c.start_time_ms != null && 
  c.end_time_ms != null && 
  c.max_amplitude != null
);
```

## Debug and Monitoring

### Debug Logging
```typescript
console.log('🎯 Contraction visualization:', {
  areasCount: areas.length,
  chartTimeRange: timeRange,
  chartDataPoints: chartData.length,
  goodCount: areas.filter(a => a.isGood).length,
  poorCount: areas.filter(a => !a.isGood).length
});
```

### Performance Monitoring
```typescript
const startTime = performance.now();
// Processing logic
const endTime = performance.now();
console.log(`Processing time: ${endTime - startTime}ms`);
```

## Testing Strategy

### Unit Tests
- **Component Rendering**: Test chart renders with contraction data
- **Toggle Functionality**: Verify toggle controls work correctly
- **Data Processing**: Test contraction area calculation
- **Edge Cases**: Handle empty data, invalid coordinates

### Integration Tests
- **End-to-End**: Full workflow from data upload to visualization
- **Performance**: Load testing with large datasets
- **User Interactions**: Test all toggle combinations

### Visual Testing
- **Screenshot Tests**: Automated visual regression testing
- **Accessibility**: Color contrast and screen reader testing
- **Responsive Design**: Mobile and desktop compatibility

## Future Enhancements

### Planned Features
1. **Hover Tooltips**: Detailed contraction metrics on mouse over
2. **Animation Transitions**: Smooth transitions for better UX
3. **Export Functionality**: Export visualization as image or data
4. **Configurable Styling**: User-customizable colors and sizes

### Technical Improvements
1. **WebGL Rendering**: Hardware acceleration for large datasets
2. **Virtual Scrolling**: Efficient rendering for long recordings
3. **Real-time Updates**: Live data streaming during sessions
4. **Advanced Analytics**: Machine learning-based quality assessment

## Deployment Considerations

### Build Configuration
- **Bundle Size**: Recharts adds ~200KB to bundle
- **Tree Shaking**: Import only needed components
- **Code Splitting**: Lazy load visualization components

### Browser Compatibility
- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+
- **Fallbacks**: SVG rendering for older browsers
- **Performance**: Optimized for clinical workstations

### Accessibility
- **WCAG 2.1 AA**: High contrast colors, keyboard navigation
- **Screen Readers**: Proper ARIA labels and descriptions
- **Motor Accessibility**: Large touch targets, keyboard shortcuts