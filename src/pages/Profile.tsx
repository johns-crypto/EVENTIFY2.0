import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FaUser, FaEdit, FaSave, FaTrash, FaUserPlus, FaEnvelope, FaPhone, FaRedo } from 'react-icons/fa';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, orderBy, arrayUnion, arrayRemove, QueryDocumentSnapshot, DocumentData, startAfter, limit } from 'firebase/firestore';
import { db, auth, storage, getUserEvents, getBusinesses } from '../services/firebase';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-toastify';
import debounce from 'lodash/debounce';

interface Event {
  id: string;
  title: string;
  createdAt: string;
  visibility: 'public' | 'private';
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
  contactEmail?: string;
  contactPhone?: string;
  followers: string[];
  following: string[];
}

interface Notification {
  id: string;
  type: 'recommendation';
  businessId: string;
  from: string;
  message: string;
  createdAt: string;
}

// Custom component for lazy loading videos
const VideoWithLazyLoad = ({ src, className }: { src: string; className: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      src={shouldLoad ? src : undefined}
      controls
      className={className}
      preload="none"
    />
  );
};

function Profile() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState<UserData>({
    displayName: '',
    bio: '',
    photoURL: '',
    location: '',
    contactEmail: '',
    contactPhone: '',
    followers: [],
    following: [],
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [businessContact, setBusinessContact] = useState<{ name: string; contactEmail?: string; contactPhone?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [lastPostDoc, setLastPostDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const postsPerPage = 6; // Number of posts to load per batch

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Debounced input handler to reduce Firestore updates
  const debouncedHandleInputChange = useCallback(
    debounce((name: string, value: string) => {
      setUserData((prev) => ({ ...prev, [name]: value }));
    }, 300),
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    debouncedHandleInputChange(name, value);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhotoFile(e.target.files[0]);
    }
  };

  // Initial data fetch (user data, events, notifications)
  const fetchInitialData = useCallback(async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const urlParams = new URLSearchParams(location.search);
      const businessId = urlParams.get('businessId');
      const userId = urlParams.get('userId') || currentUser.uid;
      setViewingUserId(userId);

      // Fetch user data
      const userDoc = doc(db, 'users', userId);
      const userSnapshot = await getDoc(userDoc);
      const userInfo: UserData = userSnapshot.exists()
        ? { ...userSnapshot.data() as UserData, followers: userSnapshot.data().followers || [], following: userSnapshot.data().following || [] }
        : {
            displayName: currentUser.displayName || '',
            bio: '',
            photoURL: currentUser.photoURL || '',
            location: '',
            contactEmail: '',
            contactPhone: '',
            followers: [],
            following: [],
          };
      setUserData(userInfo);

      if (userId !== currentUser.uid) {
        const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
        setIsFollowing(currentUserDoc.data()?.following?.includes(userId) || false);
      }

      // Fetch business contact info if businessId is provided
      if (businessId) {
        const businesses = await getBusinesses();
        const business = businesses.find((b) => b.id === businessId);
        if (business) {
          const ownerDoc = await getDoc(doc(db, 'users', business.ownerId));
          setBusinessContact({
            name: business.name,
            contactEmail: ownerDoc.data()?.contactEmail || business.ownerId + '@example.com',
            contactPhone: ownerDoc.data()?.contactPhone || 'Not provided',
          });
        }
      }

      // Fetch user events
      const userEvents = await getUserEvents(userId);
      const accessibleEvents = userId === currentUser.uid
        ? userEvents
        : userEvents.filter((e) => e.visibility === 'public');
      setEvents(accessibleEvents);

      // Fetch notifications (only for own profile)
      if (userId === currentUser.uid) {
        const notificationsQuery = query(
          collection(db, 'users', userId, 'notifications'),
          orderBy('createdAt', 'desc')
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        setNotifications(notificationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Notification)));
      }
    } catch (err: any) {
      setError('Failed to load profile data. Please try again.');
      toast.error('Failed to load profile data.');
      console.error('Error fetching initial data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, navigate, location]);

  // Fetch posts (initial and load more)
  const fetchPosts = useCallback(async (isLoadMore = false) => {
    if (!currentUser || !viewingUserId || !events.length) return;

    setLoadingMore(isLoadMore);

    try {
      const userPosts: Post[] = [];
      for (const event of events) {
        const postsQuery = query(
          collection(db, 'events', event.id, 'posts'),
          where('userId', '==', viewingUserId),
          orderBy('createdAt', 'desc'),
          ...(isLoadMore && lastPostDoc ? [startAfter(lastPostDoc)] : []),
          limit(postsPerPage)
        );
        const postsSnapshot = await getDocs(postsQuery);
        postsSnapshot.forEach((doc) => {
          userPosts.push({
            id: doc.id,
            eventId: event.id,
            eventTitle: event.title || 'Unknown Event',
            mediaUrl: doc.data().mediaUrl || '',
            type: doc.data().type as 'photo' | 'video',
            createdAt: doc.data().createdAt || new Date().toISOString(),
          });
        });

        // Update the last document for pagination
        if (postsSnapshot.docs.length > 0) {
          setLastPostDoc(postsSnapshot.docs[postsSnapshot.docs.length - 1]);
        }
        setHasMorePosts(postsSnapshot.docs.length === postsPerPage);
      }

      if (isLoadMore) {
        setPosts((prev) => [...prev, ...userPosts]);
      } else {
        setPosts(userPosts);
      }
    } catch (err: any) {
      setError('Failed to load posts. Please try again.');
      toast.error('Failed to load posts.');
      console.error('Error fetching posts:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [currentUser, viewingUserId, events, lastPostDoc]);

  // Initial data fetch on mount
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Fetch posts after events are loaded
  useEffect(() => {
    if (events.length > 0 && !loading) {
      fetchPosts();
    }
  }, [events, fetchPosts, loading]);

  // Set up infinite scrolling
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMorePosts && !loadingMore) {
          fetchPosts(true);
        }
      },
      { rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMorePosts, loadingMore, fetchPosts]);

  const handleSave = useCallback(async () => {
    if (!currentUser || viewingUserId !== currentUser.uid) return;
    setLoading(true);
    setError(null);
    try {
      let updatedPhotoURL = userData.photoURL;
      if (photoFile) {
        const storageRef = ref(storage, `profilePhotos/${currentUser.uid}/${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
        updatedPhotoURL = await getDownloadURL(storageRef);
      }

      await updateProfile(auth.currentUser!, {
        displayName: userData.displayName,
        photoURL: updatedPhotoURL,
      });

      const userDoc = doc(db, 'users', currentUser.uid);
      await updateDoc(userDoc, {
        displayName: userData.displayName,
        bio: userData.bio,
        photoURL: updatedPhotoURL,
        location: userData.location,
        contactEmail: userData.contactEmail,
        contactPhone: userData.contactPhone,
      });

      setUserData((prev) => ({ ...prev, photoURL: updatedPhotoURL }));
      setPhotoFile(null);
      setEditing(false);
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      setError('Failed to update profile. Please try again.');
      toast.error('Failed to update profile.');
      console.error('Error in handleSave:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, viewingUserId, userData, photoFile]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'events', eventId));
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      toast.success('Event deleted successfully!');
    } catch (err: any) {
      setError('Failed to delete event. Please try again.');
      toast.error('Failed to delete event.');
      console.error('Error deleting event:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeletePost = useCallback(async (eventId: string, postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'events', eventId, 'posts', postId));
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      toast.success('Post deleted successfully!');
    } catch (err: any) {
      setError('Failed to delete post. Please try again.');
      toast.error('Failed to delete post.');
      console.error('Error deleting post:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFollow = useCallback(async () => {
    if (!currentUser || !viewingUserId || viewingUserId === currentUser.uid) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const targetRef = doc(db, 'users', viewingUserId);
    try {
      if (isFollowing) {
        await updateDoc(userRef, { following: arrayRemove(viewingUserId) });
        await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
        setIsFollowing(false);
        setUserData({ ...userData, followers: userData.followers.filter(id => id !== currentUser.uid) });
      } else {
        await updateDoc(userRef, { following: arrayUnion(viewingUserId) });
        await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
        setIsFollowing(true);
        setUserData({ ...userData, followers: [...userData.followers, currentUser.uid] });
      }
      toast.success(isFollowing ? 'Unfollowed!' : 'Followed!');
    } catch (err: any) {
      toast.error('Failed to update follow status. Please try again.');
      console.error('Error in handleFollow:', err);
    }
  }, [currentUser, viewingUserId, isFollowing, userData]);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const staggerChildren = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
  };

  // Memoize the posts rendering to prevent unnecessary re-renders
  const renderedPosts = useMemo(() => (
    posts.map((post) => (
      <motion.div
        key={`${post.eventId}-${post.id}`}
        className="bg-gray-700 rounded-lg overflow-hidden shadow-lg transform transition-transform hover:-translate-y-1 hover:shadow-xl"
        variants={fadeIn}
      >
        {post.type === 'photo' ? (
          <img
            src={post.mediaUrl}
            alt={`Post from ${post.eventTitle}`}
            className="w-full h-48 object-cover"
            loading="lazy"
          />
        ) : (
          <VideoWithLazyLoad
            src={post.mediaUrl}
            className="w-full h-48 object-cover"
          />
        )}
        <div className="p-4 flex justify-between items-center">
          <div>
            <Link
              to={`/events?search=${post.eventTitle}`}
              className="text-yellow-400 font-semibold hover:underline"
            >
              {post.eventTitle}
            </Link>
            <p className="text-sm text-gray-400 mt-1">
              Posted on {new Date(post.createdAt).toLocaleDateString()}
            </p>
          </div>
          {viewingUserId === currentUser?.uid && (
            <button
              onClick={() => handleDeletePost(post.eventId, post.id)}
              className="text-red-500 hover:text-red-400 transition-colors"
              disabled={loading}
              aria-label={`Delete post from ${post.eventTitle}`}
            >
              <FaTrash size={16} />
            </button>
          )}
        </div>
      </motion.div>
    ))
  ), [posts, viewingUserId, currentUser, handleDeletePost, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-full max-w-4xl p-4 space-y-4">
          <div className="w-32 h-32 rounded-full bg-gray-700 animate-pulse mx-auto"></div>
          <div className="h-6 bg-gray-700 rounded w-3/5 mx-auto animate-pulse"></div>
          <div className="h-4 bg-gray-700 rounded w-2/5 mx-auto animate-pulse"></div>
          <div className="h-24 bg-gray-700 rounded animate-pulse"></div>
          <div className="h-24 bg-gray-700 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-200 py-8 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-4xl mx-auto bg-gray-800 rounded-xl shadow-2xl overflow-hidden"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        {/* Profile Header with Cover Photo */}
        <div className="relative h-48">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-yellow-300 opacity-80"></div>
          <div className="absolute bottom-0 left-6 transform translate-y-1/2">
            {userData.photoURL ? (
              <img
                src={userData.photoURL}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-yellow-400 shadow-lg transform transition-transform hover:scale-105"
                loading="lazy"
              />
            ) : (
              <FaUser className="w-32 h-32 text-gray-400 rounded-full border-4 border-yellow-400 bg-gray-700 p-4" />
            )}
          </div>
        </div>

        {/* User Info */}
        <motion.div className="pt-20 px-6 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-700" variants={fadeIn}>
          <div className="flex-1">
            {editing && viewingUserId === currentUser?.uid ? (
              <>
                <label htmlFor="displayName" className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  id="displayName"
                  type="text"
                  name="displayName"
                  value={userData.displayName}
                  onChange={handleInputChange}
                  className="w-full text-2xl font-bold text-yellow-400 bg-gray-700 p-2 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Your name"
                  disabled={loading}
                />
                <label htmlFor="photoUpload" className="block text-sm text-gray-400 mt-2 mb-1">Profile Photo</label>
                <input
                  id="photoUpload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-yellow-400 file:text-gray-900"
                  disabled={loading}
                />
                {photoFile && <p className="text-sm text-gray-400 mt-1">New photo selected</p>}
              </>
            ) : (
              <h1 className="text-2xl sm:text-3xl font-bold text-yellow-400">{userData.displayName || 'Anonymous'}</h1>
            )}
            <p className="text-gray-400 mt-1">{currentUser?.email}</p>
            <div className="flex gap-3 mt-2">
              <span className="bg-yellow-400/10 text-gray-200 px-3 py-1 rounded-full text-sm">Followers: {userData.followers.length}</span>
              <span className="bg-yellow-400/10 text-gray-200 px-3 py-1 rounded-full text-sm">Following: {userData.following.length}</span>
            </div>
          </div>
          {viewingUserId === currentUser?.uid ? (
            <button
              onClick={() => (editing ? handleSave() : setEditing(true))}
              className="mt-4 sm:mt-0 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 disabled:opacity-50 transition-colors"
              disabled={loading}
              aria-label={editing ? 'Save profile' : 'Edit profile'}
            >
              {editing ? <FaSave size={20} /> : <FaEdit size={20} />}
            </button>
          ) : (
            <button
              onClick={handleFollow}
              className={`mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${isFollowing ? 'bg-gray-500 text-gray-900' : 'bg-yellow-400 text-gray-900'} hover:opacity-90`}
              disabled={loading}
            >
              <FaUserPlus size={20} />
              <span>{isFollowing ? 'Unfollow' : 'Follow'}</span>
            </button>
          )}
        </motion.div>

        {/* Business Contact Info */}
        {businessContact && (
          <motion.div className="p-6 bg-gray-700 rounded-lg m-6" variants={fadeIn}>
            <h2 className="text-xl font-semibold text-yellow-400 mb-4">Business Contact Info</h2>
            <p className="text-gray-200"><strong>Business:</strong> {businessContact.name}</p>
            {businessContact.contactEmail && (
              <p className="text-gray-200 flex items-center mt-2">
                <FaEnvelope className="mr-2 text-yellow-400" /> <strong>Email:</strong> {businessContact.contactEmail}
              </p>
            )}
            {businessContact.contactPhone && (
              <p className="text-gray-200 flex items-center mt-2">
                <FaPhone className="mr-2 text-yellow-400" /> <strong>Phone:</strong> {businessContact.contactPhone}
              </p>
            )}
          </motion.div>
        )}

        {/* Bio and Location */}
        <motion.div className="p-6 grid gap-6" variants={fadeIn}>
          <div className="bg-gray-700 p-4 rounded-lg">
            <h2 className="text-xl font-semibold text-yellow-400 mb-2">Bio</h2>
            {editing ? (
              <>
                <label htmlFor="bio" className="block text-sm text-gray-400 mb-1">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={userData.bio}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-3 rounded bg-gray-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  rows={3}
                  placeholder="Tell us about yourself"
                  disabled={loading}
                />
              </>
            ) : (
              <p className="text-gray-400 leading-relaxed">{userData.bio || 'No bio yet.'}</p>
            )}
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <h2 className="text-xl font-semibold text-yellow-400 mb-2">Location</h2>
            {editing ? (
              <>
                <label htmlFor="location" className="block text-sm text-gray-400 mb-1">Location</label>
                <input
                  id="location"
                  type="text"
                  name="location"
                  value={userData.location}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-3 rounded bg-gray-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="e.g., New York, NY"
                  disabled={loading}
                />
              </>
            ) : (
              <p className="text-gray-400">{userData.location || 'No location set.'}</p>
            )}
          </div>
          {editing && (
            <>
              <div className="bg-gray-700 p-4 rounded-lg">
                <label htmlFor="contactEmail" className="block text-sm text-gray-400 mb-1">Contact Email</label>
                <input
                  id="contactEmail"
                  type="email"
                  name="contactEmail"
                  value={userData.contactEmail}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-3 rounded bg-gray-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="e.g., you@example.com"
                  disabled={loading}
                />
              </div>
              <div className="bg-gray-700 p-4 rounded-lg">
                <label htmlFor="contactPhone" className="block text-sm text-gray-400 mb-1">Contact Phone</label>
                <input
                  id="contactPhone"
                  type="tel"
                  name="contactPhone"
                  value={userData.contactPhone}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-3 rounded bg-gray-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="e.g., +1-123-456-7890"
                  disabled={loading}
                />
              </div>
            </>
          )}
        </motion.div>

        {/* Error State with Retry */}
        {error && (
          <motion.div className="m-6 p-4 bg-red-500 text-white rounded-lg flex justify-center items-center gap-3" variants={fadeIn}>
            <p>{error}</p>
            <button
              onClick={() => fetchInitialData()}
              className="flex items-center gap-2 px-4 py-2 bg-white text-red-500 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Retry loading profile data"
            >
              <FaRedo size={16} /> Retry
            </button>
          </motion.div>
        )}

        {/* Notifications */}
        {viewingUserId === currentUser?.uid && notifications.length > 0 && (
          <motion.section className="p-6" variants={staggerChildren}>
            <h2 className="text-xl font-semibold text-yellow-400 mb-4">Notifications</h2>
            <motion.div className="space-y-4" variants={staggerChildren}>
              {notifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  className="bg-gray-700 p-4 rounded-lg shadow transform transition-transform hover:-translate-y-1 hover:shadow-lg"
                  variants={fadeIn}
                >
                  <p className="text-gray-200">{notif.message}</p>
                  <Link
                    to={`/business-profile?businessId=${notif.businessId}`}
                    className="text-yellow-400 hover:underline font-medium"
                  >
                    View Recommended Business
                  </Link>
                  <p className="text-sm text-gray-400 mt-1">
                    From: {notif.from} on {new Date(notif.createdAt).toLocaleDateString()}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        )}

        {/* Events */}
        <motion.section className="p-6" variants={staggerChildren}>
          <h2 className="text-xl font-semibold text-yellow-400 mb-4">Your Events</h2>
          {events.length > 0 ? (
            <motion.div className="space-y-4" variants={staggerChildren}>
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  className="bg-gray-700 p-4 rounded-lg shadow flex justify-between items-center transform transition-transform hover:-translate-y-1 hover:shadow-lg"
                  variants={fadeIn}
                >
                  <div>
                    <Link
                      to={`/events?search=${event.title}`}
                      className="text-yellow-400 font-semibold hover:underline"
                    >
                      {event.title}
                    </Link>
                    <p className="text-sm text-gray-400 mt-1">
                      Created on {new Date(event.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {viewingUserId === currentUser?.uid && (
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="text-red-500 hover:text-red-400 transition-colors"
                      disabled={loading}
                      aria-label={`Delete event ${event.title}`}
                    >
                      <FaTrash size={16} />
                    </button>
                  )}
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-gray-400 text-center py-6">No events created yet.</p>
          )}
        </motion.section>

        {/* Posts */}
        <motion.section className="p-6" variants={staggerChildren}>
          <h2 className="text-xl font-semibold text-yellow-400 mb-4">Your Posts</h2>
          {posts.length > 0 ? (
            <>
              <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" variants={staggerChildren}>
                {renderedPosts}
              </motion.div>
              {hasMorePosts && (
                <div ref={loadMoreRef} className="flex justify-center py-6">
                  {loadingMore ? (
                    <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <p className="text-gray-400">Scroll to load more...</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-center py-6">No posts yet.</p>
          )}
        </motion.section>
      </motion.div>
    </div>
  );
}

export default Profile;