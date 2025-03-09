import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FaUser, FaEdit, FaSave, FaTrash } from 'react-icons/fa'; // Removed FaCamera
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, orderBy } from 'firebase/firestore'; // Added orderBy
import { db, auth, storage } from '../services/firebase';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Event {
  id: string;
  title: string;
  createdAt: string;
}

interface Post {
  id: string;
  eventId: string;
  mediaUrl: string;
  type: 'photo' | 'video';
  createdAt: string;
  eventTitle: string;
}

interface UserData {
  displayName: string;
  bio: string;
  photoURL: string;
  location: string;
}

function Profile() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData>({
    displayName: '',
    bio: '',
    photoURL: '',
    location: '',
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const fetchUserData = async () => {
      setLoading(true);
      setError(null);
      try {
        const userDoc = doc(db, 'users', currentUser.uid);
        const userSnapshot = await getDoc(userDoc);
        const userInfo: UserData = userSnapshot.exists()
          ? { ...userSnapshot.data() as UserData, location: userSnapshot.data().location || '' }
          : {
              displayName: currentUser.displayName || '',
              bio: '',
              photoURL: currentUser.photoURL || '',
              location: '',
            };
        setUserData(userInfo);

        const eventsQuery = query(
          collection(db, 'events'),
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc') // Fixed missing import
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        const userEvents = eventsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Event[];
        setEvents(userEvents);

        const allEventsSnapshot = await getDocs(collection(db, 'events'));
        const eventsMap = new Map<string, string>(
          allEventsSnapshot.docs.map((doc) => [doc.id, doc.data().title])
        );
        const userPosts: Post[] = [];
        for (const eventDoc of allEventsSnapshot.docs) {
          const postsQuery = query(
            collection(db, 'events', eventDoc.id, 'posts'),
            where('userId', '==', currentUser.uid)
          );
          const postsSnapshot = await getDocs(postsQuery);
          postsSnapshot.forEach((doc) => {
            userPosts.push({
              id: doc.id,
              eventId: eventDoc.id,
              eventTitle: eventsMap.get(eventDoc.id) || 'Unknown Event',
              ...doc.data(),
            } as Post);
          });
        }
        userPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPosts(userPosts);
      } catch (err) {
        setError('Failed to load profile data. Please try again.');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhotoFile(e.target.files[0]);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      let updatedPhotoURL = userData.photoURL;
      if (photoFile) {
        const storageRef = ref(storage, `profilePhotos/${currentUser!.uid}/${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
        updatedPhotoURL = await getDownloadURL(storageRef);
      }

      await updateProfile(auth.currentUser!, {
        displayName: userData.displayName,
        photoURL: updatedPhotoURL,
      });

      const userDoc = doc(db, 'users', currentUser!.uid);
      await updateDoc(userDoc, {
        displayName: userData.displayName,
        bio: userData.bio,
        photoURL: updatedPhotoURL,
        location: userData.location,
      });

      setUserData((prev) => ({ ...prev, photoURL: updatedPhotoURL }));
      setPhotoFile(null);
      setEditing(false);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error('Error updating profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'events', eventId));
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
    } catch (err) {
      setError('Failed to delete event. Please try again.');
      console.error('Error deleting event:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (eventId: string, postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'events', eventId, 'posts', postId));
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (err) {
      setError('Failed to delete post. Please try again.');
      console.error('Error deleting post:', err);
    } finally {
      setLoading(false);
    }
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const staggerChildren = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-darkGray py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-4xl mx-auto bg-primary-navy p-8 rounded-lg shadow-lg"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        {/* Profile Header */}
        <motion.div className="flex items-center space-x-6" variants={fadeIn}>
          {userData.photoURL ? (
            <img
              src={userData.photoURL}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <FaUser className="w-24 h-24 text-neutral-lightGray" />
          )}
          <div className="flex-1">
            {editing ? (
              <>
                <label htmlFor="displayName" className="block text-sm text-neutral-lightGray">
                  Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  name="displayName"
                  value={userData.displayName}
                  onChange={handleInputChange}
                  className="text-3xl font-bold text-accent-gold bg-neutral-offWhite p-2 rounded w-full mb-2"
                  placeholder="Your name"
                  disabled={loading}
                />
                <label htmlFor="photoUpload" className="block text-sm text-neutral-lightGray">
                  Profile Photo
                </label>
                <input
                  id="photoUpload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="text-sm text-neutral-lightGray"
                  disabled={loading}
                />
                {photoFile && <p className="text-sm text-neutral-lightGray">New photo selected</p>}
              </>
            ) : (
              <h1 className="text-3xl font-bold text-accent-gold">
                {userData.displayName || 'Anonymous'}
              </h1>
            )}
            <p className="text-neutral-lightGray">{currentUser?.email}</p>
          </div>
          <button
            onClick={() => (editing ? handleSave() : setEditing(true))}
            className="ml-auto bg-secondary-deepRed text-neutral-lightGray p-2 rounded-full hover:bg-secondary-darkRed focus:outline-none focus:ring-2 focus:ring-secondary-deepRed disabled:opacity-50"
            disabled={loading}
          >
            {editing ? <FaSave size={20} /> : <FaEdit size={20} />}
          </button>
        </motion.div>

        {/* Bio and Location */}
        <motion.div className="mt-6 space-y-4" variants={fadeIn}>
          <div>
            <h2 className="text-xl font-semibold text-accent-gold">Bio</h2>
            {editing ? (
              <>
                <label htmlFor="bio" className="block text-sm text-neutral-lightGray">
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  value={userData.bio}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-3 rounded bg-neutral-offWhite text-neutral-darkGray"
                  rows={3}
                  placeholder="Tell us about yourself"
                  disabled={loading}
                />
              </>
            ) : (
              <p className="mt-2 text-neutral-lightGray">{userData.bio || 'No bio yet.'}</p>
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-accent-gold">Location</h2>
            {editing ? (
              <>
                <label htmlFor="location" className="block text-sm text-neutral-lightGray">
                  Location
                </label>
                <input
                  id="location"
                  type="text"
                  name="location"
                  value={userData.location}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-3 rounded bg-neutral-offWhite text-neutral-darkGray"
                  placeholder="e.g., New York, NY"
                  disabled={loading}
                />
              </>
            ) : (
              <p className="mt-2 text-neutral-lightGray">{userData.location || 'No location set.'}</p>
            )}
          </div>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.p className="mt-4 text-center text-red-500" variants={fadeIn}>
            {error}
          </motion.p>
        )}

        {/* Events */}
        <motion.section className="mt-8" variants={staggerChildren}>
          <h2 className="text-xl font-semibold text-accent-gold mb-4">Your Events</h2>
          {events.length > 0 ? (
            <motion.div className="space-y-4" variants={staggerChildren}>
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  className="bg-neutral-offWhite text-neutral-darkGray p-4 rounded-lg shadow flex justify-between items-center"
                  variants={fadeIn}
                >
                  <div>
                    <Link
                      to={`/events/${event.id}`}
                      className="text-accent-gold hover:underline font-semibold"
                    >
                      {event.title}
                    </Link>
                    <p className="text-sm mt-1">
                      Created on {new Date(event.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="text-red-500 hover:text-red-700 focus:outline-none"
                    disabled={loading}
                    aria-label={`Delete event ${event.title}`}
                  >
                    <FaTrash size={20} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-neutral-lightGray">No events created yet.</p>
          )}
        </motion.section>

        {/* Posts */}
        <motion.section className="mt-8" variants={staggerChildren}>
          <h2 className="text-xl font-semibold text-accent-gold mb-4">Your Posts</h2>
          {posts.length > 0 ? (
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-6" variants={staggerChildren}>
              {posts.map((post) => (
                <motion.div
                  key={`${post.eventId}-${post.id}`}
                  className="bg-neutral-offWhite text-neutral-darkGray rounded-lg shadow overflow-hidden"
                  variants={fadeIn}
                >
                  {post.type === 'photo' ? (
                    <img
                      src={post.mediaUrl}
                      alt={`Post from ${post.eventTitle}`}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <video src={post.mediaUrl} controls className="w-full h-48 object-cover" />
                  )}
                  <div className="p-4 flex justify-between items-center">
                    <div>
                      <Link
                        to={`/events/${post.eventId}`}
                        className="text-accent-gold hover:underline font-semibold"
                      >
                        {post.eventTitle}
                      </Link>
                      <p className="text-sm mt-1">
                        Posted on {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeletePost(post.eventId, post.id)}
                      className="text-red-500 hover:text-red-700 focus:outline-none"
                      disabled={loading}
                      aria-label={`Delete post from ${post.eventTitle}`}
                    >
                      <FaTrash size={20} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-neutral-lightGray">No posts yet.</p>
          )}
        </motion.section>
      </motion.div>
    </div>
  );
}

export default Profile;