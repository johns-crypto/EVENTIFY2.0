// src/pages/Settings.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { updateProfile, updatePassword, updateEmail, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db, getUserData } from '../services/firebase';
import { toast } from 'react-toastify';
import { Link, useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

function Settings() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
  const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

  useEffect(() => {
    if (currentUser) {
      setNewEmail(currentUser.email || '');
      getUserData(currentUser.uid)
        .then((userData) => {
          if (userData) {
            setDisplayName(userData.displayName || '');
            setNotificationsEnabled(userData.notificationsEnabled || false);
          }
        })
        .catch((err) => {
          console.error('Failed to load user data:', err);
          toast.error('Failed to load user settings.');
        });
    }
  }, [currentUser]);

  const validateDisplayName = (name: string) => {
    if (name.length < 3) return 'Display name must be at least 3 characters.';
    if (name.length > 50) return 'Display name must be less than 50 characters.';
    return '';
  };

  const validateEmail = (email: string) => {
    if (!/\S+@\S+\.\S+/.test(email)) return 'Please enter a valid email address.';
    return '';
  };

  const validatePassword = (password: string) => {
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*]/.test(password)) return 'Password must contain at least one special character (!@#$%^&*).';
    return '';
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const displayNameError = validateDisplayName(displayName);
    if (displayNameError) {
      setError(displayNameError);
      toast.error(displayNameError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updateProfile(currentUser, { displayName });
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { displayName });
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      setError('Failed to update profile: ' + err.message);
      toast.error('Failed to update profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const emailError = validateEmail(newEmail);
    if (emailError) {
      setError(emailError);
      toast.error(emailError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updateEmail(currentUser, newEmail);
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { email: newEmail });
      toast.success('Email updated successfully!');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Please reauthenticate to update your email.');
        toast.error('Please reauthenticate to update your email.');
      } else {
        setError('Failed to update email: ' + err.message);
        toast.error('Failed to update email: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      toast.error(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updatePassword(currentUser, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully!');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Please reauthenticate to update your password.');
        toast.error('Please reauthenticate to update your password.');
      } else {
        setError('Failed to update password: ' + err.message);
        toast.error('Failed to update password: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReauthenticate = async () => {
    if (!currentUser || !currentUser.email) return;

    if (!reauthPassword) {
      setError('Please enter your current password to reauthenticate.');
      toast.error('Please enter your current password to reauthenticate.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, reauthPassword);
      await reauthenticateWithCredential(currentUser, credential);
      toast.success('Reauthentication successful! Please try your action again.');
      setReauthPassword('');
    } catch (err: any) {
      setError('Reauthentication failed: ' + err.message);
      toast.error('Reauthentication failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (!currentUser) return;

    setLoading(true);
    setError('');
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { notificationsEnabled: !notificationsEnabled });
      setNotificationsEnabled(!notificationsEnabled);
      toast.success(`Notifications ${!notificationsEnabled ? 'enabled' : 'disabled'}!`);
    } catch (err: any) {
      setError('Failed to update notifications: ' + err.message);
      toast.error('Failed to update notifications: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;

    setLoading(true);
    setError('');
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { deleted: true }); // Soft delete in Firestore
      await deleteUser(currentUser);
      await logout();
      navigate('/');
      toast.success('Account deleted successfully.');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Please reauthenticate to delete your account.');
        toast.error('Please reauthenticate to delete your account.');
      } else {
        setError('Failed to delete account: ' + err.message);
        toast.error('Failed to delete account: ' + err.message);
      }
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-md mx-auto bg-gray-800/70 backdrop-blur-lg rounded-2xl p-4 sm:p-6 lg:p-8 shadow-2xl border border-gray-700/30 text-white"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-center text-yellow-400 mb-6">Settings</h2>
          <p className="text-center text-gray-300">Please log in to view settings.</p>
          <Link
            to="/login"
            className="mt-4 block text-center text-yellow-400 hover:underline"
            aria-label="Go to login page"
          >
            Go to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white py-6 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-md mx-auto bg-gray-800/70 backdrop-blur-lg rounded-2xl p-4 sm:p-6 lg:p-8 shadow-2xl border border-gray-700/30"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-center text-yellow-400 mb-6 sm:mb-8">
          Settings
        </h2>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        {/* Profile Section */}
        <div className="mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-4">Profile</h3>
          <p className="text-gray-300 mb-4">Logged in as: {currentUser.email}</p>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-300">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 mt-1 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 disabled:opacity-50"
                placeholder="Enter display name"
                disabled={loading}
                aria-label="Enter your display name"
              />
            </div>
            <motion.button
              type="submit"
              className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-500 hover:to-blue-600 transition-all shadow-sm disabled:opacity-50"
              disabled={loading || !displayName.trim()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Update profile"
            >
              {loading ? 'Updating...' : 'Update Profile'}
            </motion.button>
          </form>
        </div>

        {/* Email Section */}
        <div className="mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-4">Update Email</h3>
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div>
              <label htmlFor="newEmail" className="block text-sm font-medium text-gray-300">
                New Email
              </label>
              <input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-4 py-2 mt-1 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 disabled:opacity-50"
                placeholder="Enter new email"
                disabled={loading}
                aria-label="Enter your new email address"
              />
            </div>
            <motion.button
              type="submit"
              className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-500 hover:to-blue-600 transition-all shadow-sm disabled:opacity-50"
              disabled={loading || !newEmail}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Update email"
            >
              {loading ? 'Updating...' : 'Update Email'}
            </motion.button>
          </form>
        </div>

        {/* Password Section */}
        <div className="mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-4">Change Password</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 mt-1 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 disabled:opacity-50"
                  placeholder="Enter new password"
                  disabled={loading}
                  aria-label="Enter your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 mt-1 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 disabled:opacity-50"
                placeholder="Confirm new password"
                disabled={loading}
                aria-label="Confirm your new password"
              />
            </div>
            <motion.button
              type="submit"
              className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-500 hover:to-blue-600 transition-all shadow-sm disabled:opacity-50"
              disabled={loading || newPassword.length < 6 || !confirmPassword}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Change password"
            >
              {loading ? 'Updating...' : 'Change Password'}
            </motion.button>
          </form>
        </div>

        {/* Reauthentication Section (shown if needed) */}
        {error.includes('reauthenticate') && (
          <div className="mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-4">Reauthenticate</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="reauthPassword" className="block text-sm font-medium text-gray-300">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="reauthPassword"
                    type={showReauthPassword ? 'text' : 'password'}
                    value={reauthPassword}
                    onChange={(e) => setReauthPassword(e.target.value)}
                    className="w-full px-4 py-2 mt-1 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 disabled:opacity-50"
                    placeholder="Enter current password"
                    disabled={loading}
                    aria-label="Enter your current password to reauthenticate"
                  />
                  <button
                    type="button"
                    onClick={() => setShowReauthPassword(!showReauthPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    aria-label={showReauthPassword ? 'Hide password' : 'Show password'}
                  >
                    {showReauthPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                  </button>
                </div>
              </div>
              <motion.button
                onClick={handleReauthenticate}
                className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-full hover:from-green-500 hover:to-green-600 transition-all shadow-sm disabled:opacity-50"
                disabled={loading || !reauthPassword}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Reauthenticate"
              >
                {loading ? 'Reauthenticating...' : 'Reauthenticate'}
              </motion.button>
            </div>
          </div>
        )}

        {/* Notifications Section */}
        <div className="mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-4">Notifications</h3>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={handleToggleNotifications}
              className="h-5 w-5 text-yellow-400 bg-gray-700/50 border-gray-600/50 rounded focus:ring-yellow-400 disabled:opacity-50"
              disabled={loading}
              aria-label="Toggle notifications"
            />
            <span className="text-gray-300">Enable Notifications</span>
          </label>
        </div>

        {/* Links Section */}
        <div className="mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-4">Links</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link to="/about" className="text-yellow-400 hover:underline" aria-label="Go to About page">
              About
            </Link>
            {/* TODO: Add routes for Contact, Privacy Policy, and Terms of Service in App.tsx */}
            {/* <Link to="/contact" className="text-yellow-400 hover:underline" aria-label="Go to Contact page">
              Contact
            </Link>
            <Link to="/privacy-policy" className="text-yellow-400 hover:underline" aria-label="Go to Privacy Policy page">
              Privacy Policy
            </Link>
            <Link to="/terms-of-service" className="text-yellow-400 hover:underline" aria-label="Go to Terms of Service page">
              Terms of Service
            </Link> */}
          </div>
        </div>

        {/* Delete Account Section */}
        <div className="mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-4">Danger Zone</h3>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full hover:from-red-500 hover:to-red-600 transition-all shadow-sm disabled:opacity-50"
            disabled={loading}
            aria-label="Delete account"
          >
            Delete Account
          </button>
        </div>

        {/* Delete Account Confirmation Modal */}
        {showDeleteModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gray-800/70 backdrop-blur-lg rounded-2xl p-6 w-11/12 max-w-sm border border-gray-700/30 shadow-md text-white"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <h3 className="text-lg font-semibold text-yellow-400 mb-4">Confirm Account Deletion</h3>
              <p className="text-gray-300 mb-4">
                Are you sure you want to delete your account? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-full hover:bg-gray-500 transition-all"
                  aria-label="Cancel account deletion"
                >
                  Cancel
                </button>
                <motion.button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full hover:from-red-500 hover:to-red-600 transition-all disabled:opacity-50"
                  disabled={loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Confirm account deletion"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default Settings;