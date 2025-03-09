// src/pages/Home.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { getEvents, EventData, getUserData, db, storage } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-toastify';

function Home() {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    location: '',
    image: null as File | null,
  });

  // Animation variants for sections
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const stagger = {
    visible: { transition: { staggerChildren: 0.2 } },
  };

  // Animation variants for headings
  const headingFade = {
    hidden: { opacity: 0, y: -30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut', type: 'spring', bounce: 0.3 },
    },
  };

  // Fetch events and user data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventData = await getEvents();
        setEvents(eventData);

        if (currentUser) {
          const userData = await getUserData(currentUser.uid);
          setUsername(userData?.displayName || currentUser.email.split('@')[0]);
        } else {
          setUsername('');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load events.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  // Handle event creation
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);
    try {
      const eventId = doc(collection(db, 'events')).id; // Generate a new ID
      let imageUrl = '';
      if (formData.image) {
        const storageRef = ref(storage, `events/${eventId}/${formData.image.name}`);
        await uploadBytes(storageRef, formData.image);
        imageUrl = await getDownloadURL(storageRef);
      }

      const newEvent: EventData = {
        id: eventId,
        title: formData.title,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        location: formData.location,
        date: formData.date,
        image: imageUrl || undefined,
      };

      await setDoc(doc(db, 'events', eventId), newEvent);
      setEvents((prev) => [newEvent, ...prev]); // Add to local state
      setShowModal(false);
      setFormData({ title: '', date: '', location: '', image: null }); // Reset form
      toast.success('Event created successfully!');
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center">
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
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray">
      {/* Hero Section */}
      <section className="py-16 px-4 flex items-center justify-center bg-primary-navy">
        <motion.div
          className="max-w-4xl text-center"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <motion.h1
            className="text-5xl font-bold text-accent-gold mb-6"
            initial="hidden"
            animate="visible"
            variants={headingFade}
          >
            {currentUser ? `Welcome Back, ${username}!` : 'Discover Eventify'}
          </motion.h1>
          <p className="text-xl mb-8">
            {currentUser
              ? 'Create, share, and join events with your community.'
              : 'Join a world of events—sign up to get started!'}
          </p>
          {currentUser ? (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary inline-block"
              disabled={loading}
            >
              Create an Event
            </button>
          ) : (
            <div className="space-x-4">
              <Link to="/register" className="btn-primary inline-block">
                Sign Up
              </Link>
              <Link
                to="/login"
                className="px-4 py-2 text-accent-gold border border-accent-gold rounded hover:bg-accent-gold hover:text-neutral-darkGray transition-colors"
              >
                Log In
              </Link>
            </div>
          )}
        </motion.div>
      </section>

      {/* Events Preview Section */}
      <section className="py-16 px-4">
        <motion.div
          className="max-w-6xl mx-auto"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.h2
            className="text-3xl font-bold text-accent-gold mb-8 text-center"
            initial="hidden"
            animate="visible"
            variants={headingFade}
          >
            Upcoming Events
          </motion.h2>
          {events.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <motion.div key={event.id} className="card" variants={fadeIn}>
                  <img
                    src={event.image || 'https://via.placeholder.com/300x200?text=Event'}
                    alt={event.title}
                    className="w-full h-40 object-cover rounded-t"
                  />
                  <div className="p-4">
                    <h3 className="text-xl font-semibold text-accent-gold">{event.title}</h3>
                    <p className="text-sm mt-1">{event.date || event.createdAt}</p>
                    <p className="text-sm">{event.location || 'Location TBD'}</p>
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
          <div className="text-center mt-8">
            <Link to="/events" className="btn-primary">
              Explore All Events
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Create Event Modal */}
      {showModal && currentUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            className="bg-primary-navy p-6 rounded-lg max-w-md w-full"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <h3 className="text-2xl font-bold text-accent-gold mb-4">Create New Event</h3>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-lightGray">Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded"
                  required
                  minLength={3}
                  placeholder="Enter event title (min 3 chars)"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-lightGray">Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded"
                  required
                  min={new Date().toISOString().split('T')[0]} // No past dates
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-lightGray">Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded"
                  placeholder="Enter location (optional)"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-lightGray">Image (optional)</label>
                <input
                  type="file"
                  name="image"
                  onChange={handleInputChange}
                  accept="image/*"
                  className="w-full p-2 mt-1 text-neutral-lightGray"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-accent-gold hover:text-neutral-darkGray hover:bg-accent-gold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || formData.title.length < 3 || !formData.date}
                >
                  {loading ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default Home;