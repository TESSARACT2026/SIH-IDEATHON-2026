import React, { useState } from 'react';
import { Mail, Lock, User, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import SpotlightCard from '../components/ui/SpotlightCard';
import ShinyText from '../components/ui/ShinyText';

export const LoginPage: React.FC = () => {
  const { login, register, signInWithGoogle, isLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name || undefined);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
      {/* Background Glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

      <SpotlightCard
        className="relative w-full max-w-md rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-md"
        spotlightColor="rgba(249, 115, 22, 0.15)"
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <span className="text-3xl">🗺️</span>
            <ShinyText text="MargDarshak" className="font-extrabold text-3xl tracking-tight" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            {mode === 'login'
              ? 'Sign in to access your saved trips and itineraries'
              : 'Join to save trips, share itineraries and more'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs leading-relaxed">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Google Auth Button */}
        <button
          onClick={async () => {
            setError(null);
            try {
              await signInWithGoogle();
              navigate('/dashboard');
            } catch (err: any) {
              setError(err?.message || 'Google sign-in failed.');
            }
          }}
          disabled={isLoading}
          type="button"
          className="w-full mb-5 flex items-center justify-center gap-2.5 py-3 rounded-2xl font-bold text-white transition-all disabled:opacity-50 hover:bg-white/15 cursor-pointer text-xs"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <div className="flex items-center gap-4 mb-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xxs text-slate-500 uppercase tracking-widest font-bold">or email</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name (register only) */}
          {mode === 'register' && (
            <div className="space-y-1">
              <label className="block text-slate-300 text-xs font-semibold">Name (optional)</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl text-white text-xs outline-none transition-all focus:border-orange-500"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1">
            <label className="block text-slate-300 text-xs font-semibold">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl text-white text-xs outline-none transition-all focus:border-orange-500"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="block text-slate-300 text-xs font-semibold">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
                required
                minLength={8}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl text-white text-xs outline-none transition-all focus:border-orange-500"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-extrabold text-white transition-all disabled:opacity-50 cursor-pointer text-xs mt-2"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
          >
            {isLoading ? (
              <span className="animate-pulse">Processing...</span>
            ) : mode === 'login' ? (
              <>
                <LogIn size={16} />
                Sign In
              </>
            ) : (
              <>
                <UserPlus size={16} />
                Create Account
              </>
            )}
          </button>
        </form>

        {/* Mode toggle */}
        <p className="mt-6 text-center text-xs text-slate-400">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            className="text-orange-400 hover:text-orange-300 font-bold transition-colors cursor-pointer"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </SpotlightCard>
    </div>
  );
};
