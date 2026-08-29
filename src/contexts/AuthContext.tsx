import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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

const createLocalGuestUser = (email = 'guest@youfi.app', name = 'Guest User'): User => ({
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
  const currentUserIdRef = useRef<string | null>(null);

  const handleAuthChange = async (currentUser: User | null) => {
    if (!currentUser) {
      currentUserIdRef.current = null;
      setUser(null);
      setUserProfile(null);
      setLoading(false);
      return;
    }

    // If switching users, immediately clear prior user's profile to prevent flash of wrong data
    if (currentUserIdRef.current && currentUserIdRef.current !== currentUser.id) {
      setUserProfile(null);
    }
    currentUserIdRef.current = currentUser.id;
    setUser(currentUser);

    try {
      let profile = await fetchUser(currentUser.id);
      if (!profile) {
        // Check user-scoped stored profile in localStorage
        const storedProfile = localStorage.getItem(`youfi_profile_${currentUser.id}`);
        if (storedProfile) {
          try {
            profile = JSON.parse(storedProfile);
          } catch (e) {}
        }
        
        if (!profile) {
          // Initialize default profile for first-time login
          const data = {
            email: currentUser.email || '',
            name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'YouFi Member',
            income: 0,
            currency: 'USD'
          };
          await createUserProfile(currentUser.id, data).catch(() => {});
          profile = { id: currentUser.id, ...data };
        }
      }

      if (profile && currentUserIdRef.current === currentUser.id) {
        setUserProfile(profile);
        try {
          localStorage.setItem(`youfi_profile_${currentUser.id}`, JSON.stringify(profile));
        } catch (e) {}
      }
    } catch (error: any) {
      console.warn("[AuthContext]: Warning fetching user profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[AuthContext]: Session retrieval error:", error.message);
        }

        if (!isMounted) return;

        if (session?.user) {
          localStorage.removeItem('youfi_logged_out');
          await handleAuthChange(session.user);
        } else {
          // Check if explicit guest session exists and user didn't log out
          const hasLoggedOut = localStorage.getItem('youfi_logged_out') === 'true';
          const savedGuest = localStorage.getItem('youfi_guest_user');
          
          if (savedGuest && !hasLoggedOut) {
            try {
              const parsed = JSON.parse(savedGuest);
              if (parsed?.id) {
                await handleAuthChange(parsed);
                return;
              }
            } catch (e) {}
          }

          // No active session — show unauthenticated state
          await handleAuthChange(null);
        }
      } catch (error: any) {
        console.warn("[AuthContext]: Auth initialization error:", error);
        if (isMounted) {
          await handleAuthChange(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        await handleAuthChange(null);
      } else if (session?.user) {
        localStorage.removeItem('youfi_logged_out');
        await handleAuthChange(session.user);
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
    };
  }, []);

  const signInAsGuest = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('youfi_logged_out');
      const guest = createLocalGuestUser('guest@youfi.app', 'Guest Explorer');
      localStorage.setItem('youfi_guest_user', JSON.stringify(guest));
      const profile = {
        id: guest.id,
        name: 'Guest Explorer',
        email: guest.email,
        income: 3500,
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
  };

  const signInEmail = async (email: string, pass: string) => {
    localStorage.removeItem('youfi_logged_out');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });
    if (error) throw error;
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
      localStorage.removeItem('youfi_guest_user');
      await clearLocalUserData();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error", error);
    } finally {
      currentUserIdRef.current = null;
      setUser(null);
      setUserProfile(null);
    }
  };

  const deleteAccount = async () => {
    try {
      localStorage.removeItem('youfi_guest_user');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (token) {
        await deleteUserAccount(token);
      }
      await clearLocalUserData();

      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {}

      currentUserIdRef.current = null;
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
