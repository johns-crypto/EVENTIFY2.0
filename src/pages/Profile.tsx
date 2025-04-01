// src/pages/Profile.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FaUser, FaEdit, FaSave, FaTrash, FaUserPlus, FaRedo, FaUserMinus, FaUsers, FaUserFriends } from 'react-icons/fa';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, orderBy, arrayUnion, arrayRemove, QueryDocumentSnapshot, DocumentData, startAfter, limit } from 'firebase/firestore';
import { db, auth, getUserEvents } from '../services/firebase';
import { updateProfile } from 'firebase/auth';
import { toast } from 'react-toastify';
import debounce from 'lodash/debounce';
import { uploadImageToCloudinary } from '../utils/cloudinary';
import { Tooltip } from 'react-tooltip';

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

interface UserProfile {
  id: string;
  displayName: string;
  photoURL?: string;
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
  const [followersData, setFollowersData] = useState<UserProfile[]>([]);
  const [followingData, setFollowingData] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [lastPostDoc, setLastPostDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>('followers');

  const postsPerPage = 6;
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

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
      const file = e.target.files[0];
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchUserProfiles = async (userIds: string[]): Promise<UserProfile[]> => {
    const users: UserProfile[] = [];
    for (const userId of userIds) {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        users.push({
          id: userId,
          displayName: userData.displayName || `User ${userId}`,
          photoURL: userData.photoURL || '',
        });
      }
    }
    return users;
  };

  const fetchInitialData = useCallback(async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const urlParams = new URLSearchParams(location.search);
      const userId = urlParams.get('userId') || currentUser.uid;
      setViewingUserId(userId);

      const userDoc = doc(db, 'users', userId);
      const userSnapshot = await getDoc(userDoc);
      const userInfo: UserData = userSnapshot.exists()
        ? {
            ...userSnapshot.data() as UserData,
            followers: userSnapshot.data().followers || [],
            following: userSnapshot.data().following || [],
          }
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

      if (userInfo.followers.length > 0) {
        const followersList = await fetchUserProfiles(userInfo.followers);
        setFollowersData(followersList);
      }
      if (userInfo.following.length > 0) {
        const followingList = await fetchUserProfiles(userInfo.following);
        setFollowingData(followingList);
      }

      if (userId !== currentUser.uid) {
        const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
        setIsFollowing(currentUserDoc.data()?.following?.includes(userId) || false);
      }

      const userEvents = await getUserEvents(userId);
      const accessibleEvents = userId === currentUser.uid
        ? userEvents
        : userEvents.filter((e) => e.visibility === 'public');
      setEvents(accessibleEvents);

      if (userId === currentUser.uid) {
        const notificationsQuery = query(
          collection(db, 'users', userId, 'notifications'),
          orderBy('createdAt', 'desc')
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        setNotifications(
          notificationsSnapshot.docs.map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
              } as Notification)
          )
        );
      }
    } catch (err: any) {
      setError('Failed to load profile data. Please try again.');
      toast.error('Failed to load profile data.');
      console.error('Error fetching initial data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, navigate, location]);

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

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (events.length > 0 && !loading) {
      fetchPosts();
    }
  }, [events, fetchPosts, loading]);

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
        updatedPhotoURL = await uploadImageToCloudinary(photoFile);
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
      setPhotoPreview(null);
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

  const handleFollowUser = useCallback(
    async (targetUserId: string, isCurrentlyFollowing: boolean) => {
      if (!currentUser || targetUserId === currentUser.uid) return;
      setFollowLoading(targetUserId);
      const userRef = doc(db, 'users', currentUser.uid);
      const targetRef = doc(db, 'users', targetUserId);
      try {
        if (isCurrentlyFollowing) {
          await updateDoc(userRef, { following: arrayRemove(targetUserId) });
          await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
          setFollowingData(followingData.filter((user) => user.id !== targetUserId));
          if (viewingUserId === targetUserId) {
            setIsFollowing(false);
            setUserData((prev) => ({
              ...prev,
              followers: prev.followers.filter((id) => id !== currentUser.uid),
            }));
            setFollowersData(followersData.filter((follower) => follower.id !== currentUser.uid));
          }
          toast.success('Unfollowed user!');
        } else {
          await updateDoc(userRef, { following: arrayUnion(targetUserId) });
          await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
          const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
          const targetUserData = targetUserDoc.data();
          setFollowingData([
            ...followingData,
            {
              id: targetUserId,
              displayName: targetUserData?.displayName || `User ${targetUserId}`,
              photoURL: targetUserData?.photoURL || '',
            },
          ]);
          if (viewingUserId === targetUserId) {
            setIsFollowing(true);
            setUserData((prev) => ({
              ...prev,
              followers: [...prev.followers, currentUser.uid],
            }));
            const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const currentUserData = currentUserDoc.data();
            setFollowersData([
              ...followersData,
              {
                id: currentUser.uid,
                displayName: currentUserData?.displayName || `User ${currentUser.uid}`,
                photoURL: currentUserData?.photoURL || '',
              },
            ]);
          }
          toast.success('Followed user!');
        }
      } catch (err: any) {
        toast.error('Failed to update follow status. Please try again.');
        console.error('Error in handleFollowUser:', err);
      } finally {
        setFollowLoading(null);
      }
    },
    [currentUser, viewingUserId, followersData, followingData]
  );

  const handleFollow = useCallback(async () => {
    if (!currentUser || !viewingUserId || viewingUserId === currentUser.uid) return;
    setFollowLoading(viewingUserId);
    await handleFollowUser(viewingUserId, isFollowing);
  }, [currentUser, viewingUserId, isFollowing, handleFollowUser]);

  const handleRemoveFollower = useCallback(
    async (followerId: string) => {
      if (!currentUser || viewingUserId !== currentUser.uid) return;
      setFollowLoading(followerId);
      const userRef = doc(db, 'users', currentUser.uid);
      const followerRef = doc(db, 'users', followerId);
      try {
        await updateDoc(userRef, { followers: arrayRemove(followerId) });
        await updateDoc(followerRef, { following: arrayRemove(currentUser.uid) });
        setUserData((prev) => ({
          ...prev,
          followers: prev.followers.filter((id) => id !== followerId),
        }));
        setFollowersData(followersData.filter((follower) => follower.id !== followerId));
        toast.success('Follower removed!');
      } catch (err: any) {
        toast.error('Failed to remove follower. Please try again.');
        console.error('Error in handleRemoveFollower:', err);
      } finally {
        setFollowLoading(null);
      }
    },
    [currentUser, viewingUserId, followersData]
  );

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const staggerChildren = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
  };

  const renderedPosts = useMemo(
    () =>
      posts.map((post) => (
        <motion.div
          key={`${post.eventId}-${post.id}`}
          className="bg-gray-800 rounded-xl overflow-hidden shadow-lg transform transition-all hover:-translate-y-1 hover:shadow-xl"
          variants={fadeIn}
        >
          {post.type === 'photo' ? (
            <img
              src={post.mediaUrl}
              alt={`Post from ${post.eventTitle}`}
              className="w-full h-48 object-cover rounded-t-xl"
              loading="lazy"
            />
          ) : (
            <VideoWithLazyLoad src={post.mediaUrl} className="w-full h-48 object-cover rounded-t-xl" />
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
                data-tooltip-id="delete-post-tooltip"
                data-tooltip-content="Delete this post"
              >
                <FaTrash size={16} />
              </button>
            )}
          </div>
        </motion.div>
      )),
    [posts, viewingUserId, currentUser, handleDeletePost, loading]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="w-full max-w-4xl p-6 space-y-6">
          <div className="w-32 h-32 rounded-full bg-gray-700 animate-pulse mx-auto"></div>
          <div className="h-8 bg-gray-700 rounded w-3/5 mx-auto animate-pulse"></div>
          <div className="h-4 bg-gray-700 rounded w-2/5 mx-auto animate-pulse"></div>
          <div className="h-24 bg-gray-700 rounded animate-pulse"></div>
          <div className="h-24 bg-gray-700 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-200 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-5xl mx-auto bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-gray-700/50"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        {/* Profile Header */}
        <div className="relative h-56">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-yellow-300 opacity-70"></div>
          <div className="absolute bottom-0 left-8 transform translate-y-1/2">
            {userData.photoURL ? (
              <img
                src={userData.photoURL}
                alt="Profile"
                className="w-36 h-36 rounded-full object-cover border-4 border-yellow-400 shadow-lg transform transition-transform hover:scale-105"
              />
            ) : (
              <FaUser className="w-36 h-36 text-gray-400 rounded-full border-4 border-yellow-400 bg-gray-700 p-4" />
            )}
          </div>
        </div>

        <motion.div
          className="pt-24 px-8 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-700/50"
          variants={fadeIn}
        >
          <div className="flex-1">
            {editing && viewingUserId === currentUser?.uid ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-sm text-gray-400 mb-2 font-medium">
                    Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    name="displayName"
                    value={userData.displayName}
                    onChange={handleInputChange}
                    className="w-full text-2xl font-bold text-yellow-400 bg-gray-700/50 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                    placeholder="Your name"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="photoUpload" className="block text-sm text-gray-400 mb-2 font-medium">
                    Profile Photo
                  </label>
                  <input
                    id="photoUpload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-400 file:text-gray-900 hover:file:bg-yellow-300 transition-all"
                    disabled={loading}
                  />
                  {photoPreview && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-400 mb-2">Preview:</p>
                      <img
                        src={photoPreview}
                        alt="Profile Preview"
                        className="w-32 h-32 rounded-full object-cover border-2 border-yellow-400"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <h1 className="text-3xl sm:text-4xl font-bold text-yellow-400 tracking-tight">
                {userData.displayName || 'Anonymous'}
              </h1>
            )}
            <p className="text-gray-400 mt-2 text-lg">{currentUser?.email}</p>
            <div className="flex gap-4 mt-3">
              <span className="bg-yellow-400/10 text-gray-200 px-4 py-1.5 rounded-full text-sm font-medium">
                Followers: {userData.followers.length}
              </span>
              <span className="bg-yellow-400/10 text-gray-200 px-4 py-1.5 rounded-full text-sm font-medium">
                Following: {userData.following.length}
              </span>
            </div>
          </div>
          {viewingUserId === currentUser?.uid ? (
            <button
              onClick={() => (editing ? handleSave() : setEditing(true))}
              className="mt-4 sm:mt-0 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 px-5 py-2.5 rounded-full hover:from-yellow-300 hover:to-yellow-400 disabled:opacity-50 transition-all shadow-md hover:shadow-lg font-semibold flex items-center gap-2"
              disabled={loading}
              data-tooltip-id="edit-tooltip"
              data-tooltip-content={editing ? 'Save your profile changes' : 'Edit your profile'}
            >
              {editing ? <FaSave size={20} /> : <FaEdit size={20} />}
              <span>{editing ? 'Save' : 'Edit'}</span>
            </button>
          ) : (
            <button
              onClick={handleFollow}
              className={`mt-4 sm:mt-0 flex items-center gap-2 px-5 py-2.5 rounded-full transition-all shadow-md hover:shadow-lg font-semibold ${
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
        </motion.div>

        {/* Social Connections Section */}
        <motion.section className="p-8" variants={staggerChildren}>
          <div className="flex justify-start space-x-4 mb-6">
            <button
              onClick={() => setActiveTab('followers')}
              className={`flex items-center gap-2 px-5 py-2 rounded-full font-semibold transition-all shadow-md hover:shadow-lg ${
                activeTab === 'followers'
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              <FaUsers size={20} />
              Followers
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`flex items-center gap-2 px-5 py-2 rounded-full font-semibold transition-all shadow-md hover:shadow-lg ${
                activeTab === 'following'
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              <FaUserFriends size={20} />
              Following
            </button>
          </div>
          <motion.div className="space-y-4" variants={staggerChildren}>
            {(activeTab === 'followers' ? followersData : followingData).length > 0 ? (
              (activeTab === 'followers' ? followersData : followingData).map((user) => {
                const isUserFollowing = followingData.some((f) => f.id === user.id);
                return (
                  <motion.div
                    key={user.id}
                    className="bg-gray-700/50 backdrop-blur-sm p-4 rounded-xl shadow-lg flex items-center justify-between transform transition-all hover:-translate-y-1 hover:shadow-xl border border-gray-600/30"
                    variants={fadeIn}
                  >
                    <Link to={`/profile?userId=${user.id}`} className="flex items-center gap-4">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          className="w-12 h-12 rounded-full object-cover border-2 border-yellow-400"
                        />
                      ) : (
                        <FaUser className="w-12 h-12 text-gray-400 rounded-full border-2 border-yellow-400 p-2" />
                      )}
                      <span className="text-gray-200 font-semibold text-lg hover:text-yellow-400 transition-colors">
                        {user.displayName}
                      </span>
                    </Link>
                    <div className="flex items-center gap-2">
                      {activeTab === 'followers' && viewingUserId === currentUser?.uid && (
                        <button
                          onClick={() => handleRemoveFollower(user.id)}
                          className="text-red-500 hover:text-red-400 transition-colors"
                          disabled={followLoading === user.id}
                          aria-label={`Remove ${user.displayName} as a follower`}
                          data-tooltip-id={`remove-follower-${user.id}`}
                          data-tooltip-content="Remove this follower"
                        >
                          {followLoading === user.id ? (
                            <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <FaUserMinus size={16} />
                          )}
                        </button>
                      )}
                      {currentUser && user.id !== currentUser.uid && (
                        <button
                          onClick={() => handleFollowUser(user.id, isUserFollowing)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all shadow-md hover:shadow-lg ${
                            isUserFollowing
                              ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                              : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 hover:from-yellow-300 hover:to-yellow-400'
                          } disabled:opacity-50`}
                          disabled={loading || followLoading === user.id}
                          aria-label={isUserFollowing ? `Unfollow ${user.displayName}` : `Follow ${user.displayName}`}
                          data-tooltip-id={`follow-user-${user.id}`}
                          data-tooltip-content={isUserFollowing ? 'Unfollow this user' : 'Follow this user'}
                        >
                          {followLoading === user.id ? (
                            <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <FaUserPlus size={16} />
                          )}
                          <span>{isUserFollowing ? 'Unfollow' : 'Follow'}</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <p className="text-gray-400 text-center py-6 text-lg">
                {activeTab === 'followers' ? 'No followers found.' : 'Not following anyone.'}
              </p>
            )}
          </motion.div>
        </motion.section>

        {/* Bio and Details Section */}
        <motion.div className="p-8 grid gap-6" variants={fadeIn}>
          <div className="bg-gray-700/50 backdrop-blur-sm p-6 rounded-xl border border-gray-600/30">
            <h2 className="text-xl font-semibold text-yellow-400 mb-4 tracking-tight">Bio</h2>
            {editing ? (
              <>
                <label htmlFor="bio" className="block text-sm text-gray-400 mb-2 font-medium">
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  value={userData.bio}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-4 rounded-lg bg-gray-600/50 border border-gray-500 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  rows={4}
                  placeholder="Tell us about yourself"
                  disabled={loading}
                />
              </>
            ) : (
              <p className="text-gray-400 leading-relaxed text-lg">{userData.bio || 'No bio yet.'}</p>
            )}
          </div>
          <div className="bg-gray-700/50 backdrop-blur-sm p-6 rounded-xl border border-gray-600/30">
            <h2 className="text-xl font-semibold text-yellow-400 mb-4 tracking-tight">Location</h2>
            {editing ? (
              <>
                <label htmlFor="location" className="block text-sm text-gray-400 mb-2 font-medium">
                  Location
                </label>
                <input
                  id="location"
                  type="text"
                  name="location"
                  value={userData.location}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-4 rounded-lg bg-gray-600/50 border border-gray-500 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  placeholder="e.g., New York, NY"
                  disabled={loading}
                />
              </>
            ) : (
              <p className="text-gray-400 text-lg">{userData.location || 'No location set.'}</p>
            )}
          </div>
          {editing && (
            <>
              <div className="bg-gray-700/50 backdrop-blur-sm p-6 rounded-xl border border-gray-600/30">
                <label htmlFor="contactEmail" className="block text-sm text-gray-400 mb-2 font-medium">
                  Contact Email
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  name="contactEmail"
                  value={userData.contactEmail}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-4 rounded-lg bg-gray-600/50 border border-gray-500 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  placeholder="e.g., you@example.com"
                  disabled={loading}
                />
              </div>
              <div className="bg-gray-700/50 backdrop-blur-sm p-6 rounded-xl border border-gray-600/30">
                <label htmlFor="contactPhone" className="block text-sm text-gray-400 mb-2 font-medium">
                  Contact Phone
                </label>
                <input
                  id="contactPhone"
                  type="tel"
                  name="contactPhone"
                  value={userData.contactPhone}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-4 rounded-lg bg-gray-600/50 border border-gray-500 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  placeholder="e.g., +1-123-456-7890"
                  disabled={loading}
                />
              </div>
            </>
          )}
        </motion.div>

        {/* Error Section */}
        {error && (
          <motion.div
            className="m-6 p-6 bg-red-500/90 text-white rounded-xl flex justify-center items-center gap-4"
            variants={fadeIn}
          >
            <p className="text-lg">{error}</p>
            <button
              onClick={() => fetchInitialData()}
              className="flex items-center gap-2 px-5 py-2 bg-white text-red-500 rounded-full hover:bg-gray-200 transition-all font-semibold"
              aria-label="Retry loading profile data"
            >
              <FaRedo size={16} /> Retry
            </button>
          </motion.div>
        )}

        {/* Notifications Section */}
        {viewingUserId === currentUser?.uid && notifications.length > 0 && (
          <motion.section className="p-8" variants={staggerChildren}>
            <h2 className="text-2xl font-semibold text-yellow-400 mb-6 tracking-tight">Notifications</h2>
            <motion.div className="space-y-4" variants={staggerChildren}>
              {notifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  className="bg-gray-700/50 backdrop-blur-sm p-6 rounded-xl shadow-lg transform transition-all hover:-translate-y-1 hover:shadow-xl border border-gray-600/30"
                  variants={fadeIn}
                >
                  <p className="text-gray-200 text-lg">{notif.message}</p>
                  <Link
                    to={`/business-profile?businessId=${notif.businessId}`}
                    className="text-yellow-400 hover:underline font-medium text-lg"
                  >
                    View Recommended Business
                  </Link>
                  <p className="text-sm text-gray-400 mt-2">
                    From: {notif.from} on {new Date(notif.createdAt).toLocaleDateString()}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        )}

        {/* Events Section */}
        <motion.section className="p-8" variants={staggerChildren}>
          <h2 className="text-2xl font-semibold text-yellow-400 mb-6 tracking-tight">Your Events</h2>
          {events.length > 0 ? (
            <motion.div className="space-y-4" variants={staggerChildren}>
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  className="bg-gray-700/50 backdrop-blur-sm p-6 rounded-xl shadow-lg flex justify-between items-center transform transition-all hover:-translate-y-1 hover:shadow-xl border border-gray-600/30"
                  variants={fadeIn}
                >
                  <div>
                    <Link
                      to={`/events?search=${event.title}`}
                      className="text-yellow-400 font-semibold text-lg hover:underline"
                    >
                      {event.title}
                    </Link>
                    <p className="text-sm text-gray-400 mt-2">
                      Created on {new Date(event.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {viewingUserId === currentUser?.uid && (
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="text-red-500 hover:text-red-400 transition-colors"
                      disabled={loading}
                      data-tooltip-id={`delete-event-${event.id}`}
                      data-tooltip-content="Delete this event"
                    >
                      <FaTrash size={16} />
                    </button>
                  )}
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-gray-400 text-center py-6 text-lg">No events created yet.</p>
          )}
        </motion.section>

        {/* Posts Section */}
        <motion.section className="p-8" variants={staggerChildren}>
          <h2 className="text-2xl font-semibold text-yellow-400 mb-6 tracking-tight">Your Posts</h2>
          {posts.length > 0 ? (
            <>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                variants={staggerChildren}
              >
                {renderedPosts}
              </motion.div>
              {hasMorePosts && (
                <div ref={loadMoreRef} className="flex justify-center py-6">
                  {loadingMore ? (
                    <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <p className="text-gray-400 text-lg">Scroll to load more...</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-center py-6 text-lg">No posts yet.</p>
          )}
        </motion.section>
      </motion.div>

      {/* Tooltips */}
      <Tooltip id="edit-tooltip" place="top" className="bg-gray-700 text-gray-200 rounded-lg" />
      <Tooltip id="follow-tooltip" place="top" className="bg-gray-700 text-gray-200 rounded-lg" />
      <Tooltip id="delete-post-tooltip" place="top" className="bg-gray-700 text-gray-200 rounded-lg" />
      {(activeTab === 'followers' ? followersData : followingData).map((user) => (
        <div key={user.id}>
          <Tooltip
            id={`remove-follower-${user.id}`}
            place="top"
            className="bg-gray-700 text-gray-200 rounded-lg"
          />
          <Tooltip
            id={`follow-user-${user.id}`}
            place="top"
            className="bg-gray-700 text-gray-200 rounded-lg"
          />
        </div>
      ))}
      {events.map((event) => (
        <Tooltip
          key={`delete-event-${event.id}`}
          id={`delete-event-${event.id}`}
          place="top"
          className="bg-gray-700 text-gray-200 rounded-lg"
        />
      ))}
    </div>
  );
}

export default Profile;