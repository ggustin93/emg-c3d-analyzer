# Task: Fix Logout Redirect Issue

**Status**: `done`  
**Priority**: 🔴 High  
**Created**: 2024-01-17  
**Assignee**: Frontend Team  

## Problem Statement

Users clicking the logout button are not being redirected to the login page. The logout partially works (clears state) but fails with a 403 error and doesn't navigate.

### Error Log
```
POST https://egihfsmxphqcsjotmhmm.supabase.co/auth/v1/logout?scope=global 403 (Forbidden)
useAuth.ts:327 [Auth] Logout error: AuthSessionMissingError: Auth session missing!
```

## Root Cause Analysis

### Issue 1: Order of Operations Bug
**Location**: `src/hooks/useAuth.ts` lines 316-324  
**Problem**: State is cleared BEFORE calling `supabase.auth.signOut()`, causing session to be null when logout API is called.

### Issue 2: No Navigation Trigger  
**Location**: `src/components/auth/UserProfile.tsx` line 60-61  
**Problem**: Comment says "let route guards handle navigation" but React Router loaders only run on navigation events.

### Issue 3: Logout Route Not Used
**Location**: `src/App.tsx` lines 320-323  
**Problem**: We created `/logout` route but nothing navigates to it. Button calls `logout()` directly.

## Solution Design

### Option A: Simple Navigation Fix (RECOMMENDED) ✅
**Effort**: 1 minute  
**Risk**: Low  
**Principles**: KISS, DRY  

```typescript
// src/components/auth/UserProfile.tsx - line 58
if (result.error) {
  logger.error(LogCategory.AUTH, 'Logout failed:', result.error);
} else {
  logger.info(LogCategory.AUTH, 'Logout successful');
}
navigate('/login');  // ADD THIS LINE - Force navigation to trigger redirect
```

### Option B: Use Logout Route
**Effort**: 5 minutes  
**Risk**: Medium  
**Principles**: SSoT  

```typescript
// src/components/auth/UserProfile.tsx
const handleLogout = async () => {
  setIsLoggingOut(true);
  setShowLogoutDialog(false);
  navigate('/logout');  // Navigate to logout route instead of calling logout()
  // Remove direct logout() call
};
```

### Option C: Fix Order + Navigation
**Effort**: 10 minutes  
**Risk**: Medium  
**Principles**: Correctness  

1. Fix `useAuth.ts` - call signOut BEFORE clearing state:
```typescript
// Line 323 - Move BEFORE state clearing
const { error } = await supabase.auth.signOut()

// Lines 316-321 - Move AFTER signOut
startAuthTransition(() => {
  setUser(null)
  setSession(null)
  setUserProfile(null)
  setUserRole(null)
})
```

2. Add navigation in UserProfile.tsx (same as Option A)

## Implementation Steps

### For Option A (Recommended):

1. **Open File**: `src/components/auth/UserProfile.tsx`
2. **Find Line**: 58 (after `logger.info('Logout successful')`)
3. **Add Code**: `navigate('/login');`
4. **Test**: 
   - Click logout button
   - Verify redirect to login page
   - Check console for errors

### Validation Checklist

- [ ] Logout button clicked
- [ ] User session cleared
- [ ] Browser redirects to `/login`
- [ ] No 403 errors in console
- [ ] Can log back in successfully

## Testing Script

```bash
# 1. Start dev environment
npm run dev

# 2. Test logout flow
# - Login as test user
# - Click logout button
# - Verify redirect to login
# - Check browser console for errors

# 3. Build verification
npm run build
npm run test
```

## Rollback Plan

If issues occur, revert the single line change:
```bash
git diff src/components/auth/UserProfile.tsx
git checkout -- src/components/auth/UserProfile.tsx
```

## Notes

- The 403 error is non-blocking (Supabase returns error when no session exists)
- Option A is preferred for simplicity and immediate fix
- Future consideration: Implement proper auth state machine

## Success Criteria

✅ User clicks logout → Redirects to `/login` page  
✅ No blocking errors in console  
✅ Auth state properly cleared  
✅ Can login again after logout  

---

**Next Status**: `wip` (when starting implementation)