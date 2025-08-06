# /lib - Utility Library

Core utility functions, configurations, and helper modules following React/TypeScript best practices.

## 📁 File Organization

### **Authentication & External Services**
- `supabase.ts` - Supabase client configuration and connection setup
- `supabaseSetup.ts` - Advanced Supabase configuration, authentication flows, and storage management
- `authUtils.ts` - Authentication helper functions and user management utilities

### **Visual & UI Utilities**  
- `colorMappings.ts` - Centralized color system for consistent component styling
- `performanceColors.ts` - Performance score color schemes and clinical visualization colors
- `formatters.ts` - Data formatting functions (numbers, dates, clinical values, scientific notation)

### **Core Utilities**
- `utils.ts` - General utility functions and common helpers (shadcn/ui cn() function, etc.)

## 🎯 Best Practices

### **Import Patterns**
```typescript
// ✅ Preferred: Named imports with clear intent
import { formatMetricValue, formatScientificNotation } from '@/lib/formatters';
import { getColorForChannel, PERFORMANCE_COLORS } from '@/lib/colorMappings';
import { supabase } from '@/lib/supabase';

// ❌ Avoid: Default imports for utility collections
import formatters from '@/lib/formatters';
```

### **File Responsibilities**

#### **Authentication (`authUtils.ts`, `supabase.ts`, `supabaseSetup.ts`)**
- User authentication flows
- Session management
- File storage operations
- Database connections

#### **Visual Systems (`colorMappings.ts`, `performanceColors.ts`)**  
- Consistent color schemes across components
- Performance score color mappings
- Clinical visualization standards
- Accessibility-compliant color contrast

#### **Data Processing (`formatters.ts`, `utils.ts`)**
- Clinical data formatting
- Number formatting (scientific notation, precision)
- Date/time utilities
- General helper functions

## 🔧 Usage Examples

### **Clinical Data Formatting**
```typescript
import { formatMetricValue } from '@/lib/formatters';

// Format EMG metrics with proper precision
const rmsValue = formatMetricValue(0.00012345, 'RMS'); // "1.23e-4"
const mavValue = formatMetricValue(0.08567, 'MAV');     // "0.086"
```

### **Consistent Colors**
```typescript
import { getColorForChannel, PERFORMANCE_COLORS } from '@/lib/colorMappings';

// Channel-specific colors for charts
const channelColor = getColorForChannel('Left_Bicep');  // "#8b5cf6"

// Performance score colors
const scoreColor = PERFORMANCE_COLORS.excellent;        // "#22c55e"
```

### **Authentication**
```typescript
import { supabase } from '@/lib/supabase';
import { getCurrentUser, signOut } from '@/lib/authUtils';

// Check authentication status
const user = await getCurrentUser();

// Secure sign out
await signOut();
```

## 📋 Maintenance Guidelines

### **Adding New Utilities**
1. **Determine Category**: Authentication, Visual, or Data Processing
2. **Follow Naming**: Use descriptive, verb-based function names
3. **Export Pattern**: Named exports only (no default exports)
4. **Documentation**: Include JSDoc comments for complex functions
5. **Testing**: Add unit tests for pure functions

### **File Size Guidelines**
- Keep individual files under 200 lines
- Split large utility collections into focused modules
- Use index files for complex exports if needed

### **Dependencies**
- Minimize external dependencies in utility functions
- Keep utilities pure and side-effect free when possible
- Document any external service dependencies clearly

## 🚀 Integration Points

- **Components**: Import utilities via `@/lib/*` aliases
- **Hooks**: Utility functions support custom hooks
- **Types**: Shared TypeScript types from `@/types/*`
- **Services**: API service functions may use formatters and auth utilities