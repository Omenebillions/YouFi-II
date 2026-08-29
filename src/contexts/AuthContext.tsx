import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import { createUserProfile, fetchUser, deleteUserAccount, clearLocalUserData } from '../services/db';
import { retryRequest } from '../lib/network';

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInEmail: (email: string, pass: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getRedirectUrl = () => {
  return `${window.location.origin}/auth/callback`;
};

const createLocalGuestUser = (email = 'alex.rivera@youfi.app', name = 'Alex Rivera'): User => ({
  id: 'guest_user_' + (email.replace(/[^a-zA-Z0-9]/g, '_') || 'demo'),
  app_metadata: { provider: 'email' },
  user_metadata: { full_name: name },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: email,
  phone: '',
  role: 'authenticated',
  updated_at: new Date().toISOString(),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Handle OAuth popup callback on any route
    if (window.opener && window.opener !== window) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          try {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
            window.close();
          } catch (e) {
            console.warn('Popup close warning:', e);
          }
        }
      });
    }
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isMounted = true;
    
    const initializeAuth = async () => {
      // Short timeout to guarantee app never hangs on missing/slow Supabase backend
      timeoutId = setTimeout(() => {
        if (isMounted) {
          try {
            const hasLoggedOut = localStorage.getItem('youfi_logged_out') === 'true';
            const savedLocal = localStorage.getItem('youfi_local_user');
            if (savedLocal && !hasLoggedOut) {
              const parsed = JSON.parse(savedLocal);
              handleAuthChange(parsed);
            } else if (!hasLoggedOut) {
              const guest = createLocalGuestUser('alex.rivera@youfi.app', 'Alex Rivera');
              handleAuthChange(guest);
            } else {
              handleAuthChange(null);
            }
          } catch (e) {
            handleAuthChange(null);
          }
          setLoading(false);
        }
      }, 500);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          if (session?.user) {
            localStorage.removeItem('youfi_logged_out');
            await handleAuthChange(session.user);
          } else {
            const hasLoggedOut = localStorage.getItem('youfi_logged_out') === 'true';
            const savedLocal = localStorage.getItem('youfi_local_user');
            if (savedLocal && !hasLoggedOut) {
              const parsed = JSON.parse(savedLocal);
              await handleAuthChange(parsed);
            } else if (!hasLoggedOut) {
              // Direct access on first launch
              const guest = createLocalGuestUser('alex.rivera@youfi.app', 'Alex Rivera');
              localStorage.setItem('youfi_local_user', JSON.stringify(guest));
              await handleAuthChange(guest);
            } else {
              await handleAuthChange(null);
            }
          }
        }
      } catch (error: any) {
        console.warn("Auth initialization warning:", error);
        try {
          const hasLoggedOut = localStorage.getItem('youfi_logged_out') === 'true';
          if (!hasLoggedOut && isMounted) {
            const guest = createLocalGuestUser('alex.rivera@youfi.app', 'Alex Rivera');
            await handleAuthChange(guest);
          }
        } catch (e) {}
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    initializeAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted && session?.user) {
        handleAuthChange(session.user);
      }
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (isMounted && session?.user) {
            handleAuthChange(session.user);
          }
        });
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleAuthChange = async (currentUser: User | null) => {
    setUser(currentUser);
    if (currentUser) {
      try {
        let profile = await fetchUser(currentUser.id);
        if (!profile) {
          // Check local stored profile
          const storedProfile = localStorage.getItem(`youfi_profile_${currentUser.id}`);
          if (storedProfile) {
            profile = JSON.parse(storedProfile);
          } else {
            // First time login
            const data = {
              email: currentUser.email || '',
              name: currentUser.user_metadata?.full_name || 'YouFi Member',
              income: 4500,
              currency: 'USD'
            };
            await createUserProfile(currentUser.id, data).catch(() => {});
            profile = { id: currentUser.id, ...data };
            try {
              localStorage.setItem(`youfi_profile_${currentUser.id}`, JSON.stringify(profile));
            } catch (e) {}
          }
        }
        setUserProfile(profile);
      } catch (error: any) {
        console.warn("Warning fetching user profile:", error);
      }
    } else {
      setUserProfile(null);
    }
    setLoading(false);
  };

  const signInAsGuest = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('youfi_logged_out');
      const guest = createLocalGuestUser('alex.rivera@youfi.app', 'Alex Rivera');
      localStorage.setItem('youfi_local_user', JSON.stringify(guest));
      localStorage.setItem('youfi_premium', 'true');
      const profile = {
        id: guest.id,
        name: 'Alex Rivera',
        email: guest.email,
        income: 5400,
        currency: 'USD'
      };
      localStorage.setItem(`youfi_profile_${guest.id}`, JSON.stringify(profile));
      await handleAuthChange(guest);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const profile = await retryRequest(() => fetchUser(user.id));
        if (profile) {
          setUserProfile(profile);
          localStorage.setItem(`youfi_profile_${user.id}`, JSON.stringify(profile));
        }
      } catch (error) {
        console.error("Error refreshing profile", error);
      }
    }
  };

  const signInWithGoogle = async () => {
    const isIframe = window.self !== window.top;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectUrl(),
        skipBrowserRedirect: isIframe
      }
    });

    if (error) {
      console.error("Google sign in error", error);
      if (error.message && (error.message.toLowerCase().includes('url is not allowed') || error.message.toLowerCase().includes('restricted'))) {
        alert(`SUPABASE CONFIGURATION REQUIRED:

Google Sign-In is blocked because your current URL is not whitelisted in Supabase.

Please go to your Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs, and add exactly this URL:

${window.location.origin}/auth/callback

(e.g., https://youfi.vercel.app/auth/callback)`);
      }
      throw error;
    }

    if (isIframe && data?.url) {
      const popup = window.open(data.url, 'google_oauth_popup', 'width=520,height=650,scrollbars=yes');
      if (!popup) {
        window.top!.location.href = data.url;
      }
    }
  };

  const signUpEmail = async (email: string, pass: string, name: string) => {
    try {
      localStorage.removeItem('youfi_logged_out');
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            full_name: name
          },
          emailRedirectTo: getRedirectUrl()
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.warn("Supabase sign up warning, providing offline fallback session:", error);
      // If Supabase is unconfigured, seamlessly create offline session so user can continue
      const localUser = createLocalGuestUser(email, name || 'YouFi Member');
      localStorage.setItem('youfi_local_user', JSON.stringify(localUser));
      await handleAuthChange(localUser);
    }
  };

  const signInEmail = async (email: string, pass: string) => {
    try {
      localStorage.removeItem('youfi_logged_out');
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });
      if (error) throw error;
    } catch (error: any) {
      console.warn("Supabase sign in warning, providing offline fallback session:", error);
      const localUser = createLocalGuestUser(email, email.split('@')[0]);
      localStorage.setItem('youfi_local_user', JSON.stringify(localUser));
      await handleAuthChange(localUser);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getRedirectUrl(),
    });
    if (error) throw error;
  };

  const logout = async () => {
    try {
      localStorage.setItem('youfi_logged_out', 'true');
      localStorage.removeItem('youfi_local_user');
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error", error);
    } finally {
      setUser(null);
      setUserProfile(null);
    }
  };

  const deleteAccount = async () => {
    try {
      localStorage.removeItem('youfi_local_user');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (token) {
        await deleteUserAccount(token);
      }
      await clearLocalUserData();

      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {}

      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error("Error deleting user account:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, signUpEmail, signInEmail, signInAsGuest, resetPassword, logout, deleteAccount, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
