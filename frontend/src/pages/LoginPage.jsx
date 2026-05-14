/**
 * LoginPage - Premium UI with Raisin & Caramel Theme
 * High-contrast sign in/sign up with proper focus states and interactions
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { hasSupabaseConfig, signInWithEmail, signUpWithEmail, signInWithGoogle } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      console.log('[LoginPage] Starting Google sign-in...');
      const result = await signInWithGoogle();
      console.log('[LoginPage] Sign-in result:', result);

      if (!result.success) {
        setError(result.error || 'Google sign in failed');
        setGoogleLoading(false);
        return;
      }

      // OAuth should redirect automatically, but if not, show error
      setTimeout(() => {
        if (googleLoading) {
          setError('Redirect did not happen. Please check if Google OAuth is configured in Supabase Dashboard.');
          setGoogleLoading(false);
        }
      }, 5000);
    } catch (err) {
      console.error('[LoginPage] Google sign-in error:', err);
      setError(err.message || 'An error occurred');
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/chat/new', { replace: true });
    }
  }, [isLoading, navigate, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        // Validate passwords match
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        // Validate password strength
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          setLoading(false);
          return;
        }

        const result = await signUpWithEmail(email, password);

        if (!result.success) {
          setError(result.error || 'Sign up failed');
          return;
        }

        // Check if email confirmation is required
        if (result.requiresConfirmation) {
          setSuccess('Check your email for a confirmation link.');
          setMode('signin');
        } else {
          navigate('/chat/new', { replace: true });
        }
      } else {
        const result = await signInWithEmail(email, password);

        if (!result.success) {
          setError(result.error || 'Sign in failed');
          return;
        }

        navigate('/chat/new', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setConfirmPassword('');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="text-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md space-y-8"
      >
        {/* Logo and Title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-center"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center bg-gradient-to-br from-caramel/20 to-caramel/10 rounded-2xl border border-caramel/30"
          >
            <svg
              className="h-8 w-8 text-caramel"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </motion.div>
          <h1 className="text-3xl font-bold font-headline text-foreground">VisuaLearn</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI-powered interactive learning
          </p>
        </motion.div>

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="rounded-2xl bg-card/50 border border-border/40 backdrop-blur-sm shadow-lg p-8 space-y-6"
        >
          {/* Tab Navigation */}
          <div className="flex gap-3 p-1 bg-background/50 rounded-xl border border-border/40">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2.5 min-h-[44px] text-sm font-semibold transition-all rounded-lg ${mode === 'signin'
                  ? 'bg-gradient-to-br from-caramel to-caramel-dark text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Sign In
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2.5 min-h-[44px] text-sm font-semibold transition-all rounded-lg ${mode === 'signup'
                  ? 'bg-gradient-to-br from-caramel to-caramel-dark text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Sign Up
            </motion.button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}

            {/* Success Message */}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-600 dark:text-green-400"
              >
                {success}
              </motion.div>
            )}

            {/* Supabase Warning */}
            {!hasSupabaseConfig && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-700 dark:text-amber-300">
                Supabase is not configured. Add <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> to your environment.
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-background/50 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-caramel/50 focus:border-caramel/30 focus:bg-background transition-all duration-200"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-foreground mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full px-4 py-3 bg-background/50 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-caramel/50 focus:border-caramel/30 focus:bg-background transition-all duration-200"
              />
            </div>

            {/* Confirm Password (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-foreground mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 bg-background/50 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-caramel/50 focus:border-caramel/30 focus:bg-background transition-all duration-200"
                />
              </div>
            )}

            {/* Submit Button - HIGH CONTRAST */}
            <motion.button
              whileHover={{ scale: 1.02, y: -2, boxShadow: '0 10px 25px -5px rgba(200, 119, 64, 0.3)' }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={loading || !hasSupabaseConfig}
              className="w-full px-6 py-3 min-h-[48px] text-lg font-bold bg-gradient-to-br from-caramel to-caramel-dark text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : mode === 'signup' ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </motion.button>

            {/* Divider - LIGHTER TEXT */}
            <div className="relative my-6">
              <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-card px-3 text-xs uppercase text-muted-foreground/70 tracking-wider">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In - Updated Styling */}
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || !hasSupabaseConfig}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 min-h-[48px] font-semibold text-foreground bg-background/50 border border-border/40 rounded-lg hover:border-border/60 hover:bg-card/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              <span>Google</span>
            </motion.button>

            {/* Mode Switch Text */}
            <p className="text-center text-sm text-muted-foreground pt-2">
              {mode === 'signin' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="font-semibold text-caramel hover:text-caramel-dark transition-colors"
                  >
                    Sign up
                  </motion.button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="font-semibold text-caramel hover:text-caramel-dark transition-colors"
                  >
                    Sign in
                  </motion.button>
                </>
              )}
            </p>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}
