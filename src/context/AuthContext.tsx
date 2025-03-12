import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginUser, registerUser, logoutUser, getUserData } from '../services/firebase'; // Added getUserData
import { toast } from 'react-toastify';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>; // Added displayName
  userProfile: { name?: string; profilePicture?: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ name?: string; profilePicture?: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userData = await getUserData(user.uid);
          setUserProfile({
            name: userData?.displayName || user.displayName || user.email?.split('@')[0],
            profilePicture: userData?.profilePicture || user.photoURL || undefined,
          });
        } catch (err: any) {
          console.error('Error fetching user profile:', err);
          setError('Failed to load user profile: ' + err.message);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = await loginUser(email, password);
      setCurrentUser(user); // Update currentUser immediately
      const userData = await getUserData(user.uid);
      setUserProfile({
        name: userData?.displayName || user.displayName || user.email?.split('@')[0],
        profilePicture: userData?.profilePicture || user.photoURL || undefined,
      });
      toast.success('Logged in successfully!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = await registerUser(email, password, displayName);
      setCurrentUser(user); // Update currentUser immediately
      setUserProfile({
        name: displayName || user.displayName || user.email?.split('@')[0],
        profilePicture: user.photoURL || undefined,
      });
      toast.success('Registered successfully!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Registration failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await logoutUser();
      setCurrentUser(null); // Clear currentUser immediately
      setUserProfile(null); // Clear userProfile
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
      {!loading && children} {/* Only render children when not loading */}
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