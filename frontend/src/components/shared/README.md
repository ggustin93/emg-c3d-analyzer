# /shared - Cross-Domain Shared Components

Reusable components that are used across multiple feature domains in the EMG C3D Analyzer.

## 📁 Components Overview

### **Signal Processing Components**
- `ChannelFilter.tsx` - Channel filtering logic with `FilterMode` enum
- `ChannelSelection.tsx` - Multi-channel selection interface
- `DownsamplingControl.tsx` - Signal downsampling controls for chart performance

## 🎯 Purpose & Criteria

### **What Belongs Here**
Components that are truly **cross-domain** and used by **3+ different feature areas**:

✅ **Signal Processing** - Used by SignalPlotsTab, GameStatsTab, SettingsTab, ExportTab  
✅ **Common UI Patterns** - Reused across multiple tabs  
✅ **Generic Utilities** - Not specific to any single domain  

### **What Doesn't Belong Here**
❌ **Domain-Specific Logic** - Belongs in respective `/tabs/TabName/components/`  
❌ **Single-Use Components** - Should stay close to their usage  
❌ **Business Logic** - Belongs in `/services/` or custom hooks  

## 🔧 Component Guidelines

### **Interface Design**
```typescript
// ✅ Good: Generic, configurable interface
interface ChannelFilterProps {
  channels: string[];
  selectedChannels: string[];
  onSelectionChange: (channels: string[]) => void;
  filterMode?: FilterMode;
}

// ❌ Avoid: Domain-specific interfaces
interface EMGSpecificFilterProps {
  emgData: EMGAnalysisResult; // Too specific
  bfrSettings: BFRSettings;   // Too specific
}
```

### **Naming Conventions**
- **Descriptive Names**: `ChannelSelection` not `Selection`
- **Generic Terms**: `DownsamplingControl` not `EMGDownsampler`
- **Clear Purpose**: Component name should indicate functionality

### **Dependencies**
- **Minimal External Dependencies**: Keep shared components lightweight
- **UI Library Only**: shadcn/ui components and basic React hooks
- **No Business Logic**: Pure UI components with props-based configuration

## 📋 Usage Examples

### **Channel Selection**
```typescript
import { ChannelSelection } from '@/components/shared/ChannelSelection';

<ChannelSelection
  availableChannels={muscleChannels}
  selectedChannels={selectedChannels}
  onSelectionChange={handleChannelChange}
/>
```

### **Filtering**
```typescript
import { ChannelFilter, FilterMode } from '@/components/shared/ChannelFilter';

<ChannelFilter
  channels={allChannels}
  mode={FilterMode.SINGLE}
  onFilterChange={handleFilter}
/>
```

### **Downsampling Control**
```typescript
import { DownsamplingControl } from '@/components/shared/DownsamplingControl';

<DownsamplingControl
  totalDataPoints={signalData.length}
  currentSampleRate={sampleRate}
  onSampleRateChange={handleSamplingChange}
/>
```

## 🚀 Best Practices

### **Component Design**
1. **Pure Components**: No side effects, predictable outputs
2. **Configurable**: Use props for customization, not hardcoded values
3. **Accessible**: Follow WCAG guidelines for medical device accessibility
4. **TypeScript**: Strong typing with clear interfaces

### **Performance**
1. **Memoization**: Use `React.memo` for expensive components
2. **Callback Optimization**: Use `useCallback` for prop functions
3. **Bundle Size**: Keep dependencies minimal

### **Maintenance**
1. **Documentation**: Clear JSDoc comments for complex components
2. **Testing**: Unit tests for shared components (higher reuse = higher test priority)
3. **API Stability**: Minimize breaking changes to shared interfaces

## 🔄 Migration Path

When moving components to `/shared/`:
1. **Assess Usage**: Confirm 3+ domain usage
2. **Generalize Interface**: Remove domain-specific props
3. **Update Imports**: Change all import paths across codebase
4. **Test Integration**: Verify functionality in all usage locations
5. **Document**: Add to this README with usage examples