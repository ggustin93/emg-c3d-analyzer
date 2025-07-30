import { useState, useEffect, useCallback, useRef, useReducer } from 'react'
import { AuthService } from '../services/authService'
import { isSupabaseConfigured } from '../lib/supabase'
import { 
  storage, 
  withTimeout, 
  createInitialAuthState, 
  createLoggedOutState,
  createAuthenticatedState, 
  createErrorState,
  createDevAuthState,
  isDevBypassActive,
  saveAuthState,
  loadAuthState,
  formatAuthError,
  markAsLoggedIn,
  isMarkedAsLoggedIn,
  clearLoggedInStatus
} from '../utils/authUtils'
import type { AuthState, LoginCredentials, ResearcherRegistration, AuthResponse } from '../types/auth'
import { User, Session } from '@supabase/supabase-js'

// Auth state management types
type AuthAction = 
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: AuthState }
  | { type: 'INIT_ERROR'; payload: string }
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: AuthState }
  | { type: 'LOGIN_ERROR'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

// Auth state reducer for predictable state updates
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'INIT_START':
      return { ...state, loading: true, error: null };
    case 'INIT_SUCCESS':
      return { ...action.payload, loading: false, error: null };
    case 'INIT_ERROR':
      return { ...createLoggedOutState(), loading: false, error: action.payload };
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };
    case 'LOGIN_SUCCESS':
      return { ...action.payload, loading: false, error: null };
    case 'LOGIN_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'LOGOUT':
      return { ...createLoggedOutState(), loading: false, error: null };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

// Custom hook for timeout management
function useAuthTimeout() {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const startTimeout = useCallback((callback: () => void, delay: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(callback, delay);
    return timeoutRef.current;
  }, []);
  
  const clearAuthTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return { startTimeout, clearAuthTimeout };
}

// Custom hook for error handling
function useAuthErrorHandler() {
  const handleError = useCallback((error: unknown, context: string): string => {
    const formattedError = formatAuthError(error);
    console.error(`Auth error in ${context}:`, formattedError);
    
    if (formattedError.includes('timeout')) {
      return `Network timeout during ${context}. Please check your connection and try refreshing.`;
    }
    
    return formattedError;
  }, []);
  
  return { handleError };
}

// Custom hook for auth state listener
function useAuthStateListener(dispatch: React.Dispatch<AuthAction>) {
  const subscriptionRef = useRef<any>(null);
  
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    
    try {
      const { data: { subscription } } = AuthService.onAuthStateChange(async (event, session) => {
        console.log('🔐 Auth state change:', event, session?.user?.email || 'no user');
        
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const profileResponse = await AuthService.getResearcherProfile(session.user.id);
            const newAuthState = createAuthenticatedState(session.user, session, profileResponse.data);
            dispatch({ type: 'LOGIN_SUCCESS', payload: newAuthState });
            saveAuthState(newAuthState);
            markAsLoggedIn();
          } catch (profileError) {
            console.error('Failed to fetch profile after sign in:', profileError);
            dispatch({ type: 'INIT_ERROR', payload: 'Failed to load user profile' });
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('✅ Processing SIGNED_OUT event - clearing local storage');
          storage.clear();
          clearLoggedInStatus();
          dispatch({ type: 'LOGOUT' });
        }
      });
      
      subscriptionRef.current = subscription;
    } catch (err) {
      console.warn('Failed to set up auth state listener:', err);
    }
    
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [dispatch]);
}

// Custom hook for auth initialization
function useAuthInitialization(dispatch: React.Dispatch<AuthAction>, handleError: (error: unknown, context: string) => string) {
  const isInitializedRef = useRef(false);
  const { startTimeout, clearAuthTimeout } = useAuthTimeout();
  
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initializeAuth = async () => {
      dispatch({ type: 'INIT_START' });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 Initializing authentication...');
      }
      
      // Check for development bypass
      if (isDevBypassActive()) {
        console.log('✅ Development bypass active, setting dev auth state');
        dispatch({ type: 'INIT_SUCCESS', payload: createDevAuthState() });
        return;
      }

      // Check if Supabase is configured
      if (!isSupabaseConfigured()) {
        console.log('❌ Supabase not configured, setting error state');
        dispatch({ type: 'INIT_ERROR', payload: 'Authentication not configured. Please set up Supabase environment variables.' });
        return;
      }

      try {
        // Check simple logged-in status first
        if (isMarkedAsLoggedIn()) {
          const storedAuth = loadAuthState();
          if (storedAuth) {
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ User is marked as logged in, restored from cache:', storedAuth.user.email);
            }
            const restoredAuthState = {
              user: storedAuth.user,
              session: { access_token: 'cached' } as any,
              profile: storedAuth.profile,
              loading: false,
              error: null
            };
            dispatch({ type: 'INIT_SUCCESS', payload: restoredAuthState });
            return;
          }
        }

        // Get fresh auth state with longer timeout
        console.log('🔍 Checking Supabase authentication...');
        const [sessionResponse, userResponse] = await Promise.all([
          withTimeout(AuthService.getCurrentSession(), 8000, 'Session check timeout'),
          withTimeout(AuthService.getCurrentUser(), 8000, 'User check timeout')
        ]);

        if (sessionResponse.success && userResponse.success && userResponse.data && sessionResponse.data) {
          console.log('✅ Valid Supabase session found for user:', userResponse.data.email);
          const profileResponse = await AuthService.getResearcherProfile(userResponse.data.id);
          const newAuthState = createAuthenticatedState(
            userResponse.data, 
            sessionResponse.data, 
            profileResponse.data
          );
          dispatch({ type: 'INIT_SUCCESS', payload: newAuthState });
          saveAuthState(newAuthState);
        } else {
          console.log('❌ No valid Supabase session found, setting logged out state');
          dispatch({ type: 'LOGOUT' });
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        const errorMessage = handleError(err, 'initialization');
        dispatch({ type: 'INIT_ERROR', payload: errorMessage });
        if (!errorMessage.includes('timeout')) {
          storage.clear();
        }
      }
    };

    // Initialize with timeout fallback
    startTimeout(() => {
      dispatch({
        type: 'INIT_ERROR',
        payload: 'Authentication is taking longer than expected. Please try refreshing the page.'
      });
    }, 12000);

    initializeAuth()
      .catch(err => {
        console.error('Auth initialization failed:', err);
        dispatch({ type: 'INIT_ERROR', payload: 'Authentication initialization failed. Please refresh the page.' });
      })
      .finally(() => {
        clearAuthTimeout();
        dispatch({ type: 'SET_LOADING', payload: false });
      });

    return () => {
      clearAuthTimeout();
      // Don't reset isInitializedRef here - it should persist for component lifetime
    };
  }, [dispatch, handleError, startTimeout, clearAuthTimeout]);
}

/**
 * Modern authentication hook for EMG analysis application
 * Uses useReducer for predictable state management and separated concerns
 */
export const useAuth = () => {
  const [authState, dispatch] = useReducer(authReducer, createInitialAuthState())
  const { handleError } = useAuthErrorHandler()
  
  // Initialize authentication with separated concerns
  useAuthInitialization(dispatch, handleError)
  
  // Set up auth state listener
  useAuthStateListener(dispatch)

  // Login method
  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse<Session>> => {
    // If already authenticated, don't proceed
    if (authState.user) {
      console.log('Already authenticated, skipping login')
      return { 
        data: authState.session, 
        error: null, 
        success: true 
      }
    }
    
    dispatch({ type: 'LOGIN_START' })
    
    try {
      const response = await AuthService.login(credentials)
      
      if (response.success && response.data) {
        const [userResponse] = await Promise.all([
          AuthService.getCurrentUser()
        ])
        
        if (userResponse.success && userResponse.data) {
          const profileResponse = await AuthService.getResearcherProfile(userResponse.data.id)
          const newAuthState = createAuthenticatedState(userResponse.data, response.data, profileResponse.data)
          dispatch({ type: 'LOGIN_SUCCESS', payload: newAuthState })
          saveAuthState(newAuthState)
          markAsLoggedIn()
        }
      } else {
        dispatch({ type: 'LOGIN_ERROR', payload: response.error || 'Login failed' })
      }
      
      return response
    } catch (err) {
      const error = handleError(err, 'login')
      dispatch({ type: 'LOGIN_ERROR', payload: error })
      return { data: null, error, success: false }
    }
  }, [authState.user, authState.session, dispatch, handleError])

  // Logout method - follows standard Supabase pattern
  const logout = useCallback(async (): Promise<AuthResponse<void>> => {
    console.log('🚪 Starting logout process...');
    
    // Immediately clear local authentication flags
    console.log('🧹 Clearing local authentication state immediately');
    storage.clear();
    clearLoggedInStatus();
    
    // Update UI to show logout is happening
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      // Call Supabase signOut - this triggers SIGNED_OUT event
      // which is handled by onAuthStateChange listener
      console.log('🔄 Calling Supabase signOut...');
      const response = await AuthService.logout();
      
      if (response.success) {
        console.log('✅ Supabase signOut successful');
        // The SIGNED_OUT event will be handled by useAuthStateListener
        // which will dispatch LOGOUT action
        
        // Immediate logout dispatch to ensure UI updates quickly
        dispatch({ type: 'LOGOUT' });
        
        // Fallback: If no SIGNED_OUT event after 1 second, ensure we're fully logged out
        setTimeout(() => {
          if (authState.user) {
            console.log('⚠️ No SIGNED_OUT event received, ensuring full logout');
            storage.clear();
            clearLoggedInStatus();
            dispatch({ type: 'LOGOUT' });
          }
        }, 1000);
      } else {
        console.error('❌ Supabase signOut failed:', response.error);
        // Even if Supabase fails, complete local logout
        dispatch({ type: 'LOGOUT' });
      }
      
      return response;
    } catch (err) {
      const error = formatAuthError(err);
      console.error('❌ Logout error:', error);
      // Always complete local logout even if Supabase times out
      dispatch({ type: 'LOGOUT' });
      return { data: null, error: null, success: true }; // Treat as success for UX
    }
  }, [dispatch])

  // Register method
  const register = useCallback(async (data: ResearcherRegistration): Promise<AuthResponse<User>> => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    
    const response = await AuthService.register(data)
    
    if (!response.success) {
      dispatch({ type: 'SET_LOADING', payload: false })
      dispatch({ type: 'SET_ERROR', payload: response.error || 'Registration failed' })
    }
    
    return response
  }, [dispatch])

  // Refresh session method
  const refreshSession = useCallback(async (): Promise<AuthResponse<Session>> => {
    const response = await AuthService.refreshSession()
    
    if (response.success && response.data) {
      // Update the current auth state with new session
      dispatch({ type: 'LOGIN_SUCCESS', payload: { ...authState, session: response.data } })
    }
    
    return response
  }, [authState, dispatch])

  // Reset password method
  const resetPassword = useCallback(async (email: string): Promise<AuthResponse<void>> => {
    return AuthService.resetPassword(email)
  }, [])

  // Check auth status method
  const checkAuthStatus = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      return { isAuthenticated: false, error: 'Authentication not configured' }
    }

    try {
      const [sessionResponse, userResponse] = await Promise.all([
        AuthService.getCurrentSession(),
        AuthService.getCurrentUser()
      ])

      if (sessionResponse.success && userResponse.success && userResponse.data && sessionResponse.data) {
        const profileResponse = await AuthService.getResearcherProfile(userResponse.data.id)
        const newAuthState = createAuthenticatedState(userResponse.data, sessionResponse.data, profileResponse.data)
        dispatch({ type: 'LOGIN_SUCCESS', payload: newAuthState })
        saveAuthState(newAuthState)
        return { isAuthenticated: true, error: null }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false })
        return { isAuthenticated: false, error: 'No valid session found' }
      }
    } catch (err) {
      const error = handleError(err, 'auth status check')
      dispatch({ type: 'SET_LOADING', payload: false })
      dispatch({ type: 'SET_ERROR', payload: error })
      return { isAuthenticated: false, error }
    }
  }, [dispatch, handleError])

  const isAuthenticated = !!authState.user
  const isLoading = authState.loading

  return {
    authState,
    login,
    logout,
    register,
    refreshSession,
    resetPassword,
    checkAuthStatus,
    isAuthenticated,
    isLoading
  }
}