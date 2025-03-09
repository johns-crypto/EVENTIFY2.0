// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginUser, registerUser, logoutUser } from '../services/firebase'; // Import initialized auth and functions
import { toast } from 'react-toastify';

// Define the shape of the context value with TypeScript
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  userProfile: { name?: string; profilePicture?: string } | null;
}

// Create AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start as true for initial load
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ name?: string; profilePicture?: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription
  }, []);

  // Login function using firebase.ts export
  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await loginUser(email, password); // Use exported function
      toast.success('Logged in successfully!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Register function using firebase.ts export
  const register = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await registerUser(email, password); // Use exported function
      toast.success('Registered successfully!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Registration failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Logout function using firebase.ts export
  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await logoutUser(); // Use exported function
      toast.success('Logged out successfully!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Logout failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, error, login, logout, register, userProfile }}>
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