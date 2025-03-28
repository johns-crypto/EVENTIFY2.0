// src/pages/Search.tsx
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { FaUser, FaCalendarAlt } from 'react-icons/fa';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp type

interface User {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string; // Change to string since we'll convert Timestamp to string
  location: string;
}

function Search() {
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('query') || '';
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
  const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

  useEffect(() => {
    if (!queryParam || queryParam.length < 3) {
      setError('Search query must be at least 3 characters.');
      return;
    }

    const fetchSearchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const searchLower = queryParam.toLowerCase();
        const searchUpperBound = searchLower + '\uf8ff'; // Unicode character for "end of string"

        // Search users by displayNameLOWER
        const usersQueryDisplayName = query(
          collection(db, 'users'),
          where('displayNameLower', '>=', searchLower),
          where('displayNameLower', '<=', searchUpperBound)
        );
        const usersSnapshotDisplayName = await getDocs(usersQueryDisplayName);

        // Search users by emailLower
        const usersQueryEmail = query(
          collection(db, 'users'),
          where('emailLower', '>=', searchLower),
          where('emailLower', '<=', searchUpperBound)
        );
        const usersSnapshotEmail = await getDocs(usersQueryEmail);

        // Combine and deduplicate user results
        const userResults = [
          ...usersSnapshotDisplayName.docs,
          ...usersSnapshotEmail.docs,
        ].reduce((acc: User[], doc) => {
          const user = {
            id: doc.id,
            displayName: doc.data().displayName || 'Anonymous',
            email: doc.data().email || '',
            role: doc.data().role || 'user',
          };
          if (!acc.some((u) => u.id === user.id)) {
            acc.push(user);
          }
          return acc;
        }, []);

        // Search events by titleLower
        const eventsQueryTitle = query(
          collection(db, 'events'),
          where('titleLower', '>=', searchLower),
          where('titleLower', '<=', searchUpperBound)
        );
        const eventsSnapshotTitle = await getDocs(eventsQueryTitle);

        // Search events by descriptionLower
        const eventsQueryDescription = query(
          collection(db, 'events'),
          where('descriptionLower', '>=', searchLower),
          where('descriptionLower', '<=', searchUpperBound)
        );
        const eventsSnapshotDescription = await getDocs(eventsQueryDescription);

        // Combine and deduplicate event results
        const eventResults = [
          ...eventsSnapshotTitle.docs,
          ...eventsSnapshotDescription.docs,
        ].reduce((acc: Event[], doc) => {
          const eventData = doc.data();
          const event = {
            id: doc.id,
            title: eventData.title || '',
            description: eventData.description || '',
            // Convert Timestamp to string
            date: eventData.date instanceof Timestamp
              ? eventData.date.toDate().toLocaleDateString()
              : eventData.date || '',
            location: eventData.location || '',
          };
          if (!acc.some((e) => e.id === event.id)) {
            acc.push(event);
          }
          return acc;
        }, []);

        setUsers(userResults);
        setEvents(eventResults);
      } catch (err: any) {
        setError(`Failed to load search results: ${err.message}`);
        toast.error(`Failed to load search results: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [queryParam]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="w-full max-w-6xl p-4 space-y-4">
          <div className="h-8 bg-gray-700 rounded w-3/5 mx-auto animate-pulse"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-32 bg-gray-700 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="bg-red-500 text-white p-4 rounded-lg flex items-center gap-3">
          <p>{error}</p>
          <Link
            to="/"
            className="px-4 py-2 bg-white text-red-500 rounded-full hover:bg-gray-200 transition-colors"
          >
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white py-6 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-6xl mx-auto bg-gray-800/70 backdrop-blur-lg rounded-2xl p-4 sm:p-6 lg:p-8 shadow-2xl border border-gray-700/30"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-400 mb-6 sm:mb-8">
          Search Results for "{queryParam}"
        </h2>

        {/* Users Section */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-4">Users</h3>
          {users.length > 0 ? (
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" variants={stagger}>
              {users.map((user) => (
                <motion.div
                  key={user.id}
                  className="p-4 bg-gray-700/50 rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
                  variants={fadeIn}
                >
                  <Link to={`/profile/${user.id}`} className="flex items-center space-x-3">
                    <FaUser className="text-yellow-400" size={24} />
                    <div>
                      <h4 className="text-base sm:text-lg font-semibold text-white">{user.displayName}</h4>
                      <p className="text-gray-300 text-sm">{user.email}</p>
                      <p className="text-gray-400 text-xs capitalize">{user.role}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-gray-400 text-sm sm:text-lg">No users found.</p>
          )}
        </div>

        {/* Events Section */}
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-4">Events</h3>
          {events.length > 0 ? (
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" variants={stagger}>
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  className="p-4 bg-gray-700/50 rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
                  variants={fadeIn}
                >
                  <Link to={`/events/${event.id}`} className="flex items-center space-x-3">
                    <FaCalendarAlt className="text-yellow-400" size={24} />
                    <div>
                      <h4 className="text-base sm:text-lg font-semibold text-white">{event.title}</h4>
                      <p className="text-gray-300 text-sm line-clamp-2">{event.description}</p>
                      <p className="text-gray-400 text-xs">{event.date} - {event.location}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-gray-400 text-sm sm:text-lg">No events found.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default Search;