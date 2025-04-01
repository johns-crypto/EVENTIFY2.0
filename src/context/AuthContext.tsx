// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, loginUser, registerUser, logoutUser, getUserData, db, loginWithGoogle } from '../services/firebase';
import { toast } from 'react-toastify';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, useGoogle?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, displayName?: string, role?: string) => Promise<void>;
  userProfile: { name?: string; profilePicture?: string; bio?: string } | null;
  userRole: string | null;
  setUserRole: (role: string) => void;
  updateUserRole: (role: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ name?: string; profilePicture?: string; bio?: string } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const fetchUserData = async () => {
          try {
            const userData = await getUserData(user.uid);
            setUserProfile({
              name: userData?.displayName || user.displayName || user.email?.split('@')[0],
              profilePicture: userData?.photoURL || user.photoURL || undefined,
              bio: userData?.bio || '',
            });

            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const data = userDoc.data();
              const newRole = data.role || 'user';
              setUserRole(newRole);
            } else {
              setUserRole('user');
            }
          } catch (err: any) {
            console.error('Error fetching user data:', err);
            setError('Failed to load user data: ' + err.message);
            toast.error('Failed to load data: ' + err.message);
            setUserRole('user');
          }
        };
        fetchUserData();
      } else {
        setUserProfile(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  const login = async (email: string, password: string, useGoogle: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      let user;
      if (useGoogle) {
        user = await loginWithGoogle();
      } else {
        user = await loginUser(email, password);
      }
      setCurrentUser(user);
      const userData = await getUserData(user.uid);
      setUserProfile({
        name: userData?.displayName || user.displayName || user.email?.split('@')[0],
        profilePicture: userData?.photoURL || user.photoURL || undefined,
        bio: userData?.bio || '',
      });
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const newRole = data.role || 'user';
        if (newRole !== userRole) {
          setUserRole(newRole);
          toast.info(`Your role has been updated to: ${newRole}`);
        }
      } else {
        setUserRole('user');
      }
      toast.success('Logged in successfully!');
    } catch (err: any) {
      let errorMessage = 'Login failed: ' + err.message;
      if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Authentication popup was closed. Please try again.';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = 'Authentication popup was blocked by the browser. Please allow popups and try again.';
      }
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName?: string, role: string = 'user') => {
    setLoading(true);
    setError(null);
    try {
      const user = await registerUser(email, password, displayName, role);
      setCurrentUser(user);
      const userData = await getUserData(user.uid);
      setUserProfile({
        name: userData?.displayName || displayName || user.displayName || user.email?.split('@')[0],
        profilePicture: userData?.photoURL || user.photoURL || undefined,
        bio: userData?.bio || '',
      });
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const newRole = data.role || 'user';
        if (newRole !== userRole) {
          setUserRole(newRole);
          toast.info(`Your role has been updated to: ${newRole}`);
        }
      } else {
        setUserRole('user');
      }
      toast.success('Registered successfully!');
    } catch (err: any) {
      let errorMessage = 'Registration failed: ' + err.message;
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use. Please use a different email.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.';
      }
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
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
      setUserRole(null);
      toast.success('Logged out successfully!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Logout failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetUserRole = (newRole: string) => {
    if (newRole !== userRole) {
      setUserRole(newRole);
      toast.info(`Your role has been updated to: ${newRole}`);
    }
  };

  const updateUserRole = async (role: string) => {
    if (!currentUser) throw new Error('No user is logged in');
    setLoading(true);
    setError(null);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { role }, { merge: true });
      setUserRole(role);
      toast.success(`Role updated to ${role}!`);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update user role.';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        error,
        login,
        logout,
        register,
        userProfile,
        userRole,
        setUserRole: handleSetUserRole,
        updateUserRole,
      }}
    >
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