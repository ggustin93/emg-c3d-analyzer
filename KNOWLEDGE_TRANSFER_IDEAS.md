# EMG C3D Analyzer - System Architecture Documentation

This document provides essential knowledge transfer for the EMG C3D Analyzer platform, focusing on the core systems that enable rehabilitation therapy through EMG data analysis. Our architecture emphasizes simplicity, security, and performance.

## Table of Contents

1. [Navigation System](#1-navigation-system)
2. [Authentication System](#2-authentication-system)
3. [Database & RLS Policies](#3-database--rls-policies)
4. [Architecture Decisions](#4-architecture-decisions)

---

## 1. Navigation System

### 1.1 Overview
The navigation system provides seamless, URL-based routing throughout the application. Built on React Router v7, it ensures fast transitions (<200ms) and intuitive browser behavior with proper back/forward button support.

```
┌─────────────┐     ┌──────────┐     ┌─────────────┐
│   Browser   │────▶│  Router  │────▶│  Component  │
│     URL     │     │  Loader  │     │   Render    │
└─────────────┘     └──────────┘     └─────────────┘
                          │
                    Pre-fetch Data
```

### 1.2 Core Architecture
- **React Router v7**: Declarative routing with loaders and actions
- **URL-based navigation**: Routes as single source of truth
- **SSR-ready**: Prepared for server-side rendering

### 1.3 Key Components

#### 1.3.1 Route Structure (`/src/App.tsx`)
```typescript
createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    loader: rootLoader,
    errorElement: <ErrorBoundary />,
    children: [
      { path: 'login', element: <PublicLayout />, ... },
      { path: 'dashboard', element: <DashboardLayout />, ... },
      { path: 'analysis', element: <DashboardLayout />, ... },
      { path: 'logout', loader: logoutAction }
    ]
  }
])
```

#### 1.3.2 Data Loading (`/src/routes/loaders.ts`)
- **rootLoader**: Fetches auth state for entire application
- **protectedLoader**: Guards protected routes, redirects if unauthenticated
- **publicLoader**: Redirects authenticated users from login page

#### 1.3.3 Form Actions (`/src/routes/actions.ts`)
- **loginAction**: Handles authentication form submission
- **logoutAction**: Clears session and redirects

### 1.4 Layout System
1. **RootLayout**: Base layout providing auth context
2. **PublicLayout**: Unauthenticated pages with header (login)
3. **DashboardLayout**: Authenticated pages with full header and footer

### 1.5 Navigation Flow

### 1.6 Implementation Patterns

#### 1.6.1 Protected Route Pattern
```typescript
export async function protectedLoader() {
  const authData = await AuthService.getAuthData()
  if (!authData.session) {
    const from = window.location.pathname
    throw redirect(`/login?from=${encodeURIComponent(from)}`)
  }
  return authData
}
```

#### 1.6.2 Form Handling
```tsx
// LoginPage.tsx
import { Form, useActionData, useNavigation } from 'react-router-dom'

<Form method="post">
  <input name="email" type="email" required />
  <input name="password" type="password" required />
  <Button type="submit" disabled={navigation.state === 'submitting'}>
    Sign In
  </Button>
</Form>
```

#### 1.6.3 Error Handling
- **ErrorBoundary component**: Graceful 404 and error pages
- **User-friendly messages**: Clear navigation options
- **Fallback routes**: Always provide path back to dashboard

### 1.7 Performance
- Route transitions: <200ms
- No flash of unauthorized content
- URL-driven state (back/forward buttons work)

### 1.8 Routes
- **Public**: `/`, `/login`, `/logout`
- **Protected**: `/dashboard` (role-based), `/analysis?file=<name>&date=<date>`

### 1.9 Auth Integration
```typescript
function Dashboard() {
  const { userRole } = useOutletContext()
  
  switch (userRole) {
    case 'admin': return <AdminDashboard />
    case 'therapist': return <TherapistDashboard />
    case 'researcher': return <ResearcherDashboard />
  }
}
```

### 1.10 Quick Reference
```typescript
// Navigate programmatically
const navigate = useNavigate()
navigate('/dashboard')
navigate('/analysis?file=test.c3d')

// React Router Links
<Link to="/dashboard">Dashboard</Link>

// Logout flow
navigate('/logout')  // → logoutAction → redirect
```


---

## 2. Authentication System

### 2.1 Overview
The authentication system provides secure, role-based access control following SOLID/SSoT/DRY/KISS principles. Built with clean architecture that eliminates dual auth systems, ensuring consistent authentication state throughout the application.

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │───►  │   Supabase   │───►  │  Database   │
│   (React)   │ JWT  │     Auth     │ RLS  │    (RLS)    │
└─────────────┘      └──────────────┘      └─────────────┘
       │                     │                     │
   useAuth Hook         authUtils.ts         RLS Policies
   (React State)      (Single Source)      (Authorization)
```

### 2.2 Clean Architecture (Jan 2025)
- **Authentication**: Supabase Auth via shared utility (who you are)
- **Authorization**: Database RLS policies (what you can do) 
- **Stack**: React 19 + authUtils.ts + Supabase Auth + FastAPI (validation) + PostgreSQL RLS
- **Principles**: Eliminated dual auth systems, implemented Single Source of Truth

### 2.3 Architecture Components

#### 2.3.1 Shared Auth Utility (`/lib/authUtils.ts`) - **NEW**
- **Single Source of Truth**: All auth operations go through this utility
- **Direct Supabase Integration**: Fresh session data from authoritative source
- **Exported Functions**: `getCurrentSession()`, `getAuthData()`, `login()`, `logout()`, `isAuthenticated()`
- **Error Handling**: Standardized error responses across all auth operations
- **No Caching**: Always fetch fresh auth state to avoid synchronization issues

#### 2.3.2 React Hook (`useAuth`) - **UPDATED**
- **React State Management**: Manages component state and loading states
- **Session Updates**: Listens to Supabase onAuthStateChange events
- **Profile Integration**: Fetches user profiles from `user_profiles` table
- **Role-based UI**: Provides user role for frontend rendering (not security)
- **Delegates Auth Operations**: Uses shared authUtils for all auth calls

#### 2.3.3 Route Loaders (`/routes/loaders.ts`) - **UPDATED**
- **Navigation Control**: Uses authUtils for navigation decisions
- **Fresh Auth Checks**: No cached session data, always current state
- **Redirect Logic**: Handles login/logout redirects based on auth status
- **Data Preloading**: Fetches user data for authenticated routes

#### 2.3.4 Backend (`get_current_user`) - **UNCHANGED**
- **JWT Validation Only**: No authorization logic, delegates to RLS
- **Token Pass-through**: Enables RLS enforcement at database level
- **Returns**: `{'id': user_id, 'email': email, 'token': token}`

#### 2.3.5 Database (RLS Policies) - **UNCHANGED**
- **Single Source of Truth**: All authorization happens at database level
- **Role-based Access**: Therapists (own patients), Admins (full), Researchers (read-only)
- **Data Security**: All queries automatically filtered by user permissions

### 2.4 User Roles
- **ADMIN**: Full system access
- **THERAPIST**: Own patients only
- **RESEARCHER**: Read-only anonymized data
- Frontend uses roles for UI only; RLS enforces actual permissions

### 2.5 Clean Architecture Flow (Jan 2025)

```
Login Flow                    Logout Flow                API Request Flow
──────────                    ───────────                ─────────────────
                                                      
1. Credentials        ───►    1. Logout Button   ───►   1. Component Request
2. authUtils.login()          2. useAuth.logout()       2. authUtils Check
3. Supabase Auth              3. authUtils.logout()     3. Fresh Session
4. onAuthStateChange          4. Supabase signOut       4. FastAPI Validates
5. useAuth Updates            5. Navigation Trigger     5. Database RLS
6. UI Re-render               6. Route Loader           6. Filtered Data
                              7. Redirect to Login
```

### 2.6 Critical Implementation Rules

**✅ Single Source of Truth Pattern**:
```typescript
// ✅ ALWAYS use shared auth utility in services/loaders
import { getCurrentSession, login, logout } from '@/lib/authUtils';
const { session, user, error } = await getCurrentSession();

// ✅ ALWAYS use useAuth hook in React components
const { user, session, loading, logout } = useAuth();

// ❌ NEVER use direct Supabase calls in components/services
const { data: { session } } = await supabase.auth.getSession();
```

**✅ Proper Component Usage**:
```typescript
// ✅ CORRECT: React components use useAuth hook
const { user, session, loading, logout } = useAuth();
if (loading) return <LoadingSpinner />;
if (!user) return <LoginPage />;

// ✅ CORRECT: Services/loaders use authUtils directly
export async function protectedLoader() {
  const { session, error } = await getAuthData();
  if (!session) throw redirect('/login');
  return { session, user: session.user };
}

// ❌ WRONG: Don't call auth utilities directly in components
const handleLogout = async () => {
  await logout(); // ❌ Bypasses React state management
  navigate('/login'); // ❌ Navigation should be in utility
};
```

### 2.7 Architecture Decision Benefits

**Before (Dual Auth Systems - PROBLEMS)**:
- AuthService with 30-second session cache
- useAuth hook with separate session management 
- Synchronization issues causing logout failures
- Complex debugging due to multiple auth sources

**After (Single Source of Truth - SOLUTIONS)**:
- authUtils.ts as single source for all auth operations
- useAuth delegates to authUtils for operations
- Route loaders use authUtils for fresh auth checks
- Eliminated cache synchronization complexity
- Clean logout flow: Supabase → navigation → success

### 2.8 Common Operations
```typescript
// Login (components use useAuth)
const { login } = useAuth()
await login(email, password)

// Logout (components use useAuth - navigation handled automatically)
const { logout } = useAuth()
await logout()

// Check auth state (components)
const { user, userRole, userProfile, loading } = useAuth()

// Auth checks (services/loaders use authUtils directly)
import { isAuthenticated, getAuthData } from '@/lib/authUtils'
const authData = await getAuthData()
if (!authData.session) redirect('/login')
```


### 2.9 Troubleshooting

#### 2.9.1 Common Issues
- **Invalid token**: Force logout and re-login via `useAuth.logout()`
- **Email verification**: Check email for verification link
- **Role not loading**: Check user_profiles table and profile fetching
- **Session expired**: Automatic logout performed by onAuthStateChange

#### 2.9.2 Auth Refactor Issues (Jan 2025)
- **Logout not redirecting**: Ensure using updated authUtils.ts, not old AuthService
- **Import errors**: Check for broken AuthService imports after refactor
- **Session inconsistency**: All auth calls must go through authUtils.ts
- **Navigation issues**: Route loaders should use authUtils.getAuthData()

#### 2.9.3 Development vs Production
- **API calls**: Always use `API_CONFIG.baseUrl`, never hardcode `/api` or localhost
- **Environment variables**: Set `VITE_API_URL` for production deployment
- **Proxy behavior**: Development uses Vite proxy, production calls direct URLs


### 2.10 Architecture Decision: Direct Supabase vs FastAPI

**Use Direct Supabase for**:
- Simple CRUD operations
- Real-time subscriptions
- File storage
- Auth state management

**Use FastAPI for**:
- EMG signal processing
- Complex computations
- External API integrations
- Heavy algorithms (NumPy, SciPy)

---

## 3. Database & RLS Policies

Row Level Security (RLS) serves as the single source of truth for authorization. All data access is filtered at the database level based on user roles and relationships.

### 3.1 Core RLS Pattern
```sql
-- Example: Therapists see only their patients
CREATE POLICY "therapist_own_patients" ON patients
FOR SELECT USING (therapist_id = auth.uid());

-- Storage: Files organized by patient code
public.user_owns_patient(split_part(name, '/', 1))
```

### 3.2 Policy Documentation
See `docs/DATABASE_FUNCTIONS_AND_RLS.md` for complete RLS implementation.

---

## 4. Architecture Decisions

### 4.1 API Routing Architecture (Sep 2025)

**Standard Approach**: Frontend uses `/api/*` prefix → Vite proxy strips `/api` → Backend serves without prefix

This architecture provides clean separation of concerns while maintaining consistency across the stack.

```
Frontend                 Vite Proxy              Backend
────────                 ──────────              ───────
/api/clinical-notes  →   Strip /api   →   /clinical-notes
/api/therapists      →   Strip /api   →   /therapists
/api/scoring         →   Strip /api   →   /scoring
```

**Implementation Details**:
- **Frontend**: Always uses `/api/*` pattern (consistency)
- **Vite Proxy**: Strips `/api` prefix via rewrite rule
- **Backend**: ALL routes serve without `/api` prefix (simplicity)

**Principle-Based Reasoning**:
- ✅ **KISS**: Only 4 lines changed to standardize
- ✅ **DRY**: Single proxy rule handles all routes
- ✅ **SOLID**: Each layer has single responsibility
- ✅ **YAGNI**: Don't add `/api` where not needed
- ✅ **SSoT**: Backend consistently has NO `/api` prefix

### 4.2 Critical Lesson: Inconsistent API Patterns (Sep 2025)

**🚨 Production Issue: Vercel Deployment Failures**

**Symptoms**: FAQ and About pages returning 404 errors, missing content on Vercel production deployment while development worked perfectly.

**Root Cause**: Three distinct API calling patterns coexisting in the frontend codebase:
1. **✅ Correct**: `API_CONFIG.baseUrl` usage (7 files) - environment-aware
2. **❌ Broken**: Hardcoded `/api` prefix (3 critical files) - production 404s
3. **⚠️ Unpredictable**: Hardcoded localhost URLs (1 file) - dev-only

**Why "Some Routes Worked"**: Upload functionality used the correct `API_CONFIG` pattern while FAQ/About content loading used hardcoded `/api` patterns. This partial functionality masked the root cause during development testing.

**Critical Files That Failed**:
- `useScoringConfiguration.ts`: 6 hardcoded `/api` calls
- `logger.ts`: Hardcoded `/api/logs/frontend`
- `adherenceService.ts`: Hardcoded localhost URL

**Architecture Violation**: Multiple API patterns violated the Single Source of Truth principle, creating hidden production failures.

**Prevention Strategy**:
```typescript
// ✅ ALWAYS use this pattern - environment-aware
import { API_CONFIG } from '@/config/apiConfig';
const response = await fetch(`${API_CONFIG.baseUrl}/scoring/configurations/active`);

// ❌ NEVER use these patterns - will break in production
fetch('/api/scoring/configurations/active')  // Hardcoded /api
fetch('http://localhost:8080/endpoint')      // Hardcoded localhost
```

**Key Lessons**:
1. **Partial functionality is misleading** - some routes working doesn't mean all patterns are correct
2. **Environment awareness is critical** - dev proxy vs production direct calls
3. **Single Source of Truth must be enforced** - one way to call APIs across entire codebase
4. **Integration testing gap** - need tests without Vite proxy to catch production issues

**Detection Strategy**: Grep for hardcoded API patterns during code review:
```bash
grep -r "fetch('/api" src/
grep -r "localhost:8080" src/
grep -r "http://" src/ | grep -v "http://localhost"
```

### 4.3 When to Use Direct Supabase vs FastAPI

Our architecture follows the KISS principle - use the simplest tool that solves the problem.

```
Decision Tree
─────────────
                    
Is it computational?  ──Yes──► FastAPI
        │                     (EMG, C3D, NumPy)
        No
        ▼
Is it simple CRUD?   ──Yes──► Direct Supabase
        │                     (Notes, profiles)
        No
        ▼
    FastAPI
```

**Direct Supabase**: Auth, CRUD, real-time, storage  
**FastAPI**: EMG processing, C3D parsing, heavy computation, webhooks

---

## 5. Optimization Opportunities

### 5.1 Clinical Notes API Optimization

**Current State**: The clinical notes system now uses a simplified direct Supabase approach for loading notes counts (single query vs 71 queries), but the modal still uses the FastAPI backend for CRUD operations.

**Opportunity**: Consider migrating the Clinical Notes API to direct Supabase operations.

**Assessment**:
- **Modal CRUD operations**: Currently use `/api/clinical_notes/` endpoints
- **Complexity**: Simple CRUD operations (create, read, update, delete)
- **Real-time potential**: Could benefit from Supabase real-time subscriptions
- **Performance**: Direct client operations vs FastAPI round-trip

**Implementation Considerations**:
- Clinical notes CRUD operations are simple database operations
- RLS policies already secure data access appropriately  
- Direct Supabase would enable real-time updates across users
- Would eliminate FastAPI dependency for this feature
- Could reduce API surface area and simplify deployment

**Decision**: The current FastAPI implementation is working well and provides a clear API contract. This optimization could be considered for future iterations if real-time collaboration or further simplification becomes a priority.

---

## Summary

This architecture provides a robust foundation for the EMG C3D Analyzer platform:

- **Navigation**: Fast, URL-based routing with React Router v7
- **Authentication**: Secure JWT-based auth with Supabase
- **Authorization**: Database-level RLS policies (single source of truth)
- **Architecture**: KISS principle - use the simplest tool for each job

For new team members: Start by understanding the navigation flow, then explore the authentication system, and finally dive into the specific domain logic (EMG processing) as needed.
