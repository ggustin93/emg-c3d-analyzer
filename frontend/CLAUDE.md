
# CLAUDE.md — Frontend & UX/UI Guidelines

Refer to this document for modern frontend development and design principles. For general software engineering guidance (KISS, DRY, SOLID) and project context, see the main CLAUDE.md in project root.

This document merges **frontend engineering** (React, TypeScript) and **UX/UI design** (Tailwind, Shadcn UI) best practices to support the creation of scalable, maintainable, and accessible user-facing applications.

---

## 1/ Mission

**Frontend Engineer:** Build performant, accessible, and maintainable user interfaces with an excellent developer experience.

**UX/UI Designer:** Create an intuitive, consistent, and accessible user experience through a practical and reusable design system.

---

## 2/ Core Recommendations

### 2.1 Code & Logic

1.  **Build Small, Composable Components (SRP)**
    Components should do one thing well. Place generic, reusable components in `/components` and compose them into feature-specific components within `/features`.

2.  **Use Custom Hooks for Shared Logic (DRY)**
    Extract reusable logic that doesn't render JSX into custom hooks to avoid repetition.

3.  **Separate Client State from Server Cache**
    *   **UI State** (e.g., modals, themes) → `useState` or a simple state manager like Zustand.
    *   **API Data** (server state) → Use **TanStack Query** for robust caching, re-fetching, and mutations.

4.  **Strict TypeScript**
    Enable `"strict": true` in your `tsconfig.json`. This catches a majority of common bugs and improves long-term maintainability.

5.  **Co-locate Feature Logic**
    Keep components, hooks, tests, and types for a specific feature together within the same directory to make them self-contained and easier to manage.

6.  **Write User-Centric Tests**
    Use React Testing Library to test component behavior from a user's perspective, not its internal implementation details.

7.  **Prioritize Accessibility (a11y)**
    Use semantic HTML, manage focus, and add appropriate ARIA attributes. Test for keyboard navigation and screen reader compatibility.

8.  **Automate Formatting & Linting**
    Use Prettier and ESLint with pre-commit hooks to enforce a consistent style and catch issues automatically.

9.  **Lazy Load Routes & Heavy Components**
    Use `React.lazy()` and `Suspense` to code-split your application. This reduces the initial bundle size and improves load times.

10. **Handle All UI States Explicitly**
    Ensure every component that fetches data properly handles its `loading`, `error`, and `empty` states. Don't leave the user guessing.

### 2.2 API Routing Architecture

**Standard Approach**: Frontend uses `/api/*` prefix → Vite proxy strips `/api` → Backend serves without prefix

**Architecture Decision (Sep 2025)**:
Frontend maintains a consistent `/api/*` pattern through environment-aware configuration.

**🚨 Critical Implementation Rule**:
**ALWAYS use `API_CONFIG.baseUrl`** - NEVER hardcode API endpoints in frontend services.

**Environment-Aware Configuration**:
```typescript
// src/config/apiConfig.ts
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:8080')
}
```

**Correct Implementation Patterns**:
```typescript
// ✅ ALWAYS use this pattern - environment-aware
import { API_CONFIG } from '@/config/apiConfig';
const response = await fetch(`${API_CONFIG.baseUrl}/clinical-notes`);
const data = await fetch(`${API_CONFIG.baseUrl}/therapists/lookup`);
const config = await fetch(`${API_CONFIG.baseUrl}/scoring/configurations/active`);

// ❌ NEVER use these patterns - will break in production
fetch('/api/clinical-notes')              // Hardcoded /api
fetch('http://localhost:8080/endpoint')   // Hardcoded localhost
```

**Vite Configuration**:
```javascript
// vite.config.ts - Development only
proxy: {
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '')  // Strip /api for backend
  }
}
```

**Production Environment**:
- Set `VITE_API_URL` environment variable in deployment platform (Vercel/Netlify)
- Example: `VITE_API_URL=https://api.yourapp.com`
- `API_CONFIG.baseUrl` automatically resolves to production URL

**🚨 Sep 2025 Production Lesson**:
**Problem**: Vercel deployment failures with 404 errors for FAQ/About pages
**Root Cause**: Inconsistent API patterns across frontend services
1. **✅ Working Services**: Used `API_CONFIG.baseUrl` (7 files) - upload functionality
2. **❌ Broken Services**: Used hardcoded `/api` (3 files) - FAQ/About content
3. **⚠️ Unpredictable Services**: Used hardcoded localhost (1 file)

**Files Fixed**:
- `useScoringConfiguration.ts`: 6 hardcoded `/api` calls → `${API_CONFIG.baseUrl}`
- `logger.ts`: hardcoded `/api/logs/frontend` → `${API_CONFIG.baseUrl}/logs/frontend`
- `adherenceService.ts`: localhost URL → `${API_CONFIG.baseUrl}`

**Why "Some Routes Worked"**: Partial functionality was misleading - upload used correct patterns while content loading used broken patterns.

**Prevention Strategy**:
1. **Code Review**: Grep for hardcoded patterns: `grep -r "fetch('/api" src/`
2. **Testing**: Integration tests without Vite proxy
3. **Enforcement**: ESLint rule to prevent hardcoded API calls
4. **Single Source**: All API calls MUST use `API_CONFIG.baseUrl`

### 2.2 Authentication Architecture

**Standard**: Supabase Auth → React Hook → FastAPI (validation only) → RLS (authorization)

**🏗️ Clean Architecture (Jan 2025)**:
Authentication system follows SOLID/SSoT/DRY/KISS principles with single source of truth pattern.

**Architecture Components**:
1. **Frontend (React)**: 
   - Use `useAuth` hook for auth state management
   - Roles used for UI rendering only, not security
   - Direct Supabase client for most operations

2. **Backend (FastAPI)**: 
   - JWT validation only via `get_current_user` dependency
   - No authorization logic - delegates to RLS
   - Thin authentication layer (84 lines total)

3. **Database (Supabase)**: 
   - RLS policies as single source of truth for permissions
   - 18+ comprehensive policies across all tables
   - Role-based access control at database level

**🚨 Critical Implementation Rules**:

**✅ Single Source of Truth Pattern**:
```typescript
// ✅ ALWAYS use shared auth utility - never direct Supabase calls
import { getCurrentSession, login, logout } from '@/lib/authUtils';
const { session, user, error } = await getCurrentSession();

// ❌ NEVER use direct Supabase calls in components
const { data: { session } } = await supabase.auth.getSession();
```

**✅ Proper Component Usage**:
```typescript
// ✅ CORRECT: Use useAuth hook for React state
const { user, session, loading, logout } = useAuth();
if (loading) return <LoadingSpinner />;
if (!user) return <LoginPage />;

// ❌ WRONG: Don't call auth utilities directly in components
const handleLogout = async () => {
  await logout(); // ❌ This bypasses React state management
  navigate('/login'); // ❌ Navigation should be in utility
};
```

**Architecture Decision (Jan 2025)**:
- **Eliminated**: Dual auth systems (AuthService + useAuth)
- **Implemented**: Single shared auth utility (`/lib/authUtils.ts`)
- **Result**: Clean logout flow, consistent auth state, SOLID compliance

**When to Use Direct Supabase vs FastAPI**:
- **Direct Supabase**: Auth, CRUD, storage, real-time subscriptions
- **FastAPI**: EMG processing, complex logic, external APIs, heavy computation

**🔧 Development Decision**: 
The project uses **synchronous** Supabase Python client (`supabase-py`), not async version:
- **Client Import**: `from supabase import Client, create_client` (synchronous)
- **Test Mocking**: **NEVER use AsyncMock** - Always use `MagicMock()` from unittest.mock
- **Rationale**: Follows KISS principle - no unnecessary async complexity

### 2.3 Design & User Experience

11. **Use `tailwind.config.js` as the Source of Truth (DRY)**
    Your Tailwind config is the bridge between design and code. Map all design tokens—colors, fonts, spacing, and shadows—from Figma (or other tools) directly into your config.

12. **Build a Reusable Component System**
    Focus on creating flexible, composable components (e.g., in Storybook) rather than designing static, one-off pages.

13. **Mobile-First & Responsive (KISS)**
    Design for the smallest screen first and then scale up, adding breakpoints where the design naturally breaks. This ensures a solid experience on all devices.

14. **Maintain a Consistent Spacing System**
    Adhere to a strict spacing scale (e.g., a 4px or 8px grid) for all margins, paddings, and layout gaps. This creates visual harmony and predictability.

15. **Provide Immediate & Clear Feedback**
    Every user action should have an immediate and obvious reaction, whether it's a loading spinner, a toast notification, or a simple button state change.

16. **Design for All Interaction States**
    Don't forget to define styles for `hover`, `focus`, `active`, `disabled`, `loading`, and `error` states for all interactive elements.

17. **Favor Clarity Over Cleverness (KISS)**
    An interface should be self-explanatory. Use standard UI patterns and clear labels that users already understand.

18. **Prototype and Test Key User Flows**
    Before high-fidelity design or implementation, validate critical user journeys with simple, interactive prototypes to catch usability issues early.

---

## 3/ Recommended Frontend File Organization

```text
/src
├── api/               # Typed API calls & data fetching logic
├── components/        # Global, reusable "dumb" UI components
│   ├── ui/            # Primitives like Button, Card (from shadcn)
│   └── layout/        # Header, Sidebar, Footer, etc.
├── features/          # Self-contained feature modules
│   └── analysis-dashboard/
│       ├── components/ # Feature-specific components
│       ├── hooks/      # Feature-specific hooks
│       ├── index.tsx   # Main feature view/entry point
│       └── types.ts    # Feature-specific types
├── hooks/             # Global, shared hooks (e.g., useAuth, useTheme)
├── lib/               # Global utilities (e.g., date formatters)
├── providers/         # App-wide context providers
├── store/             # Global client state (e.g., Zustand)
├── styles/            # Global CSS styles
└── App.tsx            # Main app router and provider setup
```

---

## 4/ Guiding Principles

*   **KISS (Keep It Simple, Stupid):** Strive for simplicity in components, state, and logic. If a simpler solution exists, choose it.
*   **DRY (Don't Repeat Yourself):** Avoid duplicating code and styles. Use hooks, components, and Tailwind tokens to stay efficient.
*   **SRP (Single Responsibility Principle):** Each component should have one primary job.
*   **Accessibility First:** Design and build for everyone. Accessibility is a core requirement, not an afterthought.
*   **Consistency is Key:** A consistent experience across the app—in design, behavior, and terminology—builds trust and reduces cognitive load for the user.

---

## 5/ Icon Library Standard

**Use @radix-ui/react-icons exclusively** for all UI icons in this project.

### Rationale
- **Consistency**: 51+ components already use @radix-ui/react-icons
- **TypeScript Compatibility**: No type definition issues  
- **Integration**: Works seamlessly with Radix UI components (shadcn/ui)
- **Single Source**: Avoid mixing multiple icon libraries

### Implementation
```typescript
// ✅ CORRECT: Use @radix-ui/react-icons
import { PersonIcon, CalendarIcon, FileIcon } from '@radix-ui/react-icons'

// ❌ AVOID: Don't use lucide-react or other icon libraries
import { User, Calendar, File } from 'lucide-react'
```

### Common Icon Mappings
- User → PersonIcon
- Users → GroupIcon
- Search → MagnifyingGlassIcon  
- Filter → MixerHorizontalIcon
- ChevronDown → ChevronDownIcon
- Eye/EyeOff → EyeOpenIcon/EyeClosedIcon
- MoreHorizontal → DotsHorizontalIcon
- Check → CheckIcon
- Plus → PlusIcon

## 6/ Available tools in Claude Code CLI

Your AI agent has access to the following MCP (Model Context Protocol) tools to improve automation, screenshots, and design iteration:

- **Playwright MCP** : Browser automation for tests and screenshots. Execute JavaScript in a real browser. Analyze structure using accessibility data.
- **Context7 MCP** : Up-to-date documentation and code examples. Structured access to APIs and libraries.
- **Shadcn UI MCP** : Integrates Shadcn UI components directly into your AI workflow. Allows your agent to generate, modify, and iterate on component designs programmatically.Ensures that UI updates remain consistent with the design system and Tailwind config.