# 🎨 Color System - Single Source of Truth

## Overview
ALL colors for performance, gauges, progress bars, and UI elements MUST use the centralized color system defined in `performanceColors.ts`.

## ✅ The ONLY Color Source
- **File**: `/src/lib/performanceColors.ts`
- **Purpose**: Centralized color definitions for the entire application
- **Compliance**: WCAG AA verified for all color combinations

## 🚫 Deleted/Deprecated Files
The following files have been removed - DO NOT recreate them:
- ❌ `scoringSystem.ts` (deleted)
- ❌ `progressBarColors.ts` (deleted)
- ❌ Any hardcoded colors in components

## 📦 What's Included

### Core Performance Colors
- **Excellent (80-100%)**: Emerald theme
- **Good (60-79%)**: Cyan theme (replaced blue)
- **Satisfactory (40-59%)**: Amber theme
- **Needs Improvement (0-39%)**: Red theme

### Each Color Theme Includes
- `text` - Text colors for labels
- `bg` - Background colors for cards
- `progress` - Progress bar fills (darker)
- `progressLight` - Light progress fills (gauges)
- `border` - Border colors
- `hex` - Hex values for charts/custom rendering

## 🎯 Usage Guidelines

### For Performance Cards
```typescript
import { getPerformanceColors } from '@/lib/performanceColors';

const colors = getPerformanceColors(score);
// Use colors.text, colors.bg, colors.progressLight, etc.
```

### For Progress Bars
```typescript
import { getProgressBarColors } from '@/lib/performanceColors';

const progressColors = getProgressBarColors(score);
<Progress indicatorClassName={progressColors.light} />
```

### For Hooks
```typescript
import { useScoreColors } from '@/hooks/useScoreColors';
// This hook internally uses performanceColors.ts

const scoreColors = useScoreColors(score);
```

### For Fatigue/Effort Scores
```typescript
import { useFatigueColors } from '@/hooks/useFatigueColors';
// Returns emerald colors for optimal ranges (4-6 on CR10 scale)
```

## 🔄 Component Color Breakdown
Used in `OverallPerformanceCard` for distinct visualization:
- **Session Completion**: Cyan (was blue)
- **MVC Quality**: Emerald
- **Quality Threshold**: Amber
- **Bilateral Symmetry**: Purple
- **Subjective Effort**: Red
- **Game Performance**: Gray

## ⚠️ Important Rules

1. **NEVER hardcode colors** - Always use the centralized system
2. **NEVER create new color files** - Add to performanceColors.ts if needed
3. **Always use progressLight for gauges** - Ensures consistency
4. **Use progress (darker) for progress bars** - Better visibility
5. **Check WCAG compliance** - Especially for amber text (use amber-700)

## 🔍 How to Verify Compliance

Run these checks to ensure color system integrity:
```bash
# Should return 0 results - no hardcoded colors
grep -r "text-\(green\|blue\)-[0-9]" src/
grep -r "bg-\(green\|blue\)-[0-9]" src/

# Should only show performanceColors.ts
find src -name "*color*.ts" -o -name "*Color*.ts"

# Verify all imports use central system
grep -r "import.*performanceColors" src/
```

## 📊 Color Mapping Reference

| Old Color | New Color | Usage |
|-----------|-----------|-------|
| green-* | emerald-* | Excellence, success |
| blue-* | cyan-* | Good performance |
| yellow-* | amber-* | Satisfactory, warnings |
| red-* | red-* | Needs improvement |

## 🎨 Design Principles

1. **Consistency**: Same color = same meaning everywhere
2. **Accessibility**: All colors meet WCAG AA standards
3. **Clarity**: Distinct colors for different metrics
4. **Hierarchy**: Darker shades for emphasis, lighter for backgrounds
5. **Single Source**: One file to rule them all

---

**Last Updated**: September 2025
**Maintained By**: Frontend Team
**Questions**: Check performanceColors.ts for implementation details