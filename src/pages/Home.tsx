import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { getEvents, EventData, getUserData, db, storage } from '../services/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-toastify';

function Home() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventData[]>([]);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    location: '',
    image: null as File | null,
  });

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const stagger = {
    visible: { transition: { staggerChildren: 0.2 } },
  };

  const headingFade = {
    hidden: { opacity: 0, y: -30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut', type: 'spring', bounce: 0.3 },
    },
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Fetching events, user:', currentUser?.uid);
        const eventData = await getEvents();
        console.log('Fetched events:', eventData);
        setEvents(eventData);
      } catch (err: any) {
        setError('Failed to load events: ' + err.message);
        console.error('Error fetching events:', err);
        toast.error('Failed to load events.');
      } finally {
        setLoading(false);
      }

      if (currentUser) {
        console.log('Fetching user data for:', currentUser.uid);
        const userData = await getUserData(currentUser.uid);
        setUsername(userData?.displayName || currentUser.email?.split('@')[0] || 'User');
        if (!userData) console.warn('No user data found, using email fallback');
        console.log('User data:', userData);
      } else {
        setUsername('');
      }
    };

    fetchData();
  }, [currentUser, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError('Please log in to create an event.');
      toast.error('Please log in to create an event.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const eventId = doc(collection(db, 'events')).id;
      console.log('Creating event with ID:', eventId);
      let imageUrl = '';
      if (formData.image) {
        try {
          const storageRef = ref(storage, `events/${eventId}/${formData.image.name}`);
          console.log('Uploading image to:', storageRef.fullPath);
          await uploadBytes(storageRef, formData.image);
          imageUrl = await getDownloadURL(storageRef);
          console.log('Image URL:', imageUrl);
        } catch (uploadErr: any) {
          console.error('Image upload failed:', uploadErr);
          toast.warn('Event created without image due to upload failure.');
        }
      }

      const newEvent: EventData = {
        id: eventId,
        title: formData.title,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        date: formData.date,
        location: formData.location,
        image: imageUrl || '',
        visibility: 'public',
        organizers: [currentUser.uid],
        invitedUsers: [],
        pendingInvites: [],
      };

      console.log('Saving event:', newEvent);
      await setDoc(doc(db, 'events', eventId), newEvent);
      setEvents((prev) => [newEvent, ...prev]);
      setShowModal(false);
      setFormData({ title: '', date: '', location: '', image: null });
      toast.success('Event created successfully!');
    } catch (err: any) {
      setError('Failed to create event: ' + err.message);
      console.error('Error creating event:', err);
      toast.error('Failed to create event.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-darkGray/90 to-neutral-darkGray/70 backdrop-blur-md flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <svg
            className="animate-spin h-8 w-8 text-accent-gold"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-neutral-lightGray text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-darkGray/90 to-neutral-darkGray/70 backdrop-blur-md text-neutral-lightGray relative">
      {/* Hero Section */}
      <motion.section
        className="py-8 px-2 sm:py-16 sm:px-4 relative z-10 transition-all duration-300"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <motion.div
          className="max-w-4xl mx-auto text-center backdrop-blur-md bg-gradient-to-b from-primary-navy/90 to-primary-navy/70 shadow-2xl rounded-xl p-6 sm:p-8 transition-all duration-300"
          variants={fadeIn}
        >
          <motion.h1
            className="text-4xl sm:text-5xl font-bold text-accent-gold mb-4 sm:mb-6"
            initial="hidden"
            animate="visible"
            variants={headingFade}
          >
            {currentUser ? `Welcome Back, ${username}!` : 'Discover Eventify'}
          </motion.h1>
          <p className="text-lg sm:text-xl mb-6 sm:mb-8 text-neutral-lightGray">
            {currentUser
              ? 'Create, share, and join events with your community.'
              : 'Join a world of events—sign up to get started!'}
          </p>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {currentUser ? (
            <motion.button
              onClick={() => setShowModal(true)}
              className="inline-block bg-accent-gold text-neutral-darkGray rounded-full px-6 py-3 hover:bg-accent-gold/80 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={loading}
            >
              Create an Event
            </motion.button>
          ) : (
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <Link
                to="/register"
                className="inline-block bg-accent-gold text-neutral-darkGray rounded-full px-6 py-3 hover:bg-accent-gold/80 transition-all"
              >
                Sign Up
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 text-accent-gold border border-accent-gold rounded-full hover:bg-accent-gold hover:text-neutral-darkGray transition-colors"
              >
                Log In
              </Link>
            </div>
          )}
        </motion.div>
      </motion.section>

      {/* Upcoming Events Section */}
      <motion.section
        className="py-8 px-2 sm:py-16 sm:px-4 relative z-0 -mt-12 sm:-mt-16 transition-all duration-300"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div
          className="max-w-6xl mx-auto backdrop-blur-md bg-gradient-to-b from-primary-navy/90 to-primary-navy/70 shadow-2xl rounded-xl p-6 sm:p-8 transition-all duration-300"
          variants={fadeIn}
        >
          <motion.h2
            className="text-2xl sm:text-3xl font-bold text-accent-gold mb-6 sm:mb-8 text-center"
            initial="hidden"
            animate="visible"
            variants={headingFade}
          >
            Upcoming Events
          </motion.h2>
          {events.length > 0 ? (
            <div className="flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory">
              {events.slice(0, 3).map((event) => (
                <motion.div
                  key={event.id}
                  className="flex-none w-72 snap-center backdrop-blur-md bg-gradient-to-b from-primary-navy/90 to-primary-navy/70 shadow-2xl rounded-xl overflow-hidden min-w-[280px]"
                  variants={fadeIn}
                  whileHover={{ scale: 1.03, transition: { duration: 0.3 } }}
                >
                  <img
                    src={event.image || 'https://placehold.co/300x200?text=Event:1'}
                    alt={event.title}
                    className="w-full h-40 object-cover rounded-t"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://placehold.co/300x200?text=Event:Error'; // Fallback image
                    }}
                  />
                  <div className="p-4">
                    <h3 className="text-lg sm:text-xl font-semibold text-accent-gold">{event.title}</h3>
                    <p className="text-sm mt-1 text-neutral-lightGray">{event.date || event.createdAt}</p>
                    <p className="text-sm text-neutral-lightGray">{event.location || 'Location TBD'}</p>
                    <Link
                      to={`/events/${event.id}`}
                      className="mt-4 inline-block text-secondary-deepRed hover:underline"
                    >
                      Learn More
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-center text-neutral-lightGray">
              No events yet. Be the first to create one!
            </p>
          )}
          <div className="text-center mt-6 sm:mt-8">
            <Link
              to="/events"
              className="inline-block bg-accent-gold text-neutral-darkGray rounded-full px-6 py-3 hover:bg-accent-gold/80 transition-all"
            >
              Explore All Events
            </Link>
          </div>
        </motion.div>
      </motion.section>

      {/* Modal for Creating Events */}
      {showModal && currentUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50">
          <motion.div
            className="bg-gradient-to-b from-primary-navy/90 to-primary-navy/70 shadow-2xl p-6 rounded-xl max-w-md w-full"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <h3 className="text-2xl font-bold text-accent-gold mb-4">Create New Event</h3>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm text-neutral-lightGray">Title</label>
                <input
                  id="title"
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded"
                  required
                  minLength={3}
                  placeholder="Enter event title (min 3 chars)"
                  aria-label="Event Title"
                />
              </div>
              <div>
                <label htmlFor="date" className="block text-sm text-neutral-lightGray">Date</label>
                <input
                  id="date"
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  aria-label="Event Date"
                />
              </div>
              <div>
                <label htmlFor="location" className="block text-sm text-neutral-lightGray">Location</label>
                <input
                  id="location"
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded"
                  placeholder="Enter location (optional)"
                  aria-label="Event Location"
                />
              </div>
              <div>
                <label htmlFor="image" className="block text-sm text-neutral-lightGray">Image (optional)</label>
                <input
                  id="image"
                  type="file"
                  name="image"
                  onChange={handleInputChange}
                  accept="image/*"
                  className="w-full p-2 mt-1 text-neutral-lightGray"
                  aria-label="Event Image"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <motion.button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-accent-gold border border-accent-gold rounded-full hover:bg-accent-gold hover:text-neutral-darkGray transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  className="bg-accent-gold text-neutral-darkGray rounded-full px-6 py-3 hover:bg-accent-gold/80 transition-all"
                  disabled={loading || formData.title.length < 3 || !formData.date}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {loading ? 'Creating...' : 'Create Event'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default Home;