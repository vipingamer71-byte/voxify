import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { VoxifyLogo } from './VoxifyLogo';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'login' | 'signup' | 'forgot';

export const AuthGate: React.FC = () => {
  const {
    user,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    resendVerification,
    refreshVerification,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Email verification gate for unverified email/password signups
  if (user && !user.emailVerified) {
    return (
      <div className="min-h-screen bg-[#07070B] text-slate-100 flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.18),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(34,211,238,0.10),transparent_48%)]">
        <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0D0E17]/95 backdrop-blur-xl p-7 shadow-2xl space-y-5">
          <VoxifyLogo />

          <div className="space-y-2">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-400/30">
              <Mail className="h-5 w-5 text-cyan-300" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-white">
              Verify your email
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              We sent a verification link to{' '}
              <span className="text-white font-medium">{user.email}</span>. Click the link in your
              inbox to unlock your encrypted VOXIFY workspace and Firestore sync.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-3 text-xs text-cyan-200">
              <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                setNotice(null);
                try {
                  const ok = await refreshVerification();
                  if (!ok) {
                    setError('Email is not verified yet. Open the verification link in your inbox first.');
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Unable to refresh verification.');
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              I&apos;ve Verified — Refresh Status
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                setNotice(null);
                try {
                  await resendVerification();
                  setNotice('Verification email resent. Check your inbox and spam folder.');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Unable to resend email.');
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
            >
              Resend Verification Email
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out & Use Another Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        await signUpWithEmail(name, email, password);
      } else {
        await sendPasswordReset(email);
        setNotice('Password reset link sent. Check your inbox to set a new password.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070B] text-slate-100 flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.18),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(34,211,238,0.10),transparent_48%)]">
      <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0D0E17]/95 backdrop-blur-xl p-7 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <VoxifyLogo />
          <span className="text-[11px] text-slate-400">Your Voice. Your Intelligence.</span>
        </div>

        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            {mode === 'login'
              ? 'Sign in to VOXIFY'
              : mode === 'signup'
                ? 'Create your workspace'
                : 'Reset password'}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {mode === 'login'
              ? 'Access your synced voice transcripts, AI conversations, and custom modes.'
              : mode === 'signup'
                ? 'Start with an isolated cloud workspace powered by Firebase and Gemini.'
                : 'Enter your account email and we will send a secure password reset link.'}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200 leading-relaxed">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-3 text-xs text-cyan-200 leading-relaxed">
            <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        {mode !== 'forgot' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-xs font-medium text-white hover:bg-white/[0.1] disabled:opacity-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.6-5.4 3.6-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="h-px flex-1 bg-white/[0.08]" />
              <span>or with email</span>
              <span className="h-px flex-1 bg-white/[0.08]" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500/60 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-xl border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500/60 focus:outline-none"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setNotice(null);
                    }}
                    className="text-[11px] text-cyan-300 hover:text-cyan-200"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500/60 focus:outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 transition-colors shadow-[0_0_24px_rgba(124,58,237,0.35)]"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'login'
                    ? 'Sign In'
                    : mode === 'signup'
                      ? 'Create Account'
                      : 'Send Reset Link'}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-white/[0.07] text-center text-xs text-slate-400">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setNotice(null);
                }}
                className="text-violet-300 hover:text-white font-medium"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setNotice(null);
                }}
                className="text-violet-300 hover:text-white font-medium"
              >
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
