// src/pages/Events.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { onSnapshot, collection, query, QueryDocumentSnapshot, updateDoc, doc, getDoc, addDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import defaultEventImage from '../assets/default-event.jpg';
import { multiStepCreateEvent } from '../services/eventCreation';
import { db } from '../services/firebase';
import { EventData, MultiStepEventData, NormalizedEventData, EventCategory } from '../types';
import { normalizeEventData } from '../utils/normalizeEvent';
import { FaPlus, FaCheck, FaTimes, FaEllipsisH, FaComments, FaTrash } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';

function Events() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<NormalizedEventData[]>([]);
  const [accessibleEvents, setAccessibleEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSuccess = useCallback((newEventData: NormalizedEventData) => {
    setEvents((prev) => {
      const updatedEvents = [newEventData, ...prev.filter((event) => event.id !== newEventData.id)].slice(0, 4);
      return updatedEvents;
    });
    setShowModal(false);
    toast.success('Event created successfully!');
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
    toast.error(message);
  }, []);

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
  } = multiStepCreateEvent({
    userId: currentUser?.uid || '',
    onSuccess: handleSuccess,
    onError: handleError,
  });

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

  useEffect(() => {
    if (!currentUser) {
      setAccessibleEvents([]);
      return;
    }

    const userEventsQuery = query(collection(db, 'events'));
    const unsubscribeUserEvents = onSnapshot(
      userEventsQuery,
      (snapshot) => {
        const userEvents = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as EventData[];
        const accessible = userEvents
          .filter(
            (e) =>
              e?.organizers?.includes(currentUser.uid) || e?.invitedUsers?.includes(currentUser.uid)
          )
          .map((e) => e.id);
        setAccessibleEvents(accessible);
      },
      (err: any) => {
        if (err.code === 'permission-denied') {
          console.warn('Permission denied when fetching user-specific events.');
        } else {
          console.error('Error fetching user events:', err);
        }
      }
    );

    return () => unsubscribeUserEvents();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setError('Please sign in to view events.');
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);
    const today = new Date();

    const eventsQuery = query(collection(db, 'events'));
    const unsubscribeEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const eventData = snapshot.docs.map((doc: QueryDocumentSnapshot) => {
          const data = doc.data();
          return normalizeEventData({ id: doc.id, ...data } as EventData);
        });

        const uniqueEventsMap = new Map<string, NormalizedEventData>();
        eventData.forEach((event) => {
          uniqueEventsMap.set(event.id, event);
        });
        const uniqueEvents = Array.from(uniqueEventsMap.values());

        const filteredEvents = uniqueEvents
          .filter((event) => {
            const eventDate = new Date(event.date || event.createdAt);
            const isPublic = event.visibility === 'public';
            const isAccessible = accessibleEvents.includes(event.id);
            return eventDate >= today && (isPublic || isAccessible);
          })
          .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
          .slice(0, 4);

        setEvents(filteredEvents);
        setLoading(false);
      },
      (err: any) => {
        if (err.code === 'permission-denied') {
          setError('You do not have permission to view events. Please sign in.');
          toast.error('Permission denied: Unable to access events.');
          navigate('/login');
        } else {
          setError(`Failed to load events: ${err.message}. Check permissions or network.`);
          toast.error(`Failed to load events: ${err.message}`);
        }
        setLoading(false);
      }
    );

    return () => unsubscribeEvents();
  }, [currentUser, navigate, accessibleEvents]);

  const handleServiceSelection = useCallback(
    async (eventId: string, serviceType: 'music' | 'decoration' | 'photography') => {
      const categoryMap: { [key: string]: string } = {
        music: 'Music',
        decoration: 'Decoration',
        photography: 'Photography',
      };
      const category = categoryMap[serviceType];
      navigate(`/businesses?eventId=${eventId}&category=${category}`);
      setMenuOpen(null);
    },
    [navigate]
  );

  const handleAddServiceToEvent = useCallback(
    async (eventId: string, businessId: string, businessName: string, serviceType: string) => {
      try {
        const eventRef = doc(db, 'events', eventId);
        const eventSnap = await getDoc(eventRef);
        if (!eventSnap.exists()) {
          throw new Error('Event not found');
        }
        const eventData = eventSnap.data() as EventData;

        await updateDoc(eventRef, {
          service: {
            businessId,
            businessName,
            type: serviceType,
          },
          products: [],
        });

        toast.success(`Service (${serviceType}) added to event by ${businessName}.`);

        const members = [...(eventData.invitedUsers || []), ...(eventData.organizers || [])].filter(
          (userId) => userId !== currentUser?.uid
        );
        const notificationPromises = members.map((userId) =>
          addDoc(collection(db, 'users', userId, 'notifications'), {
            type: 'event_update',
            eventId: eventId,
            eventTitle: eventData.title,
            message: `A new service (${serviceType}) by ${businessName} has been added to event "${eventData.title}".`,
            createdAt: new Date().toISOString(),
            status: 'unread',
          })
        );
        await Promise.all(notificationPromises);
      } catch (err) {
        toast.error('Failed to add service to event.');
        console.error(err);
      }
    },
    [currentUser]
  );

  const handleRemoveServiceFromEvent = useCallback(
    async (eventId: string, eventTitle: string) => {
      try {
        const eventRef = doc(db, 'events', eventId);
        const eventSnap = await getDoc(eventRef);
        if (!eventSnap.exists()) {
          throw new Error('Event not found');
        }
        const eventData = eventSnap.data() as EventData;
        const members = [...(eventData.invitedUsers || []), ...(eventData.organizers || [])].filter(
          (userId) => userId !== currentUser?.uid
        );

        await updateDoc(eventRef, { service: null, products: [] });
        toast.success('Service removed from event.');

        const notificationPromises = members.map((userId) =>
          addDoc(collection(db, 'users', userId, 'notifications'), {
            type: 'event_update',
            eventId: eventId,
            eventTitle: eventTitle,
            message: `Service has been removed from event "${eventTitle}".`,
            createdAt: new Date().toISOString(),
            status: 'unread',
          })
        );
        await Promise.all(notificationPromises);
      } catch (err) {
        toast.error('Failed to remove service from event.');
        console.error(err);
      }
    },
    [currentUser]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showModal && modalRef.current) {
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
          setShowModal(false);
        }
      };

      firstElement?.focus();
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showModal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center">
        <div className="flex items-center space-x-3">
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
          <span className="text-neutral-lightGray text-base sm:text-lg font-medium">Loading Events...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center flex-col">
        <p className="text-red-500 text-sm sm:text-lg">{error}</p>
        {currentUser && (
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-accent-gold text-neutral-darkGray font-semibold rounded-full px-5 py-2 sm:px-6 sm:py-3 hover:bg-yellow-300 transition-all shadow-lg text-sm sm:text-base"
          >
            Retry
          </button>
        )}
        {!currentUser && (
          <Link
            to="/login"
            className="mt-4 bg-accent-gold text-neutral-darkGray font-semibold rounded-full px-5 py-2 sm:px-6 sm:py-3 hover:bg-yellow-300 transition-all shadow-lg text-sm sm:text-base"
          >
            Sign In
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray">
      <motion.section
        className="py-8 px-4 sm:py-12 sm:px-6 relative z-10"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <motion.div
          className="max-w-6xl mx-auto bg-neutral-mediumGray/50 backdrop-blur-lg rounded-2xl p-4 sm:p-8 shadow-xl border border-neutral-mediumGray/50"
          variants={fadeIn}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
            <motion.h2
              className="text-xl sm:text-3xl font-bold text-accent-gold"
              initial="hidden"
              animate="visible"
              variants={headingFade}
            >
              All Events
              <span className="bg-red-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ml-2 sm:ml-3">
                {events.length} Live
              </span>
            </motion.h2>
            {currentUser && (
              <motion.button
                onClick={() => {
                  setShowModal(true);
                  if (newEvent.title) searchImages(newEvent.title);
                }}
                className="bg-accent-gold text-neutral-darkGray font-semibold rounded-full px-5 py-2 sm:px-6 sm:py-3 hover:bg-yellow-300 transition-all shadow-lg min-w-[150px] sm:min-w-[180px] text-sm sm:text-base"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={multiStepLoading}
              >
                {multiStepLoading ? 'Creating...' : 'Create Event'}
              </motion.button>
            )}
          </div>
          {events.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
              initial="hidden"
              animate="visible"
              variants={stagger}
            >
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  className="bg-neutral-darkGray rounded-lg overflow-hidden shadow-md relative"
                  variants={fadeIn}
                >
                  <div
                    className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium ${
                      event.visibility === 'public'
                        ? 'bg-green-500/80 text-white'
                        : 'bg-red-500/80 text-white'
                    }`}
                  >
                    {event.visibility === 'public' ? 'Public' : 'Private'}
                  </div>

                  <div className="absolute top-2 right-2 flex space-x-2">
                    {currentUser?.uid === event.userId && (
                      <motion.button
                        onClick={() => handleServiceSelection(event.id, 'music')}
                        className="text-neutral-lightGray hover:text-accent-gold transition-colors p-1"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        aria-label="Add service to event"
                      >
                        <FaPlus size={16} />
                      </motion.button>
                    )}
                    <motion.button
                      onClick={() => setMenuOpen(menuOpen === event.id ? null : event.id)}
                      className="text-neutral-lightGray hover:text-accent-gold transition-colors p-1"
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label="More options"
                    >
                      <FaEllipsisH size={16} />
                    </motion.button>
                    <AnimatePresence>
                      {menuOpen === event.id && currentUser?.uid === event.userId && (
                        <motion.div
                          ref={menuRef}
                          className="absolute right-0 mt-2 w-48 bg-neutral-mediumGray/90 backdrop-blur-lg rounded-lg shadow-lg border border-neutral-mediumGray/50 z-10"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                        >
                          <button
                            onClick={() => handleServiceSelection(event.id, 'music')}
                            className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-secondary-deepRed/50 rounded-t-lg"
                          >
                            Add Music
                          </button>
                          <button
                            onClick={() => handleServiceSelection(event.id, 'decoration')}
                            className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-secondary-deepRed/50"
                          >
                            Add Decoration
                          </button>
                          <button
                            onClick={() => handleServiceSelection(event.id, 'photography')}
                            className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-secondary-deepRed/50 rounded-b-lg"
                          >
                            Add Photography
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <img
                    src={event.image || defaultEventImage}
                    alt={event.title}
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-accent-gold">{event.title}</h3>
                    <p className="text-sm text-neutral-lightGray mt-1">
                      {new Date(event.date || event.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-neutral-lightGray mt-1">{event.location || 'Location TBD'}</p>

                    {event.service && (
                      <div className="mt-2 flex items-center space-x-2">
                        <Link
                          to={`/business-profiles/${event.service.businessId}`}
                          className="inline-block px-3 py-1 bg-blue-500/80 text-white rounded-full text-xs font-medium hover:bg-blue-600 transition-colors"
                        >
                          {event.service.type.charAt(0).toUpperCase() + event.service.type.slice(1)} by {event.service.businessName}
                        </Link>
                        {currentUser?.uid === event.userId && (
                          <motion.button
                            onClick={() => handleRemoveServiceFromEvent(event.id, event.title)}
                            className="text-red-500 hover:text-red-400 transition-colors"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            aria-label="Remove service"
                          >
                            <FaTrash size={14} />
                          </motion.button>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex space-x-2">
                      <Link
                        to={`/events/${event.id}`}
                        className="px-4 py-2 bg-accent-gold text-neutral-darkGray rounded-full hover:bg-yellow-300 transition-all text-sm font-medium"
                      >
                        View Details
                      </Link>
                      {currentUser && accessibleEvents.includes(event.id) && (
                        <Link
                          to={`/chat/${event.id}`}
                          className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-all text-sm font-medium flex items-center space-x-1"
                          onClick={() => console.log('Navigating to chat for event:', event.id)}
                        >
                          <FaComments size={14} />
                          <span>Join Chat</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-center text-neutral-lightGray text-sm sm:text-base">
              No events found. Be the first to create one!
            </p>
          )}
        </motion.div>
      </motion.section>

      {showModal && currentUser && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <motion.div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-200 rounded-2xl max-w-md w-full mx-2 p-4 sm:p-6 relative shadow-2xl border border-gray-300"
            role="dialog"
            aria-labelledby="multi-step-create-event-title"
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <motion.button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-black hover:text-accent-gold transition-colors z-10"
              whileHover={{ scale: 1.2, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Close modal"
            >
              <FaTimes size={20} />
            </motion.button>

            <motion.h3
              id="multi-step-create-event-title"
              className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6 text-center"
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
                      stepNum <= step ? 'bg-accent-gold text-black' : 'bg-gray-400 text-black'
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
                        stepNum < step ? 'bg-accent-gold' : 'bg-gray-400'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && (
              <motion.p
                className="text-red-600 text-xs sm:text-sm p-2 sm:p-3 bg-red-100 rounded-lg mb-3 sm:mb-4 text-center"
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
                    <label htmlFor="title" className="block text-xs sm:text-sm text-black mb-1">
                      Event Title
                    </label>
                    <input
                      id="title"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full p-2 sm:p-3 rounded-lg bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base placeholder-gray-500"
                      placeholder="Enter event title"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="location" className="block text-xs sm:text-sm text-black mb-1">
                      Location
                    </label>
                    <input
                      id="location"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      className="w-full p-2 sm:p-3 rounded-lg bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base placeholder-gray-500"
                      placeholder="Enter location"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="date" className="block text-xs sm:text-sm text-black mb-1">
                      Date
                    </label>
                    <input
                      id="date"
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="w-full p-2 sm:p-3 rounded-lg bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base"
                      required
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <label htmlFor="visibility" className="block text-xs sm:text-sm text-black mb-1">
                      Visibility
                    </label>
                    <select
                      id="visibility"
                      value={newEvent.visibility}
                      onChange={(e) => setNewEvent({ ...newEvent, visibility: e.target.value as 'public' | 'private' })}
                      className="w-full p-2 sm:p-3 rounded-lg bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="category" className="block text-xs sm:text-sm text-black mb-1">
                      Category
                    </label>
                    <select
                      id="category"
                      value={newEvent.category}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          category: e.target.value as EventCategory,
                        })
                      }
                      className="w-full p-2 sm:p-3 rounded-lg bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base"
                    >
                      <option value="General">General</option>
                      <option value="Music">Music</option>
                      <option value="Food">Food</option>
                      <option value="Tech">Tech</option>
                    </select>
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => {
                      if (newEvent.title) searchImages(newEvent.title);
                      handleNextStep();
                    }}
                    className="w-full bg-accent-gold text-black p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={multiStepLoading || !newEvent.title || !newEvent.location || !newEvent.date}
                  >
                    Next
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="w-full bg-gray-400 text-black p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
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
                  <p className="text-black text-center text-sm sm:text-base">Would you like to invite collaborators?</p>
                  <motion.button
                    onClick={() => handleNextStep()}
                    className="w-full bg-gray-400 text-black p-2 sm:p-3 rounded-lg hover:bg-gray-                    500 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    No
                  </motion.button>
                  {followers.length > 0 && (
                    <motion.button
                      onClick={handleNextStep}
                      className="w-full bg-accent-gold text-black p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Yes
                    </motion.button>
                  )}
                  <div>
                    <h3 className="text-xs sm:text-sm text-black mb-2">Your Followers:</h3>
                    {followers.length > 0 ? (
                      <div className="max-h-32 sm:max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
                        {followers.map((followerId: string) => (
                          <motion.div
                            key={followerId}
                            className="flex items-center justify-between py-1 sm:py-2 px-2 sm:px-3 bg-gray-300 rounded-lg mb-2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                          >
                            <span className="text-xs sm:text-sm text-black">{followerNames[followerId] || followerId}</span>
                            <motion.button
                              onClick={() =>
                                setNewEvent((prev: MultiStepEventData) => {
                                  if (!prev.organizers.includes(followerId)) {
                                    return { ...prev, organizers: [...prev.organizers, followerId] };
                                  }
                                  return prev;
                                })
                              }
                              className="text-accent-gold hover:text-yellow-300 transition-colors"
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                              aria-label={`Add ${followerNames[followerId] || followerId} as organizer`}
                            >
                              <FaPlus size={14} />
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-black text-center">You have no followers yet.</p>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-black text-center">
                    Selected Organizers: {newEvent.organizers.map((org: string) => followerNames[org] || org).join(', ') || 'None'}
                  </p>
                  <motion.button
                    onClick={() => {
                      const link = createShareLink();
                      toast.success(`Invite link created: ${link}`);
                    }}
                    className="w-full bg-accent-gold text-black p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Create Share Link
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handlePrevStep}
                    className="w-full bg-gray-400 text-black p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Back
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="w-full bg-gray-400 text-black p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
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
                  <p className="text-black text-center text-sm sm:text-base">Select an image for your event:</p>
                  {searchedImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 max-h-40 sm:max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
                      {searchedImages.map((url: string, index: number) => (
                        <motion.img
                          key={index}
                          src={url}
                          alt={`Event photo option ${index + 1}`}
                          className={`w-full h-20 sm:h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-all ${
                            selectedImageIndex === index ? 'border-4 border-accent-gold' : 'border-2 border-transparent'
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
                    <p className="text-xs sm:text-sm text-black text-center">No images found. Please proceed.</p>
                  )}
                  <div>
                    <label htmlFor="description" className="block text-xs sm:text-sm text-black mb-1 sm:mb-2">
                      Description (optional)
                    </label>
                    <textarea
                      id="description"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      className="w-full p-2 sm:p-3 rounded-lg bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base placeholder-gray-500"
                      rows={3}
                      placeholder="Describe your event..."
                    />
                  </div>
                  <motion.button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full bg-accent-gold text-black p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={multiStepLoading || !newEvent.selectedImage}
                  >
                    Next
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handlePrevStep}
                    className="w-full bg-gray-400 text-black p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Back
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="w-full bg-gray-400 text-black p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
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
                  <p className="text-black text-center mb-3 sm:mb-4 text-sm sm:text-base">Preview your event:</p>
                  <motion.div
                    className="relative w-full h-72 sm:h-80 bg-gray-300 rounded-xl overflow-hidden shadow-lg transition-all duration-300"
                    whileTap={{ scale: 0.98 }}
                  >
                    <img
                      src={newEvent.selectedImage || userPhotoURL || defaultEventImage}
                      alt={newEvent.title}
                      className="w-full h-full object-cover"
                      onError={(e) => (e.currentTarget.src = defaultEventImage)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-3 sm:p-4 text-white">
                      <h3 className="text-base sm:text-xl font-semibold line-clamp-1">{newEvent.title}</h3>
                      <p className="text-xs sm:text-sm mt-1 line-clamp-1">{new Date(newEvent.date).toLocaleDateString()}</p>
                      <p className="text-xs sm:text-sm line-clamp-1">{newEvent.location || 'Location TBD'}</p>
                      <p className="text-xs sm:text-sm line-clamp-2 mt-1">{newEvent.description || 'No description'}</p>
                    </div>
                  </motion.div>
                  <motion.button
                    onClick={multiStepHandleCreateEvent}
                    className="w-full bg-accent-gold text-black p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={multiStepLoading}
                  >
                    {multiStepLoading ? 'Creating...' : 'Create Event'}
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handlePrevStep}
                    className="w-full bg-gray-400 text-black p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Back
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="w-full bg-gray-400 text-black p-2 sm:p-3 rounded-lg hover:bg-gray-500 transition-all text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
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

export default Events;