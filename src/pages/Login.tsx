import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldAlert, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { user, signInWithGoogle, signInEmail, signUpEmail } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        await signUpEmail(email, password, name);
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
         setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
         setError('This email is already registered. Please log in.');
      } else {
         setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden p-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mb-4">
          <TrendingUp size={32} />
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">YouFi</h1>
        <p className="text-gray-500 mb-6 text-sm">Your personal AI financial co-pilot</p>
        
        <div className="flex bg-gray-100 p-1 rounded-xl w-full mb-6">
          <button 
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${isLogin ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Log In
          </button>
          <button 
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${!isLogin ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Sign Up
          </button>
        </div>

        {error && (
            <div className="w-full bg-danger-50 text-danger-500 text-xs font-medium p-3 rounded-xl mb-4 text-left">
                {error}
                {error.includes("auth/") && <p className="mt-1">Note: Please ensure Email/Password Auth is enabled in your Firebase Console.</p>}
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
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 border border-transparent text-white hover:bg-brand-500 py-3.5 px-4 rounded-xl font-semibold transition-colors mt-2"
          >
            {loading ? 'Please wait...' : (isLogin ? 'Log In' : 'Create Account')}
          </button>
        </form>

        <div className="w-full flex items-center gap-4 my-6">
            <div className="h-px bg-gray-200 flex-1"></div>
            <span className="text-xs text-gray-400 font-medium">OR</span>
            <div className="h-px bg-gray-200 flex-1"></div>
        </div>

        <div className="w-full space-y-4 flex flex-col items-center">
          <button 
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-3.5 px-4 rounded-xl font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
        </div>
        
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          <ShieldAlert size={14} />
          <span>Secured by Firebase</span>
        </div>
      </div>
    </div>
  );
}
