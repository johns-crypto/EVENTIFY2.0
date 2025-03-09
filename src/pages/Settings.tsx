import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

function Settings() {
  const { currentUser } = useAuth();
  const [message, setMessage] = useState('');

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-md w-full bg-primary-navy p-8 rounded-lg shadow-lg"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <h2 className="text-3xl font-bold text-center text-accent-gold mb-6">Settings</h2>
        {currentUser ? (
          <div className="space-y-4 text-neutral-lightGray">
            <p>Logged in as: {currentUser.email}</p>
            <p>This is a placeholder for settings options (e.g., change password, notifications).</p>
          </div>
        ) : (
          <p className="text-neutral-lightGray">Please log in to view settings.</p>
        )}
        {message && <p className="text-accent-gold mt-4">{message}</p>}
      </motion.div>
    </div>
  );
}

export default Settings;