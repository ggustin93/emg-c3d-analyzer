---
sidebar_position: 1
title: Frontend Overview
---

# Frontend Overview

React 19 frontend with TypeScript, Zustand state management, and real-time EMG visualization.

## What It Does

- Real-time EMG signal visualization with interactive charts
- Patient/therapist/admin dashboards with role-based UI
- C3D file upload with progress tracking
- Clinical performance metrics display
- Responsive design for mobile/tablet/desktop

## Tech Stack

- **React 19** with TypeScript for type safety
- **Zustand** for simple state management
- **Tailwind CSS** + **shadcn/ui** for consistent styling  
- **Recharts** for EMG signal visualization
- **@radix-ui/react-icons** for UI icons
- **Vite** for fast development and building

## Key Files

- `src/hooks/useAuth.ts` - Authentication state management
- `src/stores/` - Zustand stores for app state
- `src/components/` - Reusable UI components
- `src/pages/` - Page-level components
- `src/utils/` - Utility functions and API helpers

## Architecture Pattern

```
├── Pages (Dashboard, Analysis, Settings)
├── Components (Charts, Forms, Tables)  
├── Hooks (useAuth, useEMGData, useUpload)
├── Stores (authStore, emgStore, uiStore)
├── Services (API calls, authentication)
└── Utils (formatters, validators, constants)
```

## Authentication Flow

1. **Login** → Supabase Auth → JWT token stored
2. **Route Protection** → `useAuth` hook checks auth state  
3. **API Calls** → JWT included in headers automatically
4. **Role-Based UI** → Components show/hide based on user role

## Data Flow

1. **User Action** → Update Zustand store → Trigger re-render
2. **API Request** → Background service call → Update store on response
3. **Real-time Updates** → Supabase subscriptions → Direct store updates
4. **Charts** → Recharts reads from EMG store → Automatic re-render

## Running Frontend

```bash
cd frontend
npm start         # Development server on port 3000
npm run build     # Production build
npm test          # Run 78 component tests
npm run lint      # ESLint analysis
```

## Testing

- **78 tests** with 100% pass rate
- **React.StrictMode** compatible
- **Hook testing** with @testing-library/react-hooks
- **Component testing** with @testing-library/react