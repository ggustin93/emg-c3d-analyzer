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
The authentication system provides secure, role-based access control with a clear separation between authentication (who you are) and authorization (what you can do). Built on Supabase Auth with PostgreSQL RLS policies, it ensures data security at the database level.

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │───►  │   Supabase   │───►  │  Database   │
│   (React)   │ JWT  │     Auth     │ RLS  │    (RLS)    │
└─────────────┘      └──────────────┘      └─────────────┘
       │                                           │
       └────────── useAuth Hook ──────────────────┘
```

### 2.2 Architecture
- **Authentication**: Frontend with Supabase Auth (who you are)
- **Authorization**: Database RLS policies (what you can do)
- **Stack**: React 19 + Supabase Auth + FastAPI (JWT validation) + PostgreSQL RLS

### 2.3 Implementation

#### 2.3.1 Frontend (`useAuth` Hook)
- Direct Supabase integration
- Automatic session management with token refresh
- Full user profile fetching from `user_profiles` table
- Role-based UI rendering (not for security)

#### 2.3.2 Backend (`get_current_user`)
- JWT validation only (no authorization logic)
- Token pass-through for RLS enforcement
- Returns: `{'id': user_id, 'email': email, 'token': token}`

#### 2.3.3 Database (RLS Policies)
- Single source of truth for permissions
- Therapists: Access own patients only
- Admins: Full system access
- Researchers: Read-only access to anonymized data

### 2.4 User Roles
- **ADMIN**: Full system access
- **THERAPIST**: Own patients only
- **RESEARCHER**: Read-only anonymized data
- Frontend uses roles for UI only; RLS enforces actual permissions

### 2.5 Authentication Flow

```
User Login                API Request Flow
──────────                ─────────────────
                         
1. Credentials     ───►   1. React + JWT
2. Supabase Auth  ◄───    2. FastAPI validates
3. JWT + Session          3. Database RLS filters
4. Store in Hook          4. Filtered data returns
```

### 2.6 Key Practices
- JWT with automatic refresh
- RLS as primary authorization
- No client-side security logic
- Single `useAuth` hook for all auth needs
- TypeScript for type safety

### 2.7 Common Operations
```typescript
// Login
const { login } = useAuth()
await login(email, password)

// Logout
const { logout } = useAuth()
await logout()

// Check auth
const { user, userRole, userProfile } = useAuth()

// Protected routes handled by loaders
```


### 2.9 Troubleshooting
- **Invalid token**: Force logout and re-login
- **Email verification**: Check email for link
- **Role not loading**: Check user_profiles table
- **Session expired**: Automatic logout performed


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

### 4.1 When to Use Direct Supabase vs FastAPI

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

## Summary

This architecture provides a robust foundation for the EMG C3D Analyzer platform:

- **Navigation**: Fast, URL-based routing with React Router v7
- **Authentication**: Secure JWT-based auth with Supabase
- **Authorization**: Database-level RLS policies (single source of truth)
- **Architecture**: KISS principle - use the simplest tool for each job

For new team members: Start by understanding the navigation flow, then explore the authentication system, and finally dive into the specific domain logic (EMG processing) as needed.
