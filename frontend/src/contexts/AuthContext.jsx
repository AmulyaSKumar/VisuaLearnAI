/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { getSession, onAuthStateChange } from '../lib/supabase';

/**
 * AuthContext: Manages user authentication state
 * Provides user, session, and auth methods to entire app
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChange((event, newSession) => {
      console.log('[AuthContext] Auth state changed:', event, newSession?.user?.email);

      if (!isMounted) {
        return;
      }

      setSession(newSession);
      setUser(newSession?.user || null);
      setError(null);

      // Important: Set loading to false when we get auth state
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setIsLoading(false);
      }
    });

    async function initAuth() {
      console.log('[AuthContext] Initializing auth...');
      try {
        const { session: initialSession, user: initialUser, error: sessionError } = await getSession();
        console.log('[AuthContext] Got session:', initialUser?.email || 'no user', sessionError);

        if (!isMounted) {
          return;
        }

        setSession(initialSession);
        setUser(initialUser);
        setError(sessionError || null);
      } catch (err) {
        console.error('[AuthContext] Auth initialization error:', err);

        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          console.log('[AuthContext] Auth loading complete');
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    isLoading,
    error,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook: useAuth
 * Access auth state anywhere in the app
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

export default AuthProvider;
