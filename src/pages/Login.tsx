import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { user, signInEmail, signUpEmail, signInAsGuest, resetPassword } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const getAuthErrorMessage = (err: any) => {
    const code = String(err?.code || '').toLowerCase();
    const message = String(err?.message || '');
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('networkerror')) {
      return 'Could not reach the authentication service. Check your internet connection and try again.';
    }
    if (['invalid_credentials', 'invalid_login_credentials'].includes(code) ||
        normalizedMessage.includes('invalid login credentials') ||
        normalizedMessage.includes('invalid email or password')) {
      return 'Invalid email or password. Check your details and try again.';
    }
    if (code === 'email_not_confirmed' || normalizedMessage.includes('email not confirmed')) {
      return 'Please confirm your email using the link we sent before logging in.';
    }
    if (['user_already_exists', 'email_exists'].includes(code) ||
        normalizedMessage.includes('user already registered') ||
        normalizedMessage.includes('already registered')) {
      return 'This email is already registered. Log in instead or reset your password.';
    }
    if (code === 'weak_password' || normalizedMessage.includes('password should be')) {
      return message || 'Choose a stronger password and try again.';
    }
    if (normalizedMessage.includes('rate limit') || normalizedMessage.includes('too many requests')) {
      return 'Too many attempts. Please wait a few minutes and try again.';
    }
    return message || 'Authentication failed. Please try again.';
  };

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isLogin) {
        await signInEmail(email, password);
      } else {
        const requiresEmailConfirmation = await signUpEmail(email, password, name);
        if (requiresEmailConfirmation) {
          setMessage('Account created. Check your email for a confirmation link before logging in.');
        }
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await resetPassword(email);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInAsGuest();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize demo session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden p-8 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-center mb-4 overflow-hidden p-2">
          <img 
            src="/logo.jpeg" 
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }} 
            alt="YouFi Logo" 
            className="w-full h-full object-contain" 
          />
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">YouFi</h1>
        <p className="text-gray-500 mb-6 text-sm">Your personal AI financial co-pilot</p>
        
        <div className="flex bg-gray-100 p-1 rounded-xl w-full mb-6">
          <button 
            onClick={() => { setIsLogin(true); setError(''); setMessage(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${isLogin ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Log In
          </button>
          <button 
            onClick={() => { setIsLogin(false); setError(''); setMessage(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${!isLogin ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Sign Up
          </button>
        </div>

        {error && (
            <div className="w-full bg-danger-50 text-danger-500 text-xs font-medium p-3 rounded-xl mb-4 text-left">
                {error}
            </div>
        )}

        {message && (
            <div className="w-full bg-success-50 text-success-600 text-xs font-medium p-3 rounded-xl mb-4 text-left">
                {message}
            </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4 flex flex-col text-left">
          {!isLogin && (
             <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
               <input 
                 type="text" 
                 value={name}
                 onChange={e => setName(e.target.value)}
                 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors"
                 required={!isLogin}
                 placeholder="John Doe"
               />
             </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors"
              required
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors"
              required
              placeholder="••••••••"
            />
            {isLogin && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-brand-600 hover:text-brand-500 font-medium"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 border border-transparent text-white hover:bg-brand-500 py-3.5 px-4 rounded-xl font-semibold transition-colors mt-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Please wait...' : (isLogin ? 'Log In' : 'Create Account')}
          </button>
        </form>

        <div className="w-full space-y-3 flex flex-col items-center">
          <button 
            type="button"
            onClick={handleGuestSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 py-3 px-4 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
          >
            <Sparkles size={16} className="text-emerald-600" />
            <span>Continue as Guest / Demo Mode</span>
          </button>
        </div>
        
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <ShieldAlert size={14} />
            <span>Encrypted & Private</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-gray-400 font-medium">
            <Link to="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
            <span>•</span>
            <Link to="/delete-account" className="hover:text-red-600 transition-colors">Delete Account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
