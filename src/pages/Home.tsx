// src/pages/Home.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { onSnapshot, collection, query, where, updateDoc, doc, arrayUnion, Timestamp, addDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import defaultEventImage from '../assets/default-event.jpg';
import { multiStepCreateEvent } from '../services/eventCreation';
import { db, getUserData } from '../services/firebase';
import { FaUser, FaTimes, FaArrowUp, FaTimesCircle, FaBell, FaInfoCircle } from 'react-icons/fa';
import debounce from 'lodash/debounce';
import { NormalizedEventData } from '../types';

interface UserData {
  displayName?: string;
  photoURL?: string;
  followers?: string[];
}

interface NotificationData {
  id: string;
  type: 'join_request' | 'join_response' | 'event_update';
  eventId: string;
  userId?: string;
  eventTitle: string;
  userName?: string;
  message: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'denied' | 'unread';
}

const convertTimestampToString = (value: string | Timestamp): string => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return value;
};

function Home() {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<NormalizedEventData[]>([]);
  const [username, setUsername] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMultiStepModal, setShowMultiStepModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  const eventCreation = currentUser
    ? multiStepCreateEvent({
        userId: currentUser.uid,
        onSuccess: async (newEventData: NormalizedEventData) => {
          setEvents((prev) => [newEventData, ...prev].slice(0, 4));
          setShowMultiStepModal(false);
          toast.success('Event created successfully!');
        },
        onError: (message: string) => {
          setError(message);
          toast.error(message);
        },
      })
    : null;

  const {
    step,
    newEvent,
    setNewEvent,
    handleNextStep,
    handlePrevStep,
    handleCreateEvent: multiStepHandleCreateEvent,
    loading: multiStepLoading,
    searchedImages,
    followers,
    followerNames,
    selectedImageIndex,
    setSelectedImageIndex,
    searchImages,
  } = eventCreation || {
    step: 1,
    newEvent: {
      title: '',
      location: '',
      date: '',
      visibility: 'public' as 'public' | 'private',
      organizers: [],
      inviteLink: '',
      description: '',
      selectedImage: null,
      searchedImages: [],
      category: 'General' as 'General' | 'Music' | 'Food' | 'Tech',
    },
    setNewEvent: () => {},
    handleNextStep: () => {},
    handlePrevStep: () => {},
    handleCreateEvent: () => Promise.resolve(),
    loading: false,
    searchedImages: [],
    followers: [],
    followerNames: {},
    selectedImageIndex: null,
    setSelectedImageIndex: () => {},
    searchImages: () => Promise.resolve(),
  };

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

  const backgroundAnimation = {
    initial: { scale: 1 },
    animate: { scale: 1.1, transition: { duration: 10, ease: 'easeOut' } },
  };

  const debouncedSetSearchTerm = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  // Fetch events and user data
  useEffect(() => {
    if (loading) return;

    if (!currentUser) {
      navigate('/login');
      return;
    }

    const fetchData = () => {
      setLoadingEvents(true);
      setError(null);
      const today = new Date();

      const q = query(collection(db, 'events'), where('visibility', '==', 'public'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const eventData = snapshot.docs.map((doc) => {
          const data = doc.data();

          const createdAt = convertTimestampToString(data.createdAt || Timestamp.now());
          const eventDate = data.date ? convertTimestampToString(data.date) : createdAt;

          return {
            id: doc.id,
            title: data.title || 'Untitled Event',
            userId: data.userId || '',
            location: data.location || '',
            category: data.category || 'General',
            description: data.description || undefined,
            visibility: data.visibility || 'public',
            organizers: data.organizers || [],
            organizerId: data.organizerId || undefined,
            inviteLink: data.inviteLink || undefined,
            invitedUsers: data.invitedUsers || [],
            pendingInvites: data.pendingInvites || [],
            creatorName: data.creatorName || 'Unknown',
            archived: data.archived ?? false,
            image: data.image || undefined,
            service: data.service || undefined,
            createdAt,
            date: eventDate,
          } as NormalizedEventData;
        });

        const filteredEvents = eventData
          .filter((event) => {
            const eventDate = new Date(event.date || event.createdAt);
            return (
              eventDate >= today &&
              (selectedCategory === 'All' || event.category === selectedCategory) &&
              (event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                event.location.toLowerCase().includes(searchTerm.toLowerCase()))
            );
          })
          .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
          .slice(0, 4);

        setEvents(filteredEvents);
        setLoadingEvents(false);
      }, (err: any) => {
        setError('Failed to load events: ' + err.message);
        toast.error('Failed to load events');
        setLoadingEvents(false);
      });

      return () => unsubscribe();
    };

    fetchData();

    if (currentUser) {
      getUserData(currentUser.uid)
        .then((userData: UserData | null) => {
          setUsername(userData?.displayName || currentUser.email?.split('@')[0] || 'User');
        })
        .catch((err: any) => {
          console.error('Error fetching user data:', err);
          setUsername(currentUser.email?.split('@')[0] || 'User');
        })
        .finally(() => setLoadingEvents(false));
    }
  }, [currentUser, loading, navigate, selectedCategory, searchTerm]);

   // Fetch user notifications
   useEffect(() => {
    if (!currentUser) return;

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
      },
      (err: any) => {
        toast.error('Failed to load notifications: ' + err.message);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const handleJoinEvent = useCallback(async (eventId: string) => {
    if (!currentUser) {
      toast.error('Please log in to join an event.');
      return;
    }

    try {
      const eventRef = doc(db, 'events', eventId);
      const event = events.find((e) => e.id === eventId);
      if (!event) {
        toast.error('Event not found.');
        return;
      }

      // Check if the user has already requested to join or is already a member
      if (event.pendingInvites.includes(currentUser.uid) || event.invitedUsers.includes(currentUser.uid)) {
        toast.info('You have already requested to join this event or are already a member.');
        return;
      }

      // Update the event's pendingInvites
      await updateDoc(eventRef, {
        pendingInvites: arrayUnion(currentUser.uid),
      });

      // Send a notification to the event creator
      const notificationData: Omit<NotificationData, 'id'> = {
        type: 'join_request',
        message: `${username || currentUser.email?.split('@')[0] || 'User'} requested to join your event: ${event.title}`,
        eventId,
        eventTitle: event.title,
        userId: currentUser.uid,
        userName: username || currentUser.email?.split('@')[0] || 'User',
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      await addDoc(collection(db, 'users', event.userId, 'notifications'), notificationData);

      toast.success('Join request sent! Waiting for admin approval.');
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, pendingInvites: [...e.pendingInvites, currentUser.uid] } : e
        )
      );
    } catch (err: any) {
      toast.error('Failed to send join request: ' + err.message);
    }
  }, [currentUser, events, username]);

  // Handle joining the group chat
  const handleJoinGroupChat = async (eventId: string, notificationId: string) => {
    try {
      // Mark the notification as read
      const notificationRef = doc(db, 'users', currentUser!.uid, 'notifications', notificationId);
      await updateDoc(notificationRef, { status: 'unread' });

      // Navigate to the group chat
      navigate(`/events/${eventId}/chat`);
    } catch (err: any) {
      toast.error('Failed to join group chat: ' + err.message);
    }
  };

  // Handle scroll for "Back to Top" button visibility
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Focus management for the modal
  useEffect(() => {
    if (showMultiStepModal && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
        if (e.key === 'Escape') {
          setShowMultiStepModal(false);
        }
      };

      firstElement?.focus();
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showMultiStepModal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-200 to-gray-300 flex items-center justify-center px-4">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <svg
            className="animate-spin h-6 w-6 sm:h-8 sm:w-8 text-yellow-400"
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
          <span className="text-gray-800 text-sm sm:text-base font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null; // Redirect is handled in useEffect
  }

  if (loadingEvents) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-200 to-gray-300 flex items-center justify-center px-4">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <svg
            className="animate-spin h-6 w-6 sm:h-8 sm:w-8 text-yellow-400"
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
          <span className="text-gray-800 text-sm sm:text-base font-medium">Loading Events...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-sky-200 to-gray-300 text-gray-100">
      {/* Full-screen background with parallax effect and subtle animation */}
      <motion.div
        className="fixed inset-0 bg-cover bg-center bg-fixed z-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6)), url('https://images.unsplash.com/photo-1501386760812-e1ff2841f149?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')`,
        }}
        initial="initial"
        animate="animate"
        variants={backgroundAnimation}
      />

      <motion.section
        className="py-8 px-4 sm:py-16 sm:px-6 relative z-10"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <motion.div
          className="max-w-5xl mx-auto text-center bg-gray-800/60 backdrop-blur-lg rounded-2xl p-4 sm:p-8 shadow-2xl border border-gray-700/50"
          variants={fadeIn}
        >
          <motion.h1
            className="text-3xl sm:text-5xl font-extrabold text-yellow-400 mb-3 sm:mb-6 tracking-tight drop-shadow-md"
            initial="hidden"
            animate="visible"
            variants={headingFade}
          >
            {currentUser ? `Welcome, ${username}!` : 'Discover Amazing Events'}
          </motion.h1>
          <p className="text-base sm:text-xl mb-4 sm:mb-6 text-gray-200 leading-relaxed drop-shadow-md">
            {currentUser
              ? 'Create and join events that bring your community together.'
              : 'Sign up to explore and join events near you!'}
          </p>
          {error && (
            <motion.p
              className="text-red-400 text-xs sm:text-sm p-2 sm:p-3 bg-red-500/20 rounded-lg mb-4 sm:mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.p>
          )}
          {currentUser ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <motion.button
                onClick={() => {
                  setShowMultiStepModal(true);
                  if (newEvent.title) searchImages(newEvent.title);
                }}
                className="bg-yellow-400 text-gray-900 font-semibold rounded-full px-4 py-2 sm:px-6 sm:py-3 hover:bg-yellow-300 transition-all shadow-lg w-full sm:w-auto text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={multiStepLoading}
                aria-label="Create a new event"
              >
                {multiStepLoading ? 'Creating...' : 'Create Event'}
              </motion.button>
              <Link
                to="/profile"
                className="flex items-center text-yellow-400 hover:text-yellow-300 transition-colors font-medium text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 drop-shadow-md"
                aria-label={`View profile of ${username}`}
              >
                <FaUser className="mr-1 sm:mr-2" />
                <span>{username}</span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                to="/register"
                className="bg-yellow-400 text-gray-900 font-semibold rounded-full px-4 py-2 sm:px-6 sm:py-3 hover:bg-yellow-300 transition-all shadow-lg w-full sm:w-auto text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                aria-label="Sign up for an account"
              >
                Sign Up
              </Link>
              <Link
                to="/login"
                className="px-4 py-2 sm:px-6 sm:py-3 text-yellow-400 border border-yellow-400 rounded-full hover:bg-yellow-400 hover:text-gray-900 transition-all shadow-lg w-full sm:w-auto text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                aria-label="Log in to your account"
              >
                Log In
              </Link>
            </div>
          )}
        </motion.div>
      </motion.section>

      {/* Notifications Section */}
      {notifications.length > 0 && (
        <motion.section
          className="py-6 px-4 sm:py-10 sm:px-6 relative z-10"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div
            className="max-w-5xl mx-auto bg-gray-800/50 backdrop-blur-lg rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-700/50"
            variants={fadeIn}
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <FaBell className="text-yellow-400 text-xl sm:text-2xl" />
              <h2 className="text-xl sm:text-2xl font-bold text-yellow-400 drop-shadow-md">
                Your Notifications
                <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs sm:text-sm ml-2 sm:ml-3">
                  {notifications.filter((n) => n.status !== 'unread').length} New
                </span>
              </h2>
            </div>
            <motion.div className="space-y-3 sm:space-y-4" variants={stagger}>
              {notifications
                .filter((notification) => notification.type === 'join_response' && notification.status !== 'unread')
                .map((notification) => (
                  <motion.div
                    key={notification.id}
                    className="relative bg-gradient-to-r from-gray-700 to-gray-600 rounded-xl p-3 sm:p-4 shadow-lg border border-gray-600/50 overflow-hidden"
                    variants={fadeIn}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400" />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <FaInfoCircle className="text-blue-500 text-base sm:text-lg" />
                          <p className="text-xs sm:text-sm text-gray-200 drop-shadow-sm line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 drop-shadow-sm">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {notification.status === 'approved' && (
                        <motion.button
                          onClick={() => handleJoinGroupChat(notification.eventId, notification.id)}
                          className="bg-green-500 text-white px-3 py-1 sm:px-4 sm:py-2 rounded-lg hover:bg-green-600 transition-all text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-500 shadow-md w-full sm:w-auto"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          aria-label={`Join the group chat for ${notification.eventTitle}`}
                        >
                          Join Group Chat
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                ))}
            </motion.div>
            <div className="text-center mt-4 sm:mt-6">
              <Link
                to="/notifications"
                className="inline-block text-yellow-400 hover:text-yellow-300 transition-colors text-sm sm:text-base drop-shadow-md"
                aria-label="View all notifications"
              >
                View All Notifications
              </Link>
            </div>
          </motion.div>
        </motion.section>
      )}

      <motion.section
        className="py-8 px-4 sm:py-12 sm:px-6 relative z-10"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div
          className="max-w-6xl mx-auto bg-gray-800/50 backdrop-blur-lg rounded-2xl p-4 sm:p-8 shadow-2xl border border-gray-700/50"
          variants={fadeIn}
        >
          {events.length > 0 && (
            <motion.div
              className="mb-6 sm:mb-8 relative h-64 sm:h-80 bg-gray-700/50 rounded-xl overflow-hidden shadow-lg"
              variants={fadeIn}
            >
              <img
                src={events[0].image || defaultEventImage}
                alt={events[0].title}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
                onError={(e) => (e.currentTarget.src = defaultEventImage)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-4 sm:p-6 text-white">
                <h3 className="text-lg sm:text-2xl font-semibold line-clamp-1 drop-shadow-md">{events[0].title}</h3>
                <p className="text-sm sm:text-base mt-1 sm:mt-2 line-clamp-1 drop-shadow-md">
                  {new Date(events[0].date || events[0].createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm sm:text-base line-clamp-1 drop-shadow-md">{events[0].location || 'Location TBD'}</p>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-3 sm:mt-4">
                  <Link
                    to={`/events/${events[0].id}`}
                    className="inline-block bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-500 transition-all text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-red-500 w-full sm:w-auto text-center"
                    aria-label={`Learn more about ${events[0].title}`}
                  >
                    Learn More
                  </Link>
                  <motion.button
                    onClick={() => handleJoinEvent(events[0].id)}
                    className="bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 transition-all text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-auto"
                    whileTap={{ scale: 0.95 }}
                    disabled={events[0].pendingInvites.includes(currentUser?.uid || '') || events[0].invitedUsers.includes(currentUser?.uid || '')}
                    aria-label={`Request to join ${events[0].title}`}
                  >
                    {events[0].invitedUsers.includes(currentUser?.uid || '') ? 'Joined' : events[0].pendingInvites.includes(currentUser?.uid || '') ? 'Pending' : 'Join'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
            <motion.h2
              className="text-xl sm:text-3xl font-bold text-yellow-400 drop-shadow-md"
              initial="hidden"
              animate="visible"
              variants={headingFade}
            >
              Upcoming Events
              <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs sm:text-sm ml-2 sm:ml-3">
                {events.length} Live
              </span>
            </motion.h2>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-56">
                <input
                  type="text"
                  placeholder="Search events..."
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    debouncedSetSearchTerm(e.target.value);
                  }}
                  className="w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base pr-8 sm:pr-10"
                  aria-label="Search events by title or location"
                />
                {inputValue && (
                  <button
                    onClick={() => {
                      setInputValue('');
                      setSearchTerm('');
                    }}
                    className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-yellow-400 transition-colors"
                    aria-label="Clear search"
                  >
                    <FaTimesCircle size={16} className="sm:size-18" />
                  </button>
                )}
              </div>
              <div className="relative w-full sm:w-36">
                <label htmlFor="category-select" className="sr-only">Select Category</label>
                <select
                  id="category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                  aria-label="Select event category"
                >
                  <option value="All">All Categories</option>
                  <option value="Music">Music</option>
                  <option value="Food">Food</option>
                  <option value="Tech">Tech</option>
                  <option value="General">General</option>
                </select>
              </div>
              {selectedCategory !== 'All' && (
                <button
                  onClick={() => setSelectedCategory('All')}
                  className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm sm:text-base drop-shadow-md"
                  aria-label="Reset category filter"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>
          {events.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
              initial="hidden"
              animate="visible"
              variants={stagger}
            >
              {events.slice(1).map((event) => (
                <motion.div
                  key={event.id}
                  className="relative h-64 sm:h-80 bg-gray-700/50 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-105"
                  variants={fadeIn}
                  whileTap={{ scale: 0.98 }}
                >
                  <img
                    src={event.image || defaultEventImage}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                    loading="lazy"
                    onError={(e) => (e.currentTarget.src = defaultEventImage)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-3 sm:p-4 text-white">
                    <h3 className="text-base sm:text-xl font-semibold line-clamp-1 drop-shadow-md">{event.title}</h3>
                    <p className="text-xs sm:text-sm mt-1 line-clamp-1 drop-shadow-md">
                      {new Date(event.date || event.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs sm:text-sm line-clamp-1 drop-shadow-md">{event.location || 'Location TBD'}</p>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-2 sm:mt-3">
                      <Link
                        to={`/events/${event.id}`}
                        className="inline-block bg-red-600 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-full hover:bg-red-500 transition-all text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 w-full sm:w-auto text-center"
                        aria-label={`Learn more about ${event.title}`}
                      >
                        Learn More
                      </Link>
                      <motion.button
                        onClick={() => handleJoinEvent(event.id)}
                        className="bg-green-500 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-full hover:bg-green-600 transition-all text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-auto"
                        whileTap={{ scale: 0.95 }}
                        disabled={event.pendingInvites.includes(currentUser?.uid || '') || event.invitedUsers.includes(currentUser?.uid || '')}
                        aria-label={`Request to join ${event.title}`}
                      >
                        {event.invitedUsers.includes(currentUser?.uid || '') ? 'Joined' : event.pendingInvites.includes(currentUser?.uid || '') ? 'Pending' : 'Join'}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              className="text-center text-gray-200 bg-gray-700/50 backdrop-blur-lg rounded-2xl p-4 sm:p-6 shadow-xl border border-gray-600/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-sm sm:text-base">No upcoming events found.</p>
              <Link
                to="/events"
                className="mt-3 sm:mt-4 inline-block bg-yellow-400 text-gray-900 px-4 sm:px-5 py-2 rounded-full hover:bg-yellow-300 transition-all text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                aria-label="Explore all events"
              >
                Explore All Events
              </Link>
            </motion.div>
          )}
          {events.length > 0 && (
            <div className="text-center mt-6 sm:mt-8">
              <Link
                to="/events"
                className="inline-block bg-yellow-400 text-gray-900 px-4 sm:px-6 py-2 sm:py-3 rounded-full hover:bg-yellow-300 transition-all text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-lg"
                aria-label="Explore all events"
              >
                Explore All Events
              </Link>
            </div>
          )}
        </motion.div>
      </motion.section>

      {/* Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-yellow-400 text-gray-900 p-3 sm:p-4 rounded-full shadow-lg hover:bg-yellow-300 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 z-20"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Scroll back to top"
          >
            <FaArrowUp size={16} className="sm:size-20" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Multi-Step Modal for Event Creation */}
      <AnimatePresence>
        {showMultiStepModal && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMultiStepModal(false)}
          >
            <motion.div
              ref={modalRef}
              className="bg-gray-800 rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700/50"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-yellow-400 drop-shadow-md">
                  Create Event - Step {step} of 3
                </h2>
                <button
                  onClick={() => setShowMultiStepModal(false)}
                  className="text-gray-400 hover:text-yellow-400 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  aria-label="Close modal"
                >
                  <FaTimes size={20} className="sm:size-24" />
                </button>
              </div>

              {/* Step 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-xs sm:text-sm font-medium text-gray-200">
                      Event Title
                    </label>
                    <input
                      id="title"
                      type="text"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="mt-1 w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      placeholder="Enter event title"
                      aria-label="Event title"
                    />
                  </div>
                  <div>
                    <label htmlFor="location" className="block text-xs sm:text-sm font-medium text-gray-200">
                      Location
                    </label>
                    <input
                      id="location"
                      type="text"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      className="mt-1 w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      placeholder="Enter event location"
                      aria-label="Event location"
                    />
                  </div>
                  <div>
                    <label htmlFor="date" className="block text-xs sm:text-sm font-medium text-gray-200">
                      Date
                    </label>
                    <input
                      id="date"
                      type="datetime-local"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="mt-1 w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      aria-label="Event date and time"
                    />
                  </div>
                  <div>
                    <label htmlFor="category" className="block text-xs sm:text-sm font-medium text-gray-200">
                      Category
                    </label>
                    <select
                      id="category"
                      value={newEvent.category}
                      onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as 'General' | 'Music' | 'Food' | 'Tech' })}
                      className="mt-1 w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      aria-label="Event category"
                    >
                      <option value="General">General</option>
                      <option value="Music">Music</option>
                      <option value="Food">Food</option>
                      <option value="Tech">Tech</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Step 2: Additional Details */}
              {step === 2 && (
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label htmlFor="description" className="block text-xs sm:text-sm font-medium text-gray-200">
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      className="mt-1 w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      placeholder="Describe your event"
                      rows={3}
                      aria-label="Event description"
                    />
                  </div>
                  <div>
                    <label htmlFor="visibility" className="block text-xs sm:text-sm font-medium text-gray-200">
                      Visibility
                    </label>
                    <select
                      id="visibility"
                      value={newEvent.visibility}
                      onChange={(e) => setNewEvent({ ...newEvent, visibility: e.target.value as 'public' | 'private' })}
                      className="mt-1 w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      aria-label="Event visibility"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  {newEvent.visibility === 'private' && (
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-200">Invite Followers</label>
                      <div className="mt-2 space-y-2 max-h-32 sm:max-h-40 overflow-y-auto">
                        {followers.map((followerId) => (
                          <div key={followerId} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`follower-${followerId}`}
                              checked={newEvent.organizers.includes(followerId)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewEvent({ ...newEvent, organizers: [...newEvent.organizers, followerId] });
                                } else {
                                  setNewEvent({
                                    ...newEvent,
                                    organizers: newEvent.organizers.filter((id) => id !== followerId),
                                  });
                                }
                              }}
                              className="h-4 w-4 text-yellow-400 border-gray-600 rounded focus:ring-yellow-400"
                            />
                            <label htmlFor={`follower-${followerId}`} className="text-xs sm:text-sm text-gray-200">
                              {followerNames[followerId] || 'Unknown User'}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Image Selection */}
              {step === 3 && (
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-200">Search for an Image</label>
                    <input
                      type="text"
                      value={newEvent.title}
                      onChange={(e) => {
                        setNewEvent({ ...newEvent, title: e.target.value });
                        searchImages(e.target.value);
                      }}
                      className="mt-1 w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      placeholder="Search for an image..."
                      aria-label="Search for an event image"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 max-h-48 sm:max-h-60 overflow-y-auto">
                    {searchedImages.map((image: string, index: number) => (
                      <motion.img
                        key={index}
                        src={image}
                        alt={`Search result ${index + 1}`}
                        className={`w-full h-20 sm:h-24 object-cover rounded-lg cursor-pointer border-2 ${
                          selectedImageIndex === index ? 'border-yellow-400' : 'border-gray-600'
                        }`}
                        onClick={() => {
                          setSelectedImageIndex(index);
                          setNewEvent({ ...newEvent, selectedImage: image });
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        loading="lazy"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-3 mt-4 sm:mt-6">
                {step > 1 && (
                  <motion.button
                    onClick={handlePrevStep}
                    className="bg-gray-600 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg hover:bg-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 w-full sm:w-auto text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Previous step"
                  >
                    Previous
                  </motion.button>
                )}
                {step < 3 ? (
                  <motion.button
                    onClick={handleNextStep}
                    className="bg-yellow-400 text-gray-900 px-3 sm:px-4 py-1 sm:py-2 rounded-lg hover:bg-yellow-300 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 w-full sm:w-auto text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={
                      (step === 1 && (!newEvent.title || !newEvent.location || !newEvent.date)) ||
                      (step === 2 && !newEvent.description)
                    }
                    aria-label="Next step"
                  >
                    Next
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={multiStepHandleCreateEvent}
                    className="bg-green-500 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg hover:bg-green-600 transition-all focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-auto text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={multiStepLoading || !newEvent.selectedImage}
                    aria-label="Create event"
                  >
                    {multiStepLoading ? 'Creating...' : 'Create Event'}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Home;