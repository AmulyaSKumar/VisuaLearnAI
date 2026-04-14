/**
 * Authentication Hook
 * Wraps Supabase auth session and provides auth utilities
 * @module hooks/useAuth
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Auth context for providing auth state to the component tree
 */
const AuthContext = createContext(null);

/**
 * Auth state shape
 * @typedef {Object} AuthState
 * @property {Object|null} user - Current authenticated user
 * @property {Object|null} session - Current session with access token
 * @property {boolean} loading - Whether auth state is being loaded
 * @property {string|null} error - Auth error message if any
 */

/**
 * Auth actions shape
 * @typedef {Object} AuthActions
 * @property {function} signIn - Sign in with email/password
 * @property {function} signUp - Sign up with email/password
 * @property {function} signOut - Sign out current user
 * @property {function} getAccessToken - Get current access token for API calls
 */

/**
 * Custom hook to manage Supabase authentication state
 * @returns {AuthState & AuthActions}
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Initialize auth state and listen for changes
   */
  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Failed to get session:', sessionError.message);
          setError(sessionError.message);
        } else if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user || null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user || null);
          setError(null);

          // Log auth events for debugging
          console.debug(`Auth event: ${event}`, currentSession?.user?.id);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Sign in with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const signIn = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return { success: false, error: signInError.message };
      }

      setSession(data.session);
      setUser(data.user);

      return { success: true };
    } catch (err) {
      const errorMessage = err.message || 'Sign in failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sign up with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {Object} metadata - Optional user metadata
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const signUp = useCallback(async (email, password, metadata = {}) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return { success: false, error: signUpError.message };
      }

      // Note: User may need to confirm email before session is created
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }

      return { success: true, user: data.user };
    } catch (err) {
      const errorMessage = err.message || 'Sign up failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sign out current user
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const signOut = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError(signOutError.message);
        return { success: false, error: signOutError.message };
      }

      setSession(null);
      setUser(null);

      return { success: true };
    } catch (err) {
      const errorMessage = err.message || 'Sign out failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get current access token for API calls
   * @returns {Promise<string|null>}
   */
  const getAccessToken = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      return currentSession?.access_token || null;
    } catch (err) {
      console.error('Failed to get access token:', err);
      return null;
    }
  }, []);

  /**
   * Refresh session if needed
   * @returns {Promise<boolean>}
   */
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error('Session refresh failed:', refreshError.message);
        return false;
      }

      if (refreshedSession) {
        setSession(refreshedSession);
        setUser(refreshedSession.user);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Session refresh error:', err);
      return false;
    }
  }, []);

  return {
    user,
    session,
    loading,
    error,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    getAccessToken,
    refreshSession,
  };
}

/**
 * Auth Provider component
 * Provides auth state to the component tree via context
 */
export function AuthProvider({ children }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 * Must be used within AuthProvider
 */
export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}

/**
 * Create an authenticated fetch function
 * Automatically attaches Bearer token to requests
 * @param {function} getToken - Function to get access token
 * @returns {function} Authenticated fetch function
 */
export function createAuthenticatedFetch(getToken) {
  return async function authenticatedFetch(url, options = {}) {
    const token = await getToken();

    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  };
}

/**
 * Hook that provides an authenticated fetch function
 * @returns {function} Authenticated fetch function
 */
export function useAuthenticatedFetch() {
  const { getAccessToken, isAuthenticated } = useAuth();

  const authFetch = useCallback(async (url, options = {}) => {
    if (!isAuthenticated) {
      throw new Error('User is not authenticated');
    }

    const token = await getAccessToken();

    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 responses
    if (response.status === 401) {
      // Token may have expired, trigger re-auth
      throw new Error('Session expired. Please sign in again.');
    }

    return response;
  }, [getAccessToken, isAuthenticated]);

  return authFetch;
}

export default useAuth;
