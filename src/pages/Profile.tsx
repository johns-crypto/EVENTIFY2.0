// src/pages/Profile.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where, limit, getDocs, QueryDocumentSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { toast } from 'react-toastify';
import { FaEdit, FaSave, FaUserPlus, FaCalendarAlt, FaMapMarkerAlt, FaSearch, FaTimes } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import defaultProfileImage from '../assets/default-profile.jpg'; // Verify this path
import { UserData, EventData, NormalizedEventData } from '../types';
import { normalizeEventData } from '../utils/normalizeEvent';
import debounce from 'lodash/debounce';

function Profile() {
  const { currentUser } = useAuth();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const viewingUserId = userId || currentUser?.uid || '';
  const [userData, setUserData] = useState<UserData>({
    uid: '',
    displayName: '',
    email: '',
    createdAt: '',
    bio: '',
    location: '',
    photoURL: '',
    contactEmail: '',
    contactPhone: '',
    followers: [],
    following: [],
    notificationsEnabled: false,
    role: 'user',
  });
  const [userEvents, setUserEvents] = useState<NormalizedEventData[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  const cardHover = {
    hover: { scale: 1.03, transition: { type: 'spring', stiffness: 300 } },
  };

  // Fetch user data
  useEffect(() => {
    if (!viewingUserId) {
      navigate('/login');
      return;
    }

    const userRef = doc(db, 'users', viewingUserId);
    const unsubscribe = onSnapshot(
      userRef,
      (doc) => {
        if (doc.exists()) {
          const data = doc.data() as UserData;
          setUserData({
            uid: doc.id,
            displayName: data.displayName || '',
            email: data.email || '',
            createdAt: data.createdAt || '',
            bio: data.bio || '',
            location: data.location || '',
            photoURL: data.photoURL || defaultProfileImage,
            contactEmail: data.contactEmail || '',
            contactPhone: data.contactPhone || '',
            followers: data.followers || [],
            following: data.following || [],
            notificationsEnabled: data.notificationsEnabled ?? false,
            role: data.role || 'user',
          });
          setIsFollowing(currentUser ? data.followers?.includes(currentUser.uid) || false : false);
        } else {
          toast.error('User not found.');
          navigate('/events');
        }
      },
      (err) => {
        toast.error(`Failed to load user data: ${err.message}`);
        navigate('/events');
      }
    );

    return () => unsubscribe();
  }, [viewingUserId, currentUser, navigate]);

  // Fetch user events
  useEffect(() => {
    if (!viewingUserId) return;

    const eventsQuery = query(collection(db, 'events'), where('userId', '==', viewingUserId));
    const unsubscribeEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const eventsData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return normalizeEventData({ id: doc.id, ...data } as EventData);
        });
        setUserEvents(eventsData);
      },
      (err) => {
        toast.error(`Failed to load user events: ${err.message}`);
      }
    );

    return () => unsubscribeEvents();
  }, [viewingUserId]);

  // Fetch suggested users (excluding the current user)
  useEffect(() => {
    if (!currentUser) return;

    const usersQuery = query(
      collection(db, 'users'),
      where('uid', '!=', currentUser.uid), // Fixed: Removed incorrect parentheses
      limit(10)
    );
    const unsubscribeSuggested = onSnapshot(
      usersQuery,
      (snapshot) => {
        const usersData = snapshot.docs.map((doc) => ({
          uid: doc.id,
          displayName: doc.data().displayName || '',
          email: doc.data().email || '',
          createdAt: doc.data().createdAt || '',
          bio: doc.data().bio || '',
          location: doc.data().location || '',
          photoURL: doc.data().photoURL || defaultProfileImage,
          contactEmail: doc.data().contactEmail || '',
          contactPhone: doc.data().contactPhone || '',
          followers: doc.data().followers || [],
          following: doc.data().following || [],
          notificationsEnabled: doc.data().notificationsEnabled ?? false,
          role: doc.data().role || 'user',
        })) as UserData[];
        setSuggestedUsers(usersData);
      },
      (err) => {
        toast.error(`Failed to load suggested users: ${err.message}`);
      }
    );

    return () => unsubscribeSuggested();
  }, [currentUser]);

  // Handle user search (debounced)
  const handleSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const usersQuery = query(
          collection(db, 'users'),
          where('displayName', '>=', query),
          where('displayName', '<=', query + '\uf8ff'),
          limit(5)
        );
        const snapshot = await getDocs(usersQuery);
        const results = snapshot.docs.map((doc: QueryDocumentSnapshot) => {
          const data = doc.data() as UserData;
          return {
            uid: doc.id,
            displayName: data.displayName || '',
            email: data.email || '',
            createdAt: data.createdAt || '',
            bio: data.bio || '',
            location: data.location || '',
            photoURL: data.photoURL || defaultProfileImage,
            contactEmail: data.contactEmail || '',
            contactPhone: data.contactPhone || '',
            followers: data.followers || [],
            following: data.following || [],
            notificationsEnabled: data.notificationsEnabled ?? false,
            role: data.role || 'user',
          };
        });
        setSearchResults(results);
      } catch (err: any) {
        toast.error(`Search failed: ${err.message}`);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery, handleSearch]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchQuery('');
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change for editing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      let photoURL = userData.photoURL;
      if (photoFile) {
        const storageRef = ref(storage, `profile-photos/${currentUser.uid}`);
        await uploadBytes(storageRef, photoFile);
        photoURL = await getDownloadURL(storageRef);
      }

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        displayName: userData.displayName,
        bio: userData.bio,
        location: userData.location,
        photoURL,
      });

      setUserData((prev) => ({ ...prev, photoURL }));
      setPhotoFile(null);
      setPhotoPreview(null);
      setEditing(false);
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(`Failed to update profile: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser, userData, photoFile]);

  const handleFollow = useCallback(
    async (targetUserId: string, targetUserName: string) => {
      if (!currentUser) return;

      setFollowLoading(targetUserId);
      try {
        const currentUserRef = doc(db, 'users', currentUser.uid);
        const targetUserRef = doc(db, 'users', targetUserId);

        const currentUserSnap = await getDoc(currentUserRef);
        const targetUserSnap = await getDoc(targetUserRef);

        if (!currentUserSnap.exists() || !targetUserSnap.exists()) {
          throw new Error('User not found');
        }

        const currentUserData = currentUserSnap.data() as UserData;
        const targetUserData = targetUserSnap.data() as UserData;

        const currentUserFollowing = currentUserData.following || [];
        const targetUserFollowers = targetUserData.followers || [];

        const isCurrentlyFollowing = targetUserFollowers.includes(currentUser.uid);

        if (isCurrentlyFollowing) {
          // Unfollow
          await updateDoc(currentUserRef, {
            following: currentUserFollowing.filter((id) => id !== targetUserId),
          });
          await updateDoc(targetUserRef, {
            followers: targetUserFollowers.filter((id) => id !== currentUser.uid),
          });
          toast.success(`Unfollowed ${targetUserName || 'user'}`);
          if (targetUserId === viewingUserId) setIsFollowing(false);
        } else {
          // Follow
          await updateDoc(currentUserRef, {
            following: [...currentUserFollowing, targetUserId],
          });
          await updateDoc(targetUserRef, {
            followers: [...targetUserFollowers, currentUser.uid],
          });
          toast.success(`Followed ${targetUserName || 'user'}`);
          if (targetUserId === viewingUserId) setIsFollowing(true);
        }
      } catch (err: any) {
        toast.error(`Failed to update follow status: ${err.message}`);
      } finally {
        setFollowLoading(null);
      }
    },
    [currentUser, viewingUserId]
  );

  if (!viewingUserId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Please sign in to view this profile.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-gray-200">
      <motion.div
        className="max-w-5xl mx-auto py-12 px-4 sm:px-6"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        {/* Search Bar */}
        <motion.div
          className="relative mb-8"
          ref={searchRef}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <label htmlFor="search-users" className="sr-only">
            Search users
          </label>
          <div className="flex items-center bg-gray-700/50 rounded-full px-4 py-2 shadow-lg">
            <FaSearch className="text-gray-400 mr-3" />
            <input
              id="search-users"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..." // Added placeholder for better UX
              className="w-full bg-transparent text-gray-200 placeholder-gray-400 focus:outline-none"
              aria-label="Search users"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="text-gray-400 hover:text-gray-200"
                aria-label="Clear search"
              >
                <FaTimes />
              </button>
            )}
          </div>
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                className="absolute top-12 left-0 right-0 bg-gray-700/90 backdrop-blur-md rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-800"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {searchResults.map((user) => (
                  <Link
                    key={user.uid}
                    to={`/profile/${user.uid}`}
                    className="flex items-center p-3 hover:bg-gray-600/50 transition-colors"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <img
                      src={user.photoURL || defaultProfileImage}
                      alt={user.displayName}
                      className="w-10 h-10 rounded-full object-cover mr-3"
                    />
                    <span className="text-gray-200">{user.displayName || 'Anonymous'}</span>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {isSearching && (
            <motion.div
              className="absolute top-12 left-0 right-0 bg-gray-700/90 backdrop-blur-md rounded-lg shadow-lg z-10 p-3 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-gray-400">Searching...</p>
            </motion.div>
          )}
        </motion.div>

        {/* Profile Header */}
        <motion.div
          className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-6 sm:p-8 shadow-xl border border-gray-600/30 mb-8"
          variants={cardHover}
          whileHover="hover"
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative">
              <img
                src={photoPreview || userData.photoURL || defaultProfileImage}
                alt={userData.displayName}
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-yellow-400 shadow-lg"
              />
              {editing && (
                <label
                  htmlFor="photoUpload"
                  className="absolute bottom-0 right-0 bg-yellow-400 text-gray-900 p-3 rounded-full cursor-pointer shadow-md hover:bg-yellow-300 transition-all"
                >
                  <FaEdit size={18} />
                  <input
                    id="photoUpload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              {editing ? (
                <input
                  id="displayName"
                  type="text"
                  name="displayName"
                  value={userData.displayName}
                  onChange={handleInputChange}
                  className="w-full text-2xl sm:text-3xl font-bold text-yellow-400 bg-gray-600/50 border border-gray-500 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  placeholder="Your name"
                  disabled={loading}
                />
              ) : (
                <h1 className="text-2xl sm:text-3xl font-bold text-yellow-400 tracking-tight">
                  {userData.displayName || 'Anonymous'}
                </h1>
              )}
              <p className="text-gray-400 mt-2 text-lg">{userData.email}</p>
              <div className="flex justify-center sm:justify-start gap-4 mt-4">
                <span className="bg-yellow-400/10 text-gray-200 px-4 py-1.5 rounded-full text-sm font-medium">
                  Followers: {userData.followers?.length || 0}
                </span>
                <span className="bg-yellow-400/10 text-gray-200 px-4 py-1.5 rounded-full text-sm font-medium">
                  Following: {userData.following?.length || 0}
                </span>
              </div>
              <div className="mt-4">
                {viewingUserId === currentUser?.uid ? (
                  <button
                    onClick={() => (editing ? handleSave() : setEditing(true))}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 px-6 py-2 rounded-full hover:from-yellow-300 hover:to-yellow-400 disabled:opacity-50 transition-all shadow-md hover:shadow-lg font-semibold flex items-center gap-2 mx-auto sm:mx-0"
                    disabled={loading}
                    data-tooltip-id="edit-tooltip"
                    data-tooltip-content={editing ? 'Save your profile changes' : 'Edit your profile'}
                  >
                    {editing ? <FaSave size={20} /> : <FaEdit size={20} />}
                    <span>{editing ? 'Save' : 'Edit'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleFollow(viewingUserId, userData.displayName)}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all shadow-md hover:shadow-lg font-semibold ${
                      isFollowing
                        ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                        : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 hover:from-yellow-300 hover:to-yellow-400'
                    } disabled:opacity-50`}
                    disabled={loading || followLoading === viewingUserId}
                    data-tooltip-id="follow-tooltip"
                    data-tooltip-content={isFollowing ? 'Unfollow this user' : 'Follow this user'}
                  >
                    {followLoading === viewingUserId ? (
                      <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <FaUserPlus size={20} />
                    )}
                    <span>{isFollowing ? 'Unfollow' : 'Follow'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Suggested Users Section */}
        <motion.div className="mb-8" variants={fadeIn}>
          <h2 className="text-2xl font-semibold text-yellow-400 mb-4 tracking-tight">Explore Users</h2>
          {suggestedUsers.length > 0 ? (
            <div className="flex overflow-x-auto space-x-4 pb-4 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-800">
              {suggestedUsers.map((user) => (
                <motion.div
                  key={user.uid}
                  className="flex-shrink-0 w-48 bg-gray-700/50 rounded-lg p-4 shadow-md"
                  variants={cardHover}
                  whileHover="hover"
                >
                  <Link to={`/profile/${user.uid}`} className="flex flex-col items-center">
                    <img
                      src={user.photoURL || defaultProfileImage}
                      alt={user.displayName}
                      className="w-16 h-16 rounded-full object-cover mb-3 border-2 border-yellow-400"
                    />
                    <h3 className="text-sm font-semibold text-gray-200 text-center line-clamp-1">
                      {user.displayName || 'Anonymous'}
                    </h3>
                  </Link>
                  <button
                    onClick={() => {
                      handleFollow(user.uid, user.displayName);
                    }}
                    className={`mt-2 w-full flex items-center justify-center gap-2 px-3 py-1 rounded-full text-sm font-semibold transition-all ${
                      user.followers?.includes(currentUser?.uid || '')
                        ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                        : 'bg-yellow-400 text-gray-900 hover:bg-yellow-300'
                    } disabled:opacity-50`}
                    disabled={followLoading === user.uid}
                  >
                    {followLoading === user.uid ? (
                      <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <FaUserPlus size={14} />
                    )}
                    <span>{user.followers?.includes(currentUser?.uid || '') ? 'Unfollow' : 'Follow'}</span>
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No users to explore.</p>
          )}
        </motion.div>

        {/* Bio and Details Section */}
        <motion.div className="grid gap-6 sm:grid-cols-2 mb-8" variants={fadeIn}>
          <motion.div
            className="bg-gray-700/50 backdrop-blur-sm p-6 rounded-xl border border-gray-600/30"
            variants={cardHover}
            whileHover="hover"
          >
            <h2 className="text-xl font-semibold text-yellow-400 mb-4 tracking-tight">Bio</h2>
            {editing ? (
              <textarea
                id="bio"
                name="bio"
                value={userData.bio || ''}
                onChange={handleInputChange}
                className="w-full mt-2 p-4 rounded-lg bg-gray-600/50 border border-gray-500 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                rows={4}
                placeholder="Tell us about yourself"
                disabled={loading}
              />
            ) : (
              <p className="text-gray-400 leading-relaxed text-lg">{userData.bio || 'No bio yet.'}</p>
            )}
          </motion.div>
          <motion.div
            className="bg-gray-700/50 backdrop-blur-sm p-6 rounded-xl border border-gray-600/30"
            variants={cardHover}
            whileHover="hover"
          >
            <h2 className="text-xl font-semibold text-yellow-400 mb-4 tracking-tight">Location</h2>
            {editing ? (
              <input
                id="location"
                type="text"
                name="location"
                value={userData.location || ''}
                onChange={handleInputChange}
                className="w-full mt-2 p-4 rounded-lg bg-gray-600/50 border border-gray-500 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                placeholder="Where are you located?"
                disabled={loading}
              />
            ) : (
              <p className="text-gray-400 leading-relaxed text-lg flex items-center gap-2">
                <FaMapMarkerAlt className="text-yellow-400" />
                {userData.location || 'Location not specified.'}
              </p>
            )}
          </motion.div>
        </motion.div>

        {/* User Events Section */}
        <motion.div variants={fadeIn}>
          <h2 className="text-2xl font-semibold text-yellow-400 mb-6 tracking-tight">Events</h2>
          {userEvents.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {userEvents.map((event) => (
                <motion.div
                  key={event.id}
                  className="bg-gray-700/50 backdrop-blur-sm p-4 rounded-xl border border-gray-600/30 shadow-md"
                  variants={cardHover}
                  whileHover="hover"
                >
                  <img
                    src={event.image || defaultProfileImage}
                    alt={event.title}
                    className="w-full h-40 object-cover rounded-lg mb-4"
                    onError={(e) => (e.currentTarget.src = defaultProfileImage)}
                  />
                  <h3 className="text-lg font-semibold text-yellow-400">{event.title}</h3>
                  <p className="text-gray-400 mt-1 flex items-center gap-2">
                    <FaCalendarAlt className="text-yellow-400" />
                    {new Date(event.date || event.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-gray-400 mt-1 flex items-center gap-2">
                    <FaMapMarkerAlt className="text-yellow-400" />
                    {event.location || 'Location TBD'}
                  </p>
                  <Link
                    to={`/events/${event.id}`}
                    className="mt-4 inline-block px-4 py-2 bg-yellow-400 text-gray-900 rounded-full hover:bg-yellow-300 transition-all font-semibold"
                  >
                    View Event
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-lg">No events created yet.</p>
          )}
        </motion.div>
      </motion.div>

      <Tooltip id="edit-tooltip" place="top" />
      <Tooltip id="follow-tooltip" place="top" />
    </div>
  );
}

export default Profile;