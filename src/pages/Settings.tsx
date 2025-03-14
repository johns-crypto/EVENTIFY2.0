import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { updateProfile, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db, getUserData } from '../services/firebase';
import { toast } from 'react-toastify';

function Settings() {
  const { currentUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  // Load user data on mount
  useEffect(() => {
    if (currentUser) {
      getUserData(currentUser.uid)
        .then((userData) => {
          if (userData) {
            setDisplayName(userData.displayName || '');
            setNotificationsEnabled(userData.notificationsEnabled || false); // Assuming this field exists
          }
        })
        .catch((err) => {
          console.error('Failed to load user data:', err);
          toast.error('Failed to load user settings.');
        });
    }
  }, [currentUser]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);
    setMessage('');
    try {
      // Update Firebase Auth profile
      await updateProfile(currentUser, { displayName });
      // Update Firestore user document
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { displayName });
      setMessage('Profile updated successfully!');
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      setMessage('Failed to update profile: ' + err.message);
      toast.error('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await updatePassword(currentUser, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password updated successfully!');
      toast.success('Password updated successfully!');
    } catch (err: any) {
      setMessage('Failed to update password: ' + err.message);
      toast.error('Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (!currentUser) return;

    setLoading(true);
    setMessage('');
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { notificationsEnabled: !notificationsEnabled });
      setNotificationsEnabled(!notificationsEnabled);
      setMessage(`Notifications ${!notificationsEnabled ? 'enabled' : 'disabled'}!`);
      toast.success(`Notifications ${!notificationsEnabled ? 'enabled' : 'disabled'}!`);
    } catch (err: any) {
      setMessage('Failed to update notifications: ' + err.message);
      toast.error('Failed to update notifications.');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-md w-full bg-primary-navy p-8 rounded-lg shadow-lg text-neutral-lightGray"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <h2 className="text-3xl font-bold text-center text-accent-gold mb-6">Settings</h2>
          <p>Please log in to view settings.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-md w-full bg-primary-navy p-8 rounded-lg shadow-lg"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <h2 className="text-3xl font-bold text-center text-accent-gold mb-6">Settings</h2>
        <div className="space-y-6 text-neutral-lightGray">
          {/* Profile Section */}
          <div>
            <h3 className="text-xl font-semibold text-accent-gold mb-2">Profile</h3>
            <p>Logged in as: {currentUser.email}</p>
            <form onSubmit={handleUpdateProfile} className="mt-4 space-y-4">
              <div>
                <label htmlFor="displayName" className="block text-sm">Display Name</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  placeholder="Enter display name"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                className="w-full btn-primary"
                disabled={loading || !displayName.trim()}
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
            </form>
          </div>

          {/* Password Section */}
          <div>
            <h3 className="text-xl font-semibold text-accent-gold mb-2">Change Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  placeholder="Enter new password"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  placeholder="Confirm new password"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                className="w-full btn-primary"
                disabled={loading || newPassword.length < 6 || !confirmPassword}
              >
                {loading ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </div>

          {/* Notifications Section */}
          <div>
            <h3 className="text-xl font-semibold text-accent-gold mb-2">Notifications</h3>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={handleToggleNotifications}
                className="form-checkbox h-5 w-5 text-accent-gold bg-neutral-offWhite rounded focus:ring-accent-gold"
                disabled={loading}
              />
              <span>Enable Notifications</span>
            </label>
          </div>
        </div>

        {message && <p className="text-accent-gold mt-4 text-center">{message}</p>}
      </motion.div>
    </div>
  );
}

export default Settings;