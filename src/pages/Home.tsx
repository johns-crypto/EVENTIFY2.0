// src/pages/Home.tsx
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { onSnapshot, collection, query, where, updateDoc, doc, arrayUnion, Timestamp, addDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import defaultEventImage from '../assets/default-event.jpg';
import { multiStepCreateEvent, MultiStepEventData } from '../services/eventCreation';
import { db, getUserData } from '../services/firebase';
import { FaCheck, FaUser, FaTimes, FaPlus } from 'react-icons/fa';
import debounce from 'lodash/debounce';
import { NormalizedEventData } from '../types';

interface UserData {
  displayName?: string;
  photoURL?: string;
  followers?: string[];
}

interface NotificationData {
  id: string;
  type: 'join_request';
  eventId: string;
  userId: string;
  eventTitle: string;
  userName: string;
  message: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'denied';
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

  // Initialize multiStepCreateEvent only if currentUser exists
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
    createShareLink,
    userPhotoURL,
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
      category: 'General' as 'General' | 'Music' | 'Food' | 'Tech' | 'Refreshments' | 'Catering/Food' | 'Venue Provider',
    },
    setNewEvent: () => {},
    handleNextStep: () => {},
    handlePrevStep: () => {},
    handleCreateEvent: () => Promise.resolve(),
    loading: false,
    searchedImages: [],
    followers: [],
    followerNames: {},
    createShareLink: () => '',
    userPhotoURL: null,
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

  const debouncedSetSearchTerm = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300),
    []
  );

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

      await updateDoc(eventRef, {
        pendingInvites: arrayUnion(currentUser.uid),
      });

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <svg
            className="animate-spin h-8 w-8 text-yellow-400"
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
          <span className="text-gray-300 text-base sm:text-lg font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null; // Redirect is handled in useEffect
  }

  if (loadingEvents) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <svg
            className="animate-spin h-8 w-8 text-yellow-400"
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
          <span className="text-gray-300 text-base sm:text-lg font-medium">Loading Events...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-gray-200 relative">
      <motion.section
        className="py-8 px-4 sm:py-16 sm:px-6 relative z-10 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9)), url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80')`,
        }}
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <motion.div
          className="max-w-5xl mx-auto text-center bg-gray-800/60 backdrop-blur-lg rounded-2xl p-4 sm:p-8 shadow-xl border border-gray-700/50"
          variants={fadeIn}
        >
          <motion.h1
            className="text-3xl sm:text-5xl font-extrabold text-yellow-400 mb-3 sm:mb-6 tracking-tight"
            initial="hidden"
            animate="visible"
            variants={headingFade}
          >
            {currentUser ? `Welcome, ${username}!` : 'Discover Amazing Events'}
          </motion.h1>
          <p className="text-base sm:text-xl mb-4 sm:mb-8 text-gray-300 leading-relaxed">
            {currentUser
              ? 'Create and join events that bring your community together.'
              : 'Sign up to explore and join events near you!'}
          </p>
          {error && (
            <motion.p
              className="text-red-400 text-sm p-2 sm:p-3 bg-red-500/20 rounded-lg mb-4 sm:mb-6"
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
                className="bg-yellow-400 text-gray-900 font-semibold rounded-full px-5 py-2 sm:px-6 sm:py-3 hover:bg-yellow-300 transition-all shadow-lg min-w-[150px] sm:min-w-[180px] text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={multiStepLoading}
                aria-label="Create a new event"
              >
                {multiStepLoading ? 'Creating...' : 'Create Event'}
              </motion.button>
              <Link
                to="/profile"
                className="flex items-center text-yellow-400 hover:text-yellow-300 transition-colors font-medium text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                aria-label={`View profile of ${username}`}
              >
                <FaUser className="mr-2" />
                <span>{username}</span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                to="/register"
                className="bg-yellow-400 text-gray-900 font-semibold rounded-full px-5 py-2 sm:px-6 sm:py-3 hover:bg-yellow-300 transition-all shadow-lg min-w-[150px] sm:min-w-[180px] text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                aria-label="Sign up for an account"
              >
                Sign Up
              </Link>
              <Link
                to="/login"
                className="px-5 py-2 sm:px-6 sm:py-3 text-yellow-400 border border-yellow-400 rounded-full hover:bg-yellow-400 hover:text-gray-900 transition-all shadow-lg font-medium min-w-[150px] sm:min-w-[180px] text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                aria-label="Log in to your account"
              >
                Log In
              </Link>
            </div>
          )}
        </motion.div>
      </motion.section>

      <motion.section
        className="py-8 px-4 sm:py-12 sm:px-6 relative z-0 -mt-6 sm:-mt-10"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div
          className="max-w-6xl mx-auto bg-gray-800/50 backdrop-blur-lg rounded-2xl p-4 sm:p-8 shadow-xl border border-gray-700/50"
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
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => (e.currentTarget.src = defaultEventImage)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4 sm:p-6 text-white">
                <h3 className="text-xl sm:text-2xl font-semibold line-clamp-1">{events[0].title}</h3>
                <p className="text-sm sm:text-base mt-1 line-clamp-1">
                  {new Date(events[0].date || events[0].createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm sm:text-base line-clamp-1">{events[0].location || 'Location TBD'}</p>
                <div className="flex gap-3 mt-3">
                  <Link
                    to={`/events/${events[0].id}`}
                    className="inline-block bg-red-600 text-white px-4 sm:px-5 py-1 sm:py-2 rounded-full hover:bg-red-500 transition-all text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label={`Learn more about ${events[0].title}`}
                  >
                    Learn More
                  </Link>
                  <motion.button
                    onClick={() => handleJoinEvent(events[0].id)}
                    className="bg-green-500 text-white px-4 sm:px-5 py-1 sm:py-2 rounded-full hover:bg-green-600 transition-all text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-green-500"
                    whileTap={{ scale: 0.95 }}
                    disabled={events[0].pendingInvites.includes(currentUser?.uid || '')}
                    aria-label={`Request to join ${events[0].title}`}
                  >
                    {events[0].pendingInvites.includes(currentUser?.uid || '') ? 'Pending' : 'Join'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
            <motion.h2
              className="text-xl sm:text-3xl font-bold text-yellow-400"
              initial="hidden"
              animate="visible"
              variants={headingFade}
            >
              Upcoming Events
              <span className="bg-red-600 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ml-2 sm:ml-3">
                {events.length} Live
              </span>
            </motion.h2>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search events..."
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  debouncedSetSearchTerm(e.target.value);
                }}
                className="w-full sm:w-56 p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                aria-label="Search events by title or location"
              />
              <div className="relative">
                <label htmlFor="category-select" className="sr-only">Select Category</label>
                <select
                  id="category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full sm:w-36 p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                  aria-label="Select event category"
                >
                  <option value="All">All Categories</option>
                  <option value="Music">Music</option>
                  <option value="Food">Food</option>
                  <option value="Tech">Tech</option>
                  <option value="General">General</option>
                </select>
              </div>
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
                  className="relative h-72 sm:h-80 bg-gray-700/50 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-2xl"
                  variants={fadeIn}
                  whileTap={{ scale: 0.98 }}
                >
                  <img
                    src={event.image || defaultEventImage}
                    alt={event.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => (e.currentTarget.src = defaultEventImage)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-3 sm:p-4 text-white">
                    <motion.h3
                      className="text-base sm:text-xl font-semibold line-clamp-1"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                    >
                      {event.title}
                    </motion.h3>
                    <motion.p
                      className="text-xs sm:text-sm mt-1 line-clamp-1"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                    >
                      {new Date(event.date || event.createdAt).toLocaleDateString()}
                    </motion.p>
                    <motion.p
                      className="text-xs sm:text-sm line-clamp-1"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.4 }}
                    >
                      {event.location || 'Location TBD'}
                    </motion.p>
                    <div className="flex gap-2 mt-2">
                      <motion.a
                        href={`/events/${event.id}`}
                        className="inline-block bg-red-600 text-white px-3 sm:px-4 py-1 sm:py-1 rounded-full hover:bg-red-500 transition-all text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.5 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label={`Learn more about ${event.title}`}
                      >
                        Learn More
                      </motion.a>
                      <motion.button
                        onClick={() => handleJoinEvent(event.id)}
                        className="bg-green-500 text-white px-3 sm:px-4 py-1 sm:py-1 rounded-full hover:bg-green-600 transition-all text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.6 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={event.pendingInvites.includes(currentUser?.uid || '')}
                        aria-label={`Request to join ${event.title}`}
                      >
                        {event.pendingInvites.includes(currentUser?.uid || '') ? 'Pending' : 'Join'}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-center text-gray-400 text-sm sm:text-base">
              No upcoming events found. Be the first to create one!
            </p>
          )}
          <div className="text-center mt-6 sm:mt-8">
            <Link
              to="/events"
              className="inline-block bg-yellow-400 text-gray-900 font-semibold rounded-full px-5 py-2 sm:px-6 sm:py-3 hover:bg-yellow-300 transition-all shadow-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
              aria-label="Explore all events"
            >
              Explore All Events
            </Link>
          </div>
        </motion.div>
      </motion.section>

      {showMultiStepModal && currentUser && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            className="bg-gray-800/90 backdrop-blur-lg rounded-2xl max-w-md w-full mx-2 p-4 sm:p-6 relative shadow-2xl border border-gray-700/50"
            role="dialog"
            aria-labelledby="multi-step-create-event-title"
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <motion.button
              type="button"
              onClick={() => setShowMultiStepModal(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-yellow-400 transition-colors z-10 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              whileHover={{ scale: 1.2, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Close modal"
            >
              <FaTimes size={20} />
            </motion.button>

            <motion.h3
              id="multi-step-create-event-title"
              className="text-xl sm:text-2xl font-bold text-yellow-400 mb-4 sm:mb-6 text-center"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {step === 1 && 'Step 1: Event Details'}
              {step === 2 && 'Step 2: Collaborators'}
              {step === 3 && 'Step 3: Image & Description'}
              {step === 4 && 'Step 4: Preview & Create'}
            </motion.h3>

            <div className="flex justify-between mb-4 sm:mb-6 relative">
              {[1, 2, 3, 4].map((stepNum) => (
                <div key={stepNum} className="flex flex-col items-center relative z-10">
                  <motion.div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all duration-300 ${
                      stepNum <= step ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-300'
                    }`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: stepNum * 0.1 }}
                  >
                    {stepNum < step ? <FaCheck size={14} /> : stepNum}
                  </motion.div>
                  {stepNum < 4 && (
                    <div
                      className={`absolute top-4 sm:top-5 left-1/2 w-[calc(100%+16px)] sm:w-[calc(100%+20px)] h-1 transform translate-x-4 sm:translate-x-5 ${
                        stepNum < step ? 'bg-yellow-400' : 'bg-gray-600'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && (
              <motion.p
                className="text-red-400 text-xs sm:text-sm p-2 sm:p-3 bg-red-500/20 rounded-lg mb-3 sm:mb-4 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {error}
              </motion.p>
            )}

            <div className="space-y-4 sm:space-y-6">
              {step === 1 && (
                <motion.form
                  className="space-y-3 sm:space-y-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div>
                    <label htmlFor="title" className="block text-xs sm:text-sm text-gray-300 mb-1">
                      Event Title
                    </label>
                    <input
                      id="title"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      placeholder="Enter event title"
                      required
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label htmlFor="location" className="block text-xs sm:text-sm text-gray-300 mb-1">
                      Location
                    </label>
                    <input
                      id="location"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      className="w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      placeholder="Enter location"
                      required
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label htmlFor="date" className="block text-xs sm:text-sm text-gray-300 mb-1">
                      Date
                    </label>
                    <input
                      id="date"
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label htmlFor="visibility" className="block text-xs sm:text-sm text-gray-300 mb-1">
                      Visibility
                    </label>
                    <select
                      id="visibility"
                      value={newEvent.visibility}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, visibility: e.target.value as 'public' | 'private' })
                      }
                      className="w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      aria-label="Select event visibility"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="category" className="block text-xs sm:text-sm text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      id="category"
                      value={newEvent.category}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          category: e.target.value as
                            | 'General'
                            | 'Music'
                            | 'Food'
                            | 'Tech'
                            | 'Refreshments'
                            | 'Catering/Food'
                            | 'Venue Provider',
                        })
                      }
                      className="w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      aria-label="Select event category"
                    >
                      <option value="General">General</option>
                      <option value="Music">Music</option>
                      <option value="Food">Food</option>
                      <option value="Tech">Tech</option>
                      <option value="Refreshments">Refreshments</option>
                      <option value="Catering/Food">Catering/Food</option>
                      <option value="Venue Provider">Venue Provider</option>
                    </select>
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => {
                      if (newEvent.title) searchImages(newEvent.title);
                      handleNextStep();
                    }}
                    className="w-full bg-yellow-400 text-gray-900 p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={multiStepLoading || !newEvent.title || !newEvent.location || !newEvent.date}
                    aria-label="Proceed to next step"
                  >
                    Next
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setShowMultiStepModal(false)}
                    className="w-full bg-gray-600 text-gray-300 p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gray-500"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Cancel event creation"
                  >
                    Cancel
                  </motion.button>
                </motion.form>
              )}
              {step === 2 && (
                <motion.div
                  className="space-y-3 sm:space-y-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <p className="text-gray-300 text-center text-sm sm:text-base">
                    Would you like to invite collaborators?
                  </p>
                  <motion.button
                    onClick={() => handleNextStep()}
                    className="w-full bg-gray-600 text-gray-300 p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all shadow-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gray-500"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Skip inviting collaborators"
                  >
                    Skip
                  </motion.button>
                  <div>
                    <h3 className="text-xs sm:text-sm text-gray-300 mb-2">Your Followers:</h3>
                    {followers.length > 0 ? (
                      <div className="max-h-32 sm:max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                        {followers.map((followerId: string) => (
                          <motion.div
                            key={followerId}
                            className="flex items-center justify-between py-1 sm:py-2 px-2 sm:px-3 bg-gray-700 rounded-lg mb-2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                          >
                            <span className="text-xs sm:text-sm text-gray-300">
                              {followerNames[followerId] || followerId}
                            </span>
                            <motion.button
                              onClick={() =>
                                setNewEvent((prev: MultiStepEventData) => {
                                  const isAlreadyOrganizer = prev.organizers.includes(followerId);
                                  if (isAlreadyOrganizer) {
                                    return {
                                      ...prev,
                                      organizers: prev.organizers.filter((id) => id !== followerId),
                                    };
                                  }
                                  return { ...prev, organizers: [...prev.organizers, followerId] };
                                })
                              }
                              className={`text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                                newEvent.organizers.includes(followerId)
                                  ? 'text-red-400 hover:text-red-300'
                                  : 'text-yellow-400 hover:text-yellow-300'
                              } transition-colors`}
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                              aria-label={
                                newEvent.organizers.includes(followerId)
                                  ? `Remove ${followerNames[followerId] || followerId} as organizer`
                                  : `Add ${followerNames[followerId] || followerId} as organizer`
                              }
                            >
                              {newEvent.organizers.includes(followerId) ? 'Remove' : <FaPlus size={14} />}
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-gray-400 text-center">
                        You have no followers to invite.
                      </p>
                    )}
                  </div>
                  {newEvent.organizers.length > 0 && (
                    <p className="text-xs sm:text-sm text-gray-300 text-center">
                      Selected Organizers:{' '}
                      {newEvent.organizers
                        .filter((org) => org !== currentUser.uid) // Exclude the current user
                        .map((org: string) => followerNames[org] || org)
                        .join(', ') || 'None'}
                    </p>
                  )}
                  <motion.button
                    onClick={() => {
                      const link = createShareLink();
                      toast.success(`Invite link created: ${link}`);
                      handleNextStep();
                    }}
                    className="w-full bg-yellow-400 text-gray-900 p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Create share link and proceed"
                  >
                    Create Share Link & Next
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handlePrevStep}
                    className="w-full bg-gray-600 text-gray-300 p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all shadow-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gray-500"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Go back to previous step"
                  >
                    Back
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setShowMultiStepModal(false)}
                    className="w-full bg-gray-600 text-gray-300 p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all shadow-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gray-500"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Cancel event creation"
                  >
                    Cancel
                  </motion.button>
                </motion.div>
              )}
              {step === 3 && (
                <motion.div
                  className="space-y-3 sm:space-y-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <p className="text-gray-300 text-center text-sm sm:text-base">
                    Select an image for your event:
                  </p>
                  {searchedImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 max-h-40 sm:max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                      {searchedImages.map((url: string, index: number) => (
                        <motion.img
                          key={index}
                          src={url}
                          alt={`Event photo option ${index + 1}`}
                          className={`w-full h-20 sm:h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-all ${
                            selectedImageIndex === index
                              ? 'border-4 border-yellow-400'
                              : 'border-2 border-transparent'
                          }`}
                          onClick={() => {
                            setSelectedImageIndex(index);
                            setNewEvent({ ...newEvent, selectedImage: url });
                          }}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          whileTap={{ scale: 0.95 }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-400 text-center">
                      No images found. Using default image.
                    </p>
                  )}
                  <div>
                    <label
                      htmlFor="description"
                      className="block text-xs sm:text-sm text-gray-300 mb-1 sm:mb-2"
                    >
                      Description (optional)
                    </label>
                    <textarea
                      id="description"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      className="w-full p-2 sm:p-3 rounded-lg bg-gray-700 text-gray-200 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm sm:text-base"
                      rows={3}
                      placeholder="Describe your event..."
                      aria-label="Event description"
                    />
                  </div>
                  <motion.button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full bg-yellow-400 text-gray-900 p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={multiStepLoading}
                    aria-label="Proceed to next step"
                  >
                    Next
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handlePrevStep}
                    className="w-full bg-gray-600 text-gray-300 p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all shadow-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gray-500"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Go back to previous step"
                  >
                    Back
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setShowMultiStepModal(false)}
                    className="w-full bg-gray-600 text-gray-300 p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all shadow-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gray-500"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Cancel event creation"
                  >
                    Cancel
                  </motion.button>
                </motion.div>
              )}
              {step === 4 && (
                <motion.div
                  className="space-y-3 sm:space-y-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <p className="text-gray-300 text-center mb-3 sm:mb-4 text-sm sm:text-base">
                    Preview your event:
                  </p>
                  <motion.div
                    className="relative w-full h-72 sm:h-80 bg-gray-700/50 rounded-xl overflow-hidden shadow-lg transition-all duration-300"
                    whileTap={{ scale: 0.98 }}
                  >
                    <img
                      src={newEvent.selectedImage || userPhotoURL || defaultEventImage}
                      alt={newEvent.title}
                      className="w-full h-full object-cover"
                      onError={(e) => (e.currentTarget.src = defaultEventImage)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-3 sm:p-4 text-white">
                      <h3 className="text-base sm:text-xl font-semibold line-clamp-1">
                        {newEvent.title}
                      </h3>
                      <p className="text-xs sm:text-sm mt-1 line-clamp-1">
                        {newEvent.date
                          ? new Date(newEvent.date).toLocaleDateString()
                          : 'Date TBD'}
                      </p>
                      <p className="text-xs sm:text-sm line-clamp-1">
                        {newEvent.location || 'Location TBD'}
                      </p>
                      <p className="text-xs sm:text-sm line-clamp-2 mt-1">
                        {newEvent.description || 'No description provided'}
                      </p>
                      <p className="text-xs sm:text-sm mt-1">
                        Visibility: {newEvent.visibility}
                      </p>
                      <p className="text-xs sm:text-sm">
                        Category: {newEvent.category}
                      </p>
                      {newEvent.inviteLink && (
                        <p className="text-xs sm:text-sm mt-1 break-all">
                          Invite Link: {newEvent.inviteLink}
                        </p>
                      )}
                    </div>
                  </motion.div>
                  <motion.button
                    onClick={multiStepHandleCreateEvent}
                    className="w-full bg-yellow-400 text-gray-900 p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={multiStepLoading}
                    aria-label="Create event"
                  >
                    {multiStepLoading ? 'Creating...' : 'Create Event'}
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handlePrevStep}
                    className="w-full bg-gray-600 text-gray-300 p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all shadow-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gray-500"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Go back to previous step"
                  >
                    Back
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setShowMultiStepModal(false)}
                    className="w-full bg-gray-600 text-gray-300 p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all shadow-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gray-500"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Cancel event creation"
                  >
                    Cancel
                  </motion.button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default Home;