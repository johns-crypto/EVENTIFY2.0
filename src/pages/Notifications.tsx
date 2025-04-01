// src/pages/Notifications.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { onSnapshot, collection, query, updateDoc, doc, arrayUnion, arrayRemove, addDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { db } from '../services/firebase';
import { FaCheck, FaTimes, FaArrowLeft, FaBell, FaInfoCircle } from 'react-icons/fa';

interface NotificationData {
  id: string;
  type: 'join_request' | 'join_response' | 'event_update';
  eventId: string;
  userId?: string; // For join_request
  eventTitle: string;
  userName?: string; // For join_request
  message: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'denied' | 'unread';
}

function Notifications() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setError('Please log in to view notifications.');
      toast.error('Please log in to view notifications.');
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);

    // Query all notifications for the user
    const q = query(collection(db, 'users', currentUser.uid, 'notifications'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notificationData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as NotificationData[];
        setNotifications(
          notificationData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
        setLoading(false);
      },
      (err: any) => {
        setError('Failed to load notifications: ' + err.message);
        toast.error('Failed to load notifications.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, navigate]);

  const handleApprove = async (notification: NotificationData) => {
    try {
      const eventRef = doc(db, 'events', notification.eventId);
      const notificationRef = doc(db, 'users', currentUser!.uid, 'notifications', notification.id);

      // Update the event
      await updateDoc(eventRef, {
        invitedUsers: arrayUnion(notification.userId),
        pendingRequests: arrayRemove(notification.userId),
      });

      // Update the current user's notification
      await updateDoc(notificationRef, { status: 'approved' });

      // Create a notification for the requesting user
      const userNotificationRef = collection(db, 'users', notification.userId!, 'notifications');
      await addDoc(userNotificationRef, {
        type: 'join_response',
        eventId: notification.eventId,
        eventTitle: notification.eventTitle,
        message: `Your request to join "${notification.eventTitle}" has been approved!`,
        createdAt: new Date().toISOString(),
        status: 'approved',
      });

      toast.success(`${notification.userName} has been approved to join ${notification.eventTitle}.`);
    } catch (err: any) {
      toast.error('Failed to approve request: ' + err.message);
    }
  };

  const handleDeny = async (notification: NotificationData) => {
    try {
      const eventRef = doc(db, 'events', notification.eventId);
      const notificationRef = doc(db, 'users', currentUser!.uid, 'notifications', notification.id);

      // Update the event
      await updateDoc(eventRef, {
        pendingRequests: arrayRemove(notification.userId),
      });

      // Update the current user's notification
      await updateDoc(notificationRef, { status: 'denied' });

      // Create a notification for the requesting user
      const userNotificationRef = collection(db, 'users', notification.userId!, 'notifications');
      await addDoc(userNotificationRef, {
        type: 'join_response',
        eventId: notification.eventId,
        eventTitle: notification.eventTitle,
        message: `Your request to join "${notification.eventTitle}" has been denied.`,
        createdAt: new Date().toISOString(),
        status: 'denied',
      });

      toast.success(`${notification.userName}'s request to join ${notification.eventTitle} has been denied.`);
    } catch (err: any) {
      toast.error('Failed to deny request: ' + err.message);
    }
  };

  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  };

  const stagger = {
    visible: { transition: { staggerChildren: 0.1 } },
  };

  const headingFade = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut', type: 'spring', bounce: 0.2 },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <svg
          className="animate-spin h-8 w-8 text-accent-gold"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="ml-2 text-neutral-lightGray">Loading Notifications...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] px-4">
        <div className="text-center text-neutral-lightGray bg-neutral-darkGray/60 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-neutral-darkGray">
          <h2 className="text-xl sm:text-2xl font-semibold text-red-500 mb-3">Error</h2>
          <p className="text-sm sm:text-base mb-4">{error}</p>
          <motion.button
            onClick={() => navigate('/')}
            className="bg-accent-gold text-neutral-darkGray px-5 py-2 rounded-full hover:bg-yellow-500 transition-all shadow-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-accent-gold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Back to Home
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-neutral-lightGray">
      <motion.section
        className="py-8 px-4 sm:py-12 sm:px-6"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between mb-6 sm:mb-8 gap-4">
            <motion.div
              className="flex items-center gap-3"
              initial="hidden"
              animate="visible"
              variants={headingFade}
            >
              <FaBell className="text-accent-gold text-2xl sm:text-3xl" />
              <h1 className="text-2xl sm:text-3xl font-bold text-accent-gold">Notifications</h1>
              {notifications.length > 0 && (
                <span className="bg-secondary-deepRed text-white px-2 py-1 rounded-full text-xs sm:text-sm">
                  {notifications.length} New
                </span>
              )}
            </motion.div>
            <motion.button
              onClick={() => navigate('/')}
              className="flex items-center text-accent-gold hover:text-yellow-500 transition-colors text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-accent-gold"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Back to Home"
            >
              <FaArrowLeft className="mr-2" />
              Back to Home
            </motion.button>
          </div>

          {/* Notifications List */}
          {notifications.length > 0 ? (
            <motion.div className="space-y-4 sm:space-y-6" variants={stagger}>
              {notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  className="relative bg-gradient-to-r from-neutral-darkGray to-gray-700 rounded-xl p-4 sm:p-5 shadow-lg border border-gray-600/50 overflow-hidden"
                  variants={fadeIn}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Decorative Accent */}
                  <div className="absolute top-0 left-0 w-1 h-full bg-accent-gold" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Notification Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {notification.type === 'join_request' && (
                          <FaBell className="text-accent-gold" />
                        )}
                        {notification.type === 'join_response' && (
                          <FaInfoCircle className="text-blue-500" />
                        )}
                        {notification.type === 'event_update' && (
                          <FaInfoCircle className="text-yellow-500" />
                        )}
                        <p
                          className="text-sm sm:text-base text-neutral-lightGray cursor-pointer hover:text-accent-gold transition-colors"
                          onClick={() => navigate(`/events/${notification.eventId}`)}
                        >
                          {notification.message}
                        </p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-400 mt-1">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {/* Action Buttons (only for join_request) */}
                    {notification.type === 'join_request' && notification.status === 'pending' && (
                      <div className="flex gap-2 sm:gap-3">
                        <motion.button
                          onClick={() => handleApprove(notification)}
                          className="flex items-center bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-500 transition-all text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-500 shadow-md"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          aria-label={`Approve ${notification.userName}'s request to join ${notification.eventTitle}`}
                        >
                          <FaCheck className="mr-1 sm:mr-2" />
                          Approve
                        </motion.button>
                        <motion.button
                          onClick={() => handleDeny(notification)}
                          className="flex items-center bg-red-500 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-600 transition-all text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 shadow-md"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          aria-label={`Deny ${notification.userName}'s request to join ${notification.eventTitle}`}
                        >
                          <FaTimes className="mr-1 sm:mr-2" />
                          Deny
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              className="text-center text-neutral-lightGray bg-neutral-darkGray/60 backdrop-blur-lg rounded-2xl p-6 sm:p-8 shadow-xl border border-gray-700/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <FaBell className="text-accent-gold text-3xl sm:text-4xl mx-auto mb-4" />
              <p className="text-sm sm:text-base">No notifications at the moment.</p>
              <motion.button
                onClick={() => navigate('/')}
                className="mt-4 bg-accent-gold text-neutral-darkGray px-5 py-2 rounded-full hover:bg-yellow-500 transition-all text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-accent-gold"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Back to Home
              </motion.button>
            </motion.div>
          )}
        </div>
      </motion.section>
    </div>
  );
}

export default Notifications;