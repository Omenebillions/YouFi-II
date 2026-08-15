import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import { createUserProfile, fetchUser } from '../services/db';
import { retryRequest } from '../lib/network';

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInEmail: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const initializeAuth = async () => {
      try {
        // Add timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          setLoading(false);
          console.warn("Auth initialization timeout");
        }, 5000);
        
        const { data: { session } } = await supabase.auth.getSession();
        await handleAuthChange(session?.user ?? null);
        
        if (timeoutId) clearTimeout(timeoutId);
      } catch (error: any) {
        if (error?.message?.includes('Failed to fetch')) {
          console.warn("Auth initialization warning: Failed to fetch (likely missing or invalid Supabase credentials).");
        } else {
          console.warn("Auth initialization error:", error);
        }
        setLoading(false);
      }
    };
    
    initializeAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthChange(session?.user ?? null);
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          handleAuthChange(session?.user ?? null);
        });
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleAuthChange = async (currentUser: User | null) => {
    setUser(currentUser);
    if (currentUser) {
      try {
        let profile = await retryRequest(() => fetchUser(currentUser.id));
        if (!profile) {
          // First time login
          const data = {
            email: currentUser.email || '',
            name: currentUser.user_metadata?.full_name || 'New User',
            income: 0,
            currency: 'USD'
          };
          await retryRequest(() => createUserProfile(currentUser.id, data));
          profile = { id: currentUser.id, ...data };
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

  const refreshProfile = async () => {
    if (user) {
      try {
        const profile = await retryRequest(() => fetchUser(user.id));
        if (profile) setUserProfile(profile);
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
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: isIframe
      }
    });

    if (error) {
      console.error("Google sign in error", error);
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            full_name: name
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("Sign up error:", error);
      throw new Error(error.message || "Failed to sign up");
    }
  };

  const signInEmail = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Sign in error:", error);
      throw new Error(error.message || "Failed to sign in");
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`, // Or a specific reset page
    });
    if (error) throw error;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, signUpEmail, signInEmail, resetPassword, logout, refreshProfile }}>
      {!loading && children}
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
