import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { createUserProfile, fetchUser } from '../services/db';

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInEmail: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        let profile = await fetchUser(currentUser.uid);
        if (!profile) {
            // First time login
            const data = {
                email: currentUser.email || '',
                name: currentUser.displayName || 'New User',
                income: 0,
                currency: 'USD' 
            };
            await createUserProfile(currentUser.uid, data);
            profile = { id: currentUser.uid, ...data };
        }
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request') {
        return;
      }
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      }
      
      let message = "Google sign in error";
      if (error.code === 'auth/unauthorized-domain') {
        message = "This domain is not authorized for Google Sign-in in your Firebase Console.";
      } else if (error.code === 'auth/network-request-failed') {
        message = "Network error or Firebase domain unreachable. Check your connection.";
      }
      
      console.error(message, error);
      throw new Error(message + " (" + error.code + ")");
    }
  };

  const signUpEmail = async (email: string, pass: string, name: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const data = {
          email: cred.user.email || '',
          name: name,
          income: 0,
          currency: 'USD' 
      };
      await createUserProfile(cred.user.uid, data);
  };

  const signInEmail = async (email: string, pass: string) => {
      await signInWithEmailAndPassword(auth, email, pass);
  };

  const resetPassword = async (email: string) => {
      await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, signUpEmail, signInEmail, resetPassword, logout }}>
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
