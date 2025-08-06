# /tabs - Tab-Based UI Components

Organized tab components following domain-driven design principles for the EMG C3D Analyzer.

## 📁 Directory Structure

### **Main Tab Components**
Each major feature area has its own tab with dedicated components and logic:

#### **SignalPlotsTab/** - EMG Signal Visualization
- `EMGChart.tsx` - Main EMG signal plotting with Recharts
- `ChartControlHeader.tsx` - Chart controls and options
- `SignalTypeSwitch.tsx` - Raw vs activated signal switching

#### **GameStatsTab/** - Statistical Analysis 
- `StatsPanel.tsx` - EMG metrics display and analysis
- `MetadataDisplay.tsx` - File and session metadata
- `MuscleComparisonTable.tsx` - Multi-muscle comparison view

#### **PerformanceTab/** - Clinical Performance Analysis
- `PerformanceTab.tsx` - Main performance dashboard
- `components/` - Performance-specific components:
  - `MusclePerformanceCard.tsx` - Individual muscle performance
  - `OverallPerformanceCard.tsx` - Aggregate performance scores
  - `PerformanceEquation.tsx` - Interactive performance formula
  - `SubjectiveFatigueCard.tsx` - Patient-reported outcomes

#### **BFRMonitoringTab/** - Blood Flow Restriction Monitoring
- `BFRMonitoringTab.tsx` - BFR safety monitoring interface
- Clinical compliance tracking and safety alerts

#### **SettingsTab/** - Configuration Management
- `SettingsTab.tsx` - Main settings interface (renamed from SettingsPanel)
- `components/` - Settings-specific components:
  - `BFRParametersSettings.tsx` - BFR configuration
  - `TherapeuticParametersSettings.tsx` - Clinical thresholds
  - `ContractionDetectionSettings.tsx` - Analysis parameters

#### **ExportTab/** - Data Export Functionality
- `ExportTab.tsx` - Export interface and options
- `ExportActions.tsx` - Export execution logic
- `ExportOptionsPanel.tsx` - Export configuration

### **Shared Components**
#### **shared/** - Cross-Tab Utilities
- `GameSessionTabs.tsx` - Main tab container and orchestration (renamed from game-session-tabs.tsx)
- `metric-card.tsx` - Reusable metric display card
- `performance-card.tsx` - Reusable performance display card

## 🎯 Design Principles

### **Domain Separation**
Each tab represents a distinct clinical or functional domain:
- **Signal Analysis** → SignalPlotsTab
- **Statistical Review** → GameStatsTab  
- **Clinical Assessment** → PerformanceTab
- **Safety Monitoring** → BFRMonitoringTab
- **Configuration** → SettingsTab
- **Data Export** → ExportTab

### **Component Organization**
```
TabName/
├── TabName.tsx          # Main tab component
├── components/          # Tab-specific components
├── hooks/              # Tab-specific custom hooks (if needed)
├── utils/              # Tab-specific utilities (if needed)
├── types.ts            # Tab-specific TypeScript types (if needed)
└── index.ts            # Barrel export
```

### **Import Patterns**
```typescript
// ✅ Preferred: Import from tab index
import { GameStatsTab } from '@/components/tabs/GameStatsTab';
import { PerformanceTab } from '@/components/tabs/PerformanceTab';

// ✅ Acceptable: Direct component import for specific components
import { EMGChart } from '@/components/tabs/SignalPlotsTab/EMGChart';

// ✅ Shared components
import { GameSessionTabs } from '@/components/tabs/shared';
```

## 🔧 Usage Guidelines

### **Adding New Tabs**
1. Create new directory following `TabName/` pattern
2. Implement main `TabName.tsx` component
3. Add to `GameSessionTabs.tsx` tab list
4. Create `index.ts` barrel export
5. Add domain-specific components in `components/` subdirectory

### **Tab State Management**
- Global state via Zustand (`useSessionStore`)
- Tab-specific state within tab components
- Cross-tab communication through shared store

### **Styling Consistency**
- Use shadcn/ui components for consistency
- Follow medical device UI standards
- Maintain professional clinical appearance

## 🚀 Integration Points

- **Main App**: Imported via `GameSessionTabs` component
- **Global State**: `useSessionStore` for cross-tab data
- **Types**: Shared TypeScript interfaces from `@/types/emg`
- **Services**: API calls and data processing from `@/services/`
- **Utilities**: Formatting and helpers from `@/lib/`