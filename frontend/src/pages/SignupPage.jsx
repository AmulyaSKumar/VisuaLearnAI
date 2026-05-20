import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUpWithEmail } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LogoMark from '../components/LogoMark';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  // Redirect if already authenticated
  if (!isLoading && user) {
    navigate('/chat/new');
    return null;
  }

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    // Validate inputs
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await signUpWithEmail(email, password);

    if (!result.success) {
      setError(result.error || 'Signup failed');
      setLoading(false);
      return;
    }

    // Success - redirect to login
    navigate('/login?message=Check your email to confirm your account');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="text-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-md space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-[0_18px_50px_rgba(17,17,17,0.06)]">
            <LogoMark className="h-9 w-9 text-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">VisuaLearn</h1>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
            Create your personal study workspace
          </p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-4 sm:space-y-6 rounded-lg border border-border bg-card p-4 sm:p-8 shadow-lg">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">Create Account</h2>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              At least 6 characters
            </p>
          </div>

          {/* Confirm Password Input */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-3 sm:py-2 min-h-[44px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          {/* Sign In Link */}
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>

        {/* Info */}
        <div className="rounded-lg border border-border/50 bg-card/50 p-3 sm:p-4 text-xs text-muted-foreground">
          <p className="mb-2 font-semibold">What happens next?</p>
          <ul className="space-y-1">
            <li>Confirm your email address</li>
            <li>Create your learning profile</li>
            <li>Start personalized lessons</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
