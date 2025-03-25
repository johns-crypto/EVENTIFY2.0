import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Import Firestore functions
import { auth, loginUser, registerUser, logoutUser, getUserData, db } from '../services/firebase';
import { toast } from 'react-toastify';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  userProfile: { name?: string; profilePicture?: string; bio?: string } | null;
  isModerator: boolean; // Added isModerator
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ name?: string; profilePicture?: string; bio?: string } | null>(null);
  const [isModerator, setIsModerator] = useState<boolean>(false); // Added state for isModerator

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const fetchUserData = async () => {
          try {
            // Fetch user profile
            const userData = await getUserData(user.uid);
            setUserProfile({
              name: userData?.displayName || user.displayName || user.email?.split('@')[0],
              profilePicture: userData?.photoURL || user.photoURL || undefined,
              bio: userData?.bio || '',
            });

            // Check if user is a moderator
            const moderatorRef = doc(db, 'moderators', user.uid);
            const moderatorDoc = await getDoc(moderatorRef);
            setIsModerator(moderatorDoc.exists());
          } catch (err: any) {
            console.error('Error fetching user data:', err);
            setError('Failed to load user data: ' + err.message);
            toast.error('Failed to load data: ' + err.message);
            setIsModerator(false); // Default to false on error
          }
        };
        fetchUserData();
      } else {
        setUserProfile(null);
        setIsModerator(false); // Reset isModerator when user logs out
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
      setCurrentUser(user);
      const userData = await getUserData(user.uid);
      setUserProfile({
        name: userData?.displayName || user.displayName || user.email?.split('@')[0],
        profilePicture: userData?.photoURL || user.photoURL || undefined,
        bio: userData?.bio || '',
      });
      // Check if user is a moderator
      const moderatorRef = doc(db, 'moderators', user.uid);
      const moderatorDoc = await getDoc(moderatorRef);
      setIsModerator(moderatorDoc.exists());
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
      setCurrentUser(user);
      const userData = await getUserData(user.uid);
      setUserProfile({
        name: userData?.displayName || displayName || user.displayName || user.email?.split('@')[0],
        profilePicture: userData?.photoURL || user.photoURL || undefined,
        bio: userData?.bio || '',
      });
      // Check if user is a moderator (unlikely for new users, but included for consistency)
      const moderatorRef = doc(db, 'moderators', user.uid);
      const moderatorDoc = await getDoc(moderatorRef);
      setIsModerator(moderatorDoc.exists());
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
      setCurrentUser(null);
      setUserProfile(null);
      setIsModerator(false); // Reset isModerator on logout
      toast.success('Logged out successfully!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Logout failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, error, login, logout, register, userProfile, isModerator }}>
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