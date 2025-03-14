// src/pages/Profile.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FaUser, FaEdit, FaSave, FaTrash, FaUserPlus, FaEnvelope, FaPhone } from 'react-icons/fa';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth, storage, getUserEvents, getBusinesses } from '../services/firebase';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-toastify';

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
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
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
        // Filter based on visibility for other users
        setEvents(
          userId === currentUser.uid
            ? userEvents // Show all events for own profile
            : userEvents.filter((e) => e.visibility === 'public') // Only public events for others
        );

        // Fetch user posts
        const allEventsSnapshot = await getDocs(collection(db, 'events'));
        const eventsMap = new Map<string, string>(
          allEventsSnapshot.docs.map((doc) => [doc.id, doc.data().title || 'Unknown Event'])
        );
        const userPosts: Post[] = [];
        for (const eventDoc of allEventsSnapshot.docs) {
          const postsQuery = query(
            collection(db, 'events', eventDoc.id, 'posts'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
          );
          const postsSnapshot = await getDocs(postsQuery);
          postsSnapshot.forEach((doc) => {
            userPosts.push({
              id: doc.id,
              eventId: eventDoc.id,
              eventTitle: eventsMap.get(eventDoc.id) || 'Unknown Event',
              mediaUrl: doc.data().mediaUrl || '',
              type: doc.data().type as 'photo' | 'video',
              createdAt: doc.data().createdAt || new Date().toISOString(),
            });
          });
        }
        setPosts(userPosts);

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
        setError('Failed to load profile data: ' + err.message);
        toast.error('Failed to load profile data.');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, navigate, location]);

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
      setError('Failed to update profile: ' + err.message);
      toast.error('Failed to update profile.');
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
      toast.success('Event deleted successfully!');
    } catch (err: any) {
      setError('Failed to delete event: ' + err.message);
      toast.error('Failed to delete event.');
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
      toast.success('Post deleted successfully!');
    } catch (err: any) {
      setError('Failed to delete post: ' + err.message);
      toast.error('Failed to delete post.');
      console.error('Error deleting post:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
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
      toast.error('Failed to update follow status: ' + err.message);
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
        <svg className="animate-spin h-8 w-8 text-accent-gold" viewBox="0 0 24 24">
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
        <motion.div className="flex items-center space-x-6" variants={fadeIn}>
          {userData.photoURL ? (
            <img
              src={userData.photoURL}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover border-4 border-accent-gold"
            />
          ) : (
            <FaUser className="w-24 h-24 text-neutral-lightGray" />
          )}
          <div className="flex-1">
            {editing && viewingUserId === currentUser?.uid ? (
              <>
                <label htmlFor="displayName" className="block text-sm text-neutral-lightGray">Name</label>
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
                <label htmlFor="photoUpload" className="block text-sm text-neutral-lightGray">Profile Photo</label>
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
              <h1 className="text-3xl font-bold text-accent-gold">{userData.displayName || 'Anonymous'}</h1>
            )}
            <p className="text-neutral-lightGray">{currentUser?.email}</p>
            <p className="text-neutral-lightGray">Followers: {userData.followers.length} | Following: {userData.following.length}</p>
          </div>
          {viewingUserId === currentUser?.uid ? (
            <button
              onClick={() => (editing ? handleSave() : setEditing(true))}
              className="ml-auto bg-secondary-deepRed text-neutral-lightGray p-2 rounded-full hover:bg-secondary-darkRed disabled:opacity-50"
              disabled={loading}
              aria-label={editing ? 'Save profile' : 'Edit profile'}
            >
              {editing ? <FaSave size={20} /> : <FaEdit size={20} />}
            </button>
          ) : (
            <button
              onClick={handleFollow}
              className={`ml-auto p-2 rounded-full ${isFollowing ? 'bg-neutral-lightGray text-neutral-darkGray' : 'bg-accent-gold text-neutral-darkGray'} hover:opacity-80`}
              disabled={loading}
            >
              <FaUserPlus size={20} />
            </button>
          )}
        </motion.div>

        {businessContact && (
          <motion.div className="mt-6 bg-neutral-offWhite p-4 rounded-lg" variants={fadeIn}>
            <h2 className="text-xl font-semibold text-accent-gold">Business Contact Info</h2>
            <p className="text-neutral-darkGray"><strong>Business:</strong> {businessContact.name}</p>
            {businessContact.contactEmail && (
              <p className="text-neutral-darkGray flex items-center">
                <FaEnvelope className="mr-2" /> <strong>Email:</strong> {businessContact.contactEmail}
              </p>
            )}
            {businessContact.contactPhone && (
              <p className="text-neutral-darkGray flex items-center">
                <FaPhone className="mr-2" /> <strong>Phone:</strong> {businessContact.contactPhone}
              </p>
            )}
          </motion.div>
        )}

        <motion.div className="mt-6 space-y-4" variants={fadeIn}>
          <div>
            <h2 className="text-xl font-semibold text-accent-gold">Bio</h2>
            {editing ? (
              <>
                <label htmlFor="bio" className="block text-sm text-neutral-lightGray">Bio</label>
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
                <label htmlFor="location" className="block text-sm text-neutral-lightGray">Location</label>
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
          {editing && (
            <>
              <div>
                <label htmlFor="contactEmail" className="block text-sm text-neutral-lightGray">Contact Email</label>
                <input
                  id="contactEmail"
                  type="email"
                  name="contactEmail"
                  value={userData.contactEmail}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-3 rounded bg-neutral-offWhite text-neutral-darkGray"
                  placeholder="e.g., you@example.com"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="contactPhone" className="block text-sm text-neutral-lightGray">Contact Phone</label>
                <input
                  id="contactPhone"
                  type="tel"
                  name="contactPhone"
                  value={userData.contactPhone}
                  onChange={handleInputChange}
                  className="w-full mt-2 p-3 rounded bg-neutral-offWhite text-neutral-darkGray"
                  placeholder="e.g., +1-123-456-7890"
                  disabled={loading}
                />
              </div>
            </>
          )}
        </motion.div>

        {error && (
          <motion.p className="mt-4 text-center text-red-500" variants={fadeIn}>
            {error}
          </motion.p>
        )}

        {viewingUserId === currentUser?.uid && notifications.length > 0 && (
          <motion.section className="mt-8" variants={staggerChildren}>
            <h2 className="text-xl font-semibold text-accent-gold mb-4">Notifications</h2>
            <motion.div className="space-y-4" variants={staggerChildren}>
              {notifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  className="bg-neutral-offWhite text-neutral-darkGray p-4 rounded-lg shadow"
                  variants={fadeIn}
                >
                  <p>{notif.message}</p>
                  <Link
                    to={`/business-profile?businessId=${notif.businessId}`}
                    className="text-accent-gold hover:underline"
                  >
                    View Recommended Business
                  </Link>
                  <p className="text-sm mt-1">
                    From: {notif.from} on {new Date(notif.createdAt).toLocaleDateString()}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        )}

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
                      to={`/events?search=${event.title}`}
                      className="text-accent-gold hover:underline font-semibold"
                    >
                      {event.title}
                    </Link>
                    <p className="text-sm mt-1">
                      Created on {new Date(event.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {viewingUserId === currentUser?.uid && (
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="text-red-500 hover:text-red-700 focus:outline-none"
                      disabled={loading}
                      aria-label={`Delete event ${event.title}`}
                    >
                      <FaTrash size={20} />
                    </button>
                  )}
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-neutral-lightGray">No events created yet.</p>
          )}
        </motion.section>

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
                        to={`/events?search=${post.eventTitle}`}
                        className="text-accent-gold hover:underline font-semibold"
                      >
                        {post.eventTitle}
                      </Link>
                      <p className="text-sm mt-1">
                        Posted on {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {viewingUserId === currentUser?.uid && (
                      <button
                        onClick={() => handleDeletePost(post.eventId, post.id)}
                        className="text-red-500 hover:text-red-700 focus:outline-none"
                        disabled={loading}
                        aria-label={`Delete post from ${post.eventTitle}`}
                      >
                        <FaTrash size={20} />
                      </button>
                    )}
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