# EMG Analysis Data Flow

Complete data pipeline from C3D file upload to EMG visualization and analysis.

## Overview Pipeline

```
C3D Upload → Backend Processing → EMG Analysis → Frontend Visualization
     ↓              ↓                 ↓              ↓
File Storage → Signal Extraction → Metrics Calc → Charts & Stats
```

## Backend Processing Flow

### 1. File Upload (`POST /upload`)
```python
# api.py
@app.post("/upload", response_model=EMGAnalysisResult)
async def upload_file(
    file: UploadFile,
    session_config: SessionConfig = Depends()
):
    # 1. Validate C3D file format
    # 2. Create unique processing ID
    # 3. Initialize processor with config
    processor = GHOSTLYC3DProcessor(session_config)
    
    # 4. Process file and return complete analysis
    result = await processor.process_file(file)
    return result
```

### 2. C3D Signal Extraction
```python
# processor.py - GHOSTLYC3DProcessor
def extract_emg_channels(self, c3d_file) -> Dict[str, np.ndarray]:
    """Extract all EMG channels from C3D file"""
    
    # Auto-detect channel naming conventions:
    # - "CH1", "CH2" (standard)
    # - "EMG1", "EMG2" (alternative)
    # - "CH1 Raw", "CH1 Activated" (processed variants)
    
    channels = {}
    for label in c3d_file['parameters']['POINT']['LABELS']['value']:
        if self.is_emg_channel(label):
            channels[label] = c3d_file['data']['points'][idx]
    
    return channels
```

### 3. EMG Analysis Pipeline
```python
# emg_analysis.py - Core analysis functions
def analyze_channel(signal: np.ndarray, sampling_rate: float) -> ChannelAnalytics:
    """Complete EMG analysis for single channel"""
    
    # Time domain metrics
    rms = calculate_rms(signal)
    mav = calculate_mav(signal)
    
    # Frequency domain metrics  
    mpf = calculate_mean_power_frequency(signal, sampling_rate)
    mdf = calculate_median_frequency(signal, sampling_rate)
    
    # Fatigue analysis
    fatigue_index = calculate_dimitrov_fatigue_index(signal, sampling_rate)
    
    # Contraction detection (if activated signal)
    contractions = detect_contractions(signal, threshold_params)
    
    return ChannelAnalytics(
        rms=rms, mav=mav, mpf=mpf, mdf=mdf,
        fatigue_index_fi_nsm5=fatigue_index,
        contractions=contractions
    )
```

### 4. Response Bundle Creation
```python
# Complete response with all data needed by frontend
response = EMGAnalysisResult(
    file_id=unique_id,
    timestamp=timestamp,
    source_filename=filename,
    metadata=extract_game_metadata(c3d_file),
    analytics={ch: analyze_channel(data) for ch, data in channels.items()},
    available_channels=list(channels.keys()),
    emg_signals={
        ch: EMGChannelSignalData(
            sampling_rate=sampling_rate,
            time_axis=create_time_axis(data),
            data=data.tolist(),
            rms_envelope=calculate_rms_envelope(data).tolist()
        ) for ch, data in channels.items()
    }
)
```

## Frontend Data Flow

### 1. State Management (Zustand)
```typescript
// store/sessionStore.ts - Global state management
interface SessionState {
  // Analysis results
  analysisResult: EMGAnalysisResult | null
  
  // User configuration
  sessionParams: GameSessionParameters
  
  // UI state
  selectedChannel: string | null
  viewMode: 'single' | 'comparison'
}

// Reactive state updates trigger component re-renders
const useSessionStore = create<SessionState>((set, get) => ({
  setAnalysisResult: (result) => set({ analysisResult: result }),
  updateSessionParams: (params) => set({ sessionParams: params }),
}))
```

### 2. Data Processing Hooks
```typescript
// hooks/useLiveAnalytics.ts - Reactive analytics
export const useLiveAnalytics = (channelName: string) => {
  const { analysisResult, sessionParams } = useSessionStore()
  
  return useMemo(() => {
    if (!analysisResult) return null
    
    // Apply session parameters to recalculate metrics
    const channelData = analysisResult.analytics[channelName]
    const mvcValue = sessionParams.session_mvc_values?.[channelName]
    
    // Recalculate good contractions with current MVC threshold
    const goodContractions = channelData.contractions?.filter(
      contraction => contraction.max_amplitude >= (mvcValue * 0.75)
    )
    
    return {
      ...channelData,
      good_contraction_count: goodContractions?.length || 0
    }
  }, [analysisResult, sessionParams, channelName])
}
```

### 3. Component Data Flow
```typescript
// Component hierarchy and data flow:

// App.tsx
//   ├── AuthGuard
//   │   ├── SessionLoader (file selection)
//   │   └── GameSessionTabs (analysis interface)
//   │       ├── Signal Plots Tab
//   │       │   ├── EMGChart (visualization)
//   │       │   └── ChartControlHeader (controls)
//   │       ├── Analytics Tab
//   │       │   ├── StatsPanel (metrics display)
//   │       │   └── MuscleComparisonTable
//   │       ├── Performance Tab
//   │       │   ├── OverallPerformanceCard
//   │       │   └── MusclePerformanceCard
//   │       └── Settings Tab
//   │           └── SettingsPanel (configuration)

// Data flows down via props, state updates via Zustand
```

### 4. Chart Data Processing
```typescript
// hooks/useEmgDataFetching.ts - Chart data preparation 
export const usePlotDataProcessor = (channelName: string) => {
  const { analysisResult } = useSessionStore()
  
  return useMemo(() => {
    if (!analysisResult?.emg_signals[channelName]) return null
    
    const channelData = analysisResult.emg_signals[channelName]
    
    // Create chart-ready data points
    const chartData: EMGPoint[] = channelData.time_axis.map((time, i) => ({
      time,
      value: channelData.data[i],
      rms: channelData.rms_envelope?.[i] || 0
    }))
    
    // Apply downsampling for performance
    return downsampleData(chartData, targetPoints)
  }, [analysisResult, channelName])
}
```

## Data Transformation Points

### 1. Backend → Frontend
```typescript
// API response transforms to UI state
const handleUploadSuccess = (result: EMGAnalysisResult) => {
  // Store complete analysis result
  setAnalysisResult(result)
  
  // Initialize UI defaults
  setSelectedChannel(result.available_channels[0])
  
  // Auto-configure session parameters from metadata
  updateSessionParams({
    channel_muscle_mapping: inferMuscleMapping(result.available_channels),
    session_mvc_values: initializeMvcValues(result.analytics)
  })
}
```

### 2. Configuration → Recalculation
```typescript
// Session parameter changes trigger live recalculation
const updateMvcThreshold = (channel: string, threshold: number) => {
  updateSessionParams({
    session_mvc_threshold_percentages: {
      ...sessionParams.session_mvc_threshold_percentages,
      [channel]: threshold
    }
  })
  
  // This automatically triggers useLiveAnalytics recalculation
  // No additional API calls needed - fully reactive
}
```

### 3. UI State → Visualization
```typescript
// EMGChart component consumes processed data
const EMGChart: React.FC<EMGChartProps> = ({ channelName }) => {
  const chartData = usePlotDataProcessor(channelName)
  const analytics = useLiveAnalytics(channelName)
  const { sessionParams } = useSessionStore()
  
  // MVC threshold line from current parameters
  const mvcThreshold = sessionParams.session_mvc_values?.[channelName] * 
    (sessionParams.session_mvc_threshold_percentages?.[channelName] / 100)
  
  return (
    <ResponsiveContainer>
      <ComposedChart data={chartData}>
        <Line dataKey="rms" stroke="#8884d8" />
        <ReferenceLine y={mvcThreshold} stroke="#ff0000" />
        {/* Contraction visualization */}
        {contraction periods mapped to ReferenceArea components}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
```

## Performance Optimizations

### 1. Stateless Backend
- **No file persistence**: All data returned in single response
- **In-memory processing**: Fast C3D analysis without I/O overhead
- **Bundled response**: Single API call contains all needed data

### 2. Frontend Efficiency
- **Memoized calculations**: useMemo prevents unnecessary recalculations
- **Downsampling**: Chart data reduced to ~1000 points for smooth rendering
- **Lazy loading**: Components render only when needed
- **State batching**: Zustand updates batched for optimal re-renders

### 3. Data Pipeline Caching
```typescript
// Client-side result caching
const cachedAnalytics = useMemo(() => {
  return expensiveAnalyticsCalculation(rawData)
}, [rawData, sessionParams]) // Only recalculate when inputs change
```

## Error Handling Flow

### Backend Error Propagation
```python
try:
    result = processor.process_file(file)
    return result
except C3DProcessingError as e:
    raise HTTPException(status_code=422, detail=f"C3D processing failed: {str(e)}")
except Exception as e:
    raise HTTPException(status_code=500, detail="Internal processing error")
```

### Frontend Error Recovery
```typescript
// Error boundaries and graceful degradation
const handleAnalysisError = (error: Error) => {
  if (error.message.includes('file format')) {
    showUserError('Invalid C3D file format')
  } else if (error.message.includes('processing')) {
    showUserError('Analysis failed - please try again')
  } else {
    showUserError('Unexpected error - please contact support')
  }
  
  // Reset to file selection state
  setAnalysisResult(null)
}
```

## Integration Points

- **Authentication**: All API calls include JWT token from Supabase auth
- **File Storage**: C3D files can be uploaded from Supabase Storage or local files  
- **Database**: Analysis metadata can be stored in emg_sessions table
- **Export**: Complete analysis data can be exported as JSON for external use