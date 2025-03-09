import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, collection as firestoreCollection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCalendarAlt, FaHeart, FaComment } from 'react-icons/fa';
import { motion } from 'framer-motion';
import CustomQRCode from '../components/CustomQRCode';

interface Event {
  id: string;
  title: string;
  date: string;
  description: string;
  category: 'Refreshments' | 'Catering/Food' | 'Venue Provider';
  imageUrl?: string;
  organizerId: string;
  organizers: string[];
  visibility: 'public' | 'private';
  inviteLink: string;
  invitedUsers: string[];
  pendingInvites: string[];
}

interface Post {
  id: string;
  userId: string;
  mediaUrl: string;
  type: 'photo' | 'video';
  visibility: 'public' | 'private';
  likes: string[];
  comments: { userId: string; text: string }[];
  createdAt: string;
}

function Events() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [posts, setPosts] = useState<{ [eventId: string]: Post[] }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [newCollaborator, setNewCollaborator] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    description: '',
    category: 'Refreshments' as 'Refreshments' | 'Catering/Food' | 'Venue Provider',
    visibility: 'public' as 'public' | 'private',
    image: null as File | null,
  });
  const [showOptions, setShowOptions] = useState<string | null>(null);
  const [newPost, setNewPost] = useState<{ [eventId: string]: { media: File | null; visibility: 'public' | 'private' } }>({});
  const [searchQuery, setSearchQuery] = useState('');

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
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const eventsCol = collection(db, 'events');
      const snapshot = await getDocs(eventsCol);
      const eventsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Event[];
      setEvents(eventsData);

      const searchParams = new URLSearchParams(location.search);
      const query = searchParams.get('search')?.toLowerCase() || '';
      setSearchQuery(query);
      filterEvents(eventsData, query);

      const postsData: { [eventId: string]: Post[] } = {};
      for (const event of eventsData) {
        if (currentUser && (event.organizers.includes(currentUser.uid) || event.invitedUsers.includes(currentUser.uid))) {
          const postsCol = firestoreCollection(db, 'events', event.id, 'posts');
          const postsSnapshot = await getDocs(postsCol);
          postsData[event.id] = postsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Post[];
        }
      }
      setPosts(postsData);
    } catch (err) {
      setError('Failed to fetch events or posts.');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterEvents = (eventsData: Event[], query: string = searchQuery) => {
    let result = eventsData;
    if (!currentUser) {
      result = result.filter((e) => e.visibility === 'public');
    } else {
      result = result.filter(
        (e) =>
          e.visibility === 'public' ||
          e.organizers.includes(currentUser.uid) ||
          e.invitedUsers.includes(currentUser.uid)
      );
    }
    if (filter) {
      result = result.filter((e) => e.category === filter);
    }
    if (query) {
      result = result.filter((e) => e.title.toLowerCase().includes(query));
    }
    setFilteredEvents(result);
  };

  const handleFilter = (category: string | null) => {
    setFilter(category);
    filterEvents(events, searchQuery);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    filterEvents(events, query);
  };

  const clearSearch = () => {
    setSearchQuery('');
    filterEvents(events, '');
  };

  const requestInvite = async (eventId: string) => {
    if (!currentUser) return setError('Please log in to request an invite.');
    const eventRef = doc(db, 'events', eventId);
    const event = events.find((e) => e.id === eventId);
    if (event && !event.pendingInvites.includes(currentUser.uid)) {
      await updateDoc(eventRef, {
        pendingInvites: [...event.pendingInvites, currentUser.uid],
      });
      fetchEvents();
    }
  };

  const approveInvite = async (eventId: string, userId: string) => {
    const eventRef = doc(db, 'events', eventId);
    const event = events.find((e) => e.id === eventId);
    if (event && event.organizerId === currentUser?.uid) {
      await updateDoc(eventRef, {
        invitedUsers: [...event.invitedUsers, userId],
        pendingInvites: event.pendingInvites.filter((id) => id !== userId),
      });
      fetchEvents();
    }
  };

  const addCollaborator = async (eventId: string) => {
    if (!newCollaborator || !currentUser) return;
    const eventRef = doc(db, 'events', eventId);
    const event = events.find((e) => e.id === eventId);
    if (event && event.organizerId === currentUser.uid && !event.organizers.includes(newCollaborator)) {
      await updateDoc(eventRef, {
        organizers: [...event.organizers, newCollaborator],
      });
      setNewCollaborator('');
      fetchEvents();
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return setError('Please log in to create an event.');
    setLoading(true);
    setError(null);
    try {
      let imageUrl = '';
      if (newEvent.image) {
        const storageRef = ref(storage, `events/${newEvent.image.name}-${Date.now()}`);
        await uploadBytes(storageRef, newEvent.image);
        imageUrl = await getDownloadURL(storageRef);
      }
      const eventData = {
        title: newEvent.title,
        date: newEvent.date,
        description: newEvent.description,
        category: newEvent.category,
        organizerId: currentUser.uid,
        organizers: [currentUser.uid],
        visibility: newEvent.visibility,
        inviteLink: `https://eventify.com/invite/${Date.now()}`,
        invitedUsers: [],
        pendingInvites: [],
        imageUrl,
      };
      const docRef = await addDoc(collection(db, 'events'), eventData);
      setNewEvent({ title: '', date: '', description: '', category: 'Refreshments', visibility: 'public', image: null });
      setShowCreateForm(false);
      setShowOptions(docRef.id);
      fetchEvents();
    } catch (err) {
      setError('Failed to create event.');
      console.error('Error creating event:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostMedia = async (eventId: string) => {
    if (!currentUser || !newPost[eventId]?.media) return setError('Please select a media file.');
    setLoading(true);
    setError(null);
    try {
      const event = events.find((e) => e.id === eventId);
      const visibility = event?.visibility === 'private' ? 'private' : newPost[eventId].visibility;
      const storageRef = ref(storage, `posts/${eventId}/${newPost[eventId].media.name}-${Date.now()}`);
      await uploadBytes(storageRef, newPost[eventId].media);
      const mediaUrl = await getDownloadURL(storageRef);
      const postData = {
        userId: currentUser.uid,
        mediaUrl,
        type: newPost[eventId].media.type.startsWith('video') ? 'video' : 'photo',
        visibility,
        likes: [],
        comments: [],
        createdAt: new Date().toISOString(),
      };
      await addDoc(firestoreCollection(db, 'events', eventId, 'posts'), postData);
      setNewPost((prev) => ({ ...prev, [eventId]: { media: null, visibility: 'public' } }));
      fetchEvents();
    } catch (err) {
      setError('Failed to post media.');
      console.error('Error posting media:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (eventId: string, postId: string) => {
    if (!currentUser) return;
    const postRef = doc(db, 'events', eventId, 'posts', postId);
    const post = posts[eventId]?.find((p) => p.id === postId);
    if (post) {
      const likes = post.likes.includes(currentUser.uid)
        ? post.likes.filter((id) => id !== currentUser.uid)
        : [...post.likes, currentUser.uid];
      await updateDoc(postRef, { likes });
      fetchEvents();
    }
  };

  const handleComment = async (eventId: string, postId: string, text: string) => {
    if (!currentUser || !text) return;
    const postRef = doc(db, 'events', eventId, 'posts', postId);
    const post = posts[eventId]?.find((p) => p.id === postId);
    if (post) {
      const comments = [...post.comments, { userId: currentUser.uid, text }];
      await updateDoc(postRef, { comments });
      fetchEvents();
    }
  };

  const handleOptionSelect = (category: string) => {
    navigate(`/business?category=${category}`);
    setShowOptions(null);
  };

  const getCategoryColor = (category: Event['category']) => {
    switch (category) {
      case 'Refreshments': return 'bg-refreshments-lightBlue';
      case 'Catering/Food': return 'bg-catering-orange';
      case 'Venue Provider': return 'bg-venue-green';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray">
      <section className="bg-primary-navy p-6">
        <div className="container mx-auto flex justify-between items-center">
          <motion.div initial="hidden" animate="visible" variants={headingFade}>
            <h1 className="text-4xl font-bold">Upcoming Events</h1>
            <p className="text-lg mt-2">Discover and join exciting events.</p>
          </motion.div>
          {currentUser && (
            <button
              className="bg-secondary-deepRed text-neutral-lightGray px-4 py-2 rounded hover:bg-secondary-darkRed"
              onClick={() => setShowCreateForm(true)}
            >
              Create Event
            </button>
          )}
        </div>
      </section>

      <section className="container mx-auto p-6">
        <motion.div className="relative mb-8 max-w-md mx-auto" initial="hidden" animate="visible" variants={fadeIn}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search events by title..."
            className="w-full p-3 pr-10 rounded bg-primary-navy text-neutral-lightGray border border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-accent-gold hover:text-secondary-deepRed"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </motion.div>

        <motion.p className="text-center text-neutral-lightGray mb-6" initial="hidden" animate="visible" variants={fadeIn}>
          {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'} found
        </motion.p>

        <div className="flex flex-wrap gap-4 mb-6">
          <button
            className={`px-4 py-2 rounded ${filter === null ? 'bg-secondary-deepRed' : 'bg-gray-500'} text-neutral-lightGray hover:bg-secondary-darkRed`}
            onClick={() => handleFilter(null)}
          >
            All
          </button>
          <button
            className={`px-4 py-2 rounded ${filter === 'Refreshments' ? 'bg-refreshments-lightBlue' : 'bg-gray-500'} text-neutral-darkGray hover:bg-refreshments-lightBlue`}
            onClick={() => handleFilter('Refreshments')}
          >
            Refreshments
          </button>
          <button
            className={`px-4 py-2 rounded ${filter === 'Catering/Food' ? 'bg-catering-orange' : 'bg-gray-500'} text-neutral-darkGray hover:bg-catering-orange`}
            onClick={() => handleFilter('Catering/Food')}
          >
            Catering/Food
          </button>
          <button
            className={`px-4 py-2 rounded ${filter === 'Venue Provider' ? 'bg-venue-green' : 'bg-gray-500'} text-neutral-darkGray hover:bg-venue-green`}
            onClick={() => handleFilter('Venue Provider')}
          >
            Venue Provider
          </button>
        </div>

        {loading && <p className="text-center">Loading events...</p>}
        {error && <p className="text-red-500 text-center">{error}</p>}
        {!loading && !error && (
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" initial="hidden" animate="visible" variants={stagger}>
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event) => (
                <motion.div key={event.id} className="bg-neutral-offWhite text-neutral-darkGray p-4 rounded shadow" variants={fadeIn}>
                  <div className={`${getCategoryColor(event.category)} h-2 rounded-t`}></div>
                  {event.imageUrl ? (
                    <img src={event.imageUrl} alt={event.title} className="w-full h-40 object-cover rounded-t mt-2" />
                  ) : (
                    <FaCalendarAlt className="w-full h-40 text-gray-400 mt-2" />
                  )}
                  <h3 className="text-xl font-semibold mt-2">{event.title}</h3>
                  <p className="text-sm text-accent-gold">{event.date}</p>
                  <p className="mt-2">{event.description}</p>
                  <p className="text-sm mt-1">
                    {event.visibility === 'public' ? 'Public Event' : 'Private Event'}
                  </p>

                  <div className="mt-4">
                    <label className="text-sm">Share Invite:</label>
                    <input
                      type="text"
                      value={event.inviteLink}
                      readOnly
                      className="w-full p-2 rounded bg-white text-neutral-darkGray mt-1"
                      aria-label="Event Invite Link"
                    />
                    <div className="mt-2 flex justify-center">
                      <CustomQRCode value={event.inviteLink} imageUrl={event.imageUrl} size={120} />
                    </div>
                  </div>

                  {currentUser && (event.organizers.includes(currentUser.uid) || event.invitedUsers.includes(currentUser.uid)) && (
                    <div className="mt-4">
                      <h4 className="text-lg font-semibold">Post Media</h4>
                      <label htmlFor={`media-${event.id}`} className="block text-sm mt-2">
                        Upload Photo or Video:
                      </label>
                      <input
                        id={`media-${event.id}`}
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) =>
                          setNewPost((prev) => ({
                            ...prev,
                            [event.id]: { ...prev[event.id], media: e.target.files?.[0] || null },
                          }))
                        }
                        className="w-full p-2"
                      />
                      {event.visibility === 'public' && (
                        <>
                          <label htmlFor={`visibility-${event.id}`} className="block text-sm mt-2">Visibility:</label>
                          <select
                            id={`visibility-${event.id}`}
                            value={newPost[event.id]?.visibility || 'public'}
                            onChange={(e) =>
                              setNewPost((prev) => ({
                                ...prev,
                                [event.id]: { ...prev[event.id], visibility: e.target.value as 'public' | 'private' },
                              }))
                            }
                            className="w-full p-2 rounded bg-white text-neutral-darkGray mt-2"
                          >
                            <option value="public">Public</option>
                            <option value="private">Private</option>
                          </select>
                        </>
                      )}
                      <button
                        className="mt-2 w-full bg-secondary-deepRed text-neutral-lightGray px-4 py-2 rounded hover:bg-secondary-darkRed"
                        onClick={() => handlePostMedia(event.id)}
                        disabled={loading || !newPost[event.id]?.media}
                      >
                        {loading ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  )}

                  {posts[event.id]?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-lg font-semibold">Event Posts</h4>
                      <div className="space-y-4 mt-2">
                        {posts[event.id].map((post) => (
                          <div key={post.id} className="bg-white p-3 rounded shadow-sm">
                            {post.type === 'photo' ? (
                              <img src={post.mediaUrl} alt="Event Post" className="w-full h-40 object-cover rounded" />
                            ) : (
                              <video src={post.mediaUrl} controls className="w-full h-40 rounded" />
                            )}
                            <div className="flex justify-between items-center mt-2">
                              <button
                                className="flex items-center space-x-1"
                                onClick={() => handleLike(event.id, post.id)}
                                aria-label={`Like post by ${post.userId}`}
                              >
                                <FaHeart
                                  className={post.likes.includes(currentUser?.uid || '') ? 'text-red-600' : 'text-gray-400'}
                                />
                                <span>{post.likes.length}</span>
                              </button>
                              <span className="flex items-center space-x-1">
                                <FaComment className="text-gray-400" />
                                <span>{post.comments.length}</span>
                              </span>
                            </div>
                            {post.comments.map((comment, idx) => (
                              <p key={idx} className="text-sm mt-1">
                                <strong>{comment.userId}:</strong> {comment.text}
                              </p>
                            ))}
                            <label htmlFor={`comment-${post.id}`} className="sr-only">
                              Add a comment
                            </label>
                            <input
                              id={`comment-${post.id}`}
                              type="text"
                              placeholder="Add a comment..."
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value) {
                                  handleComment(event.id, post.id, e.currentTarget.value);
                                  e.currentTarget.value = '';
                                }
                              }}
                              className="w-full p-1 mt-2 rounded bg-neutral-offWhite text-neutral-darkGray"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentUser && event.organizers.includes(currentUser.uid) ? (
                    <>
                      <button
                        className="mt-4 w-full bg-secondary-deepRed text-neutral-lightGray px-4 py-2 rounded hover:bg-secondary-darkRed"
                        disabled={true}
                      >
                        You’re an Organizer
                      </button>
                      {event.pendingInvites.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm">Pending Invites:</p>
                          {event.pendingInvites.map((userId) => (
                            <div key={userId} className="flex justify-between items-center mt-1">
                              <span>{userId}</span>
                              <button
                                className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                                onClick={() => approveInvite(event.id, userId)}
                              >
                                Approve
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-4">
                        <label htmlFor={`collaborator-${event.id}`} className="block text-sm">
                          Collaborator UID:
                        </label>
                        <input
                          id={`collaborator-${event.id}`}
                          type="text"
                          value={newCollaborator}
                          onChange={(e) => setNewCollaborator(e.target.value)}
                          placeholder="Enter UID"
                          className="w-full p-2 rounded bg-white text-neutral-darkGray"
                        />
                        <button
                          className="mt-2 w-full bg-secondary-deepRed text-neutral-lightGray px-4 py-2 rounded hover:bg-secondary-darkRed"
                          onClick={() => addCollaborator(event.id)}
                        >
                          Add Collaborator
                        </button>
                      </div>
                    </>
                  ) : currentUser && event.invitedUsers.includes(currentUser.uid) ? (
                    <button
                      className="mt-4 w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                      disabled={true}
                    >
                      You’re Invited
                    </button>
                  ) : (
                    <button
                      className="mt-4 w-full bg-secondary-deepRed text-neutral-lightGray px-4 py-2 rounded hover:bg-secondary-darkRed"
                      onClick={() => requestInvite(event.id)}
                      disabled={currentUser ? event.pendingInvites.includes(currentUser.uid) : false}
                    >
                      {currentUser && event.pendingInvites.includes(currentUser.uid) ? 'Invite Requested' : 'Request Invite'}
                    </button>
                  )}
                </motion.div>
              ))
            ) : (
              <motion.p className="text-center col-span-full" variants={fadeIn}>
                No events found.
              </motion.p>
            )}
          </motion.div>
        )}
      </section>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-neutral-offWhite text-neutral-darkGray p-6 rounded shadow-lg max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create New Event</h2>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <label htmlFor="title" className="block text-sm">Event Title:</label>
              <input
                id="title"
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Enter title"
                className="w-full p-2 rounded bg-white text-neutral-darkGray"
                required
              />
              <label htmlFor="date" className="block text-sm">Date:</label>
              <input
                id="date"
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                className="w-full p-2 rounded bg-white text-neutral-darkGray"
                required
              />
              <label htmlFor="description" className="block text-sm">Description:</label>
              <textarea
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Enter description"
                className="w-full p-2 rounded bg-white text-neutral-darkGray"
                rows={3}
              />
              <label htmlFor="category" className="block text-sm">Category:</label>
              <select
                id="category"
                value={newEvent.category}
                onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as Event['category'] })}
                className="w-full p-2 rounded bg-white text-neutral-darkGray"
              >
                <option value="Refreshments">Refreshments</option>
                <option value="Catering/Food">Catering/Food</option>
                <option value="Venue Provider">Venue Provider</option>
              </select>
              <label htmlFor="visibility" className="block text-sm">Visibility:</label>
              <select
                id="visibility"
                value={newEvent.visibility}
                onChange={(e) => setNewEvent({ ...newEvent, visibility: e.target.value as 'public' | 'private' })}
                className="w-full p-2 rounded bg-white text-neutral-darkGray"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              <label htmlFor="image" className="block text-sm">Event Image:</label>
              <input
                id="image"
                type="file"
                accept="image/*"
                onChange={(e) => setNewEvent({ ...newEvent, image: e.target.files?.[0] || null })}
                className="w-full p-2"
              />
              <button
                type="submit"
                className="w-full bg-secondary-deepRed text-neutral-lightGray p-2 rounded hover:bg-secondary-darkRed"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Event'}
              </button>
              <button
                type="button"
                className="w-full bg-gray-500 text-neutral-lightGray p-2 rounded hover:bg-gray-600"
                onClick={() => setShowCreateForm(false)}
                disabled={loading}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {showOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-neutral-offWhite text-neutral-darkGray p-6 rounded shadow-lg max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Event Created!</h2>
            <p className="mb-4">What would you like to do next?</p>
            <div className="space-y-4">
              <button
                className="w-full bg-refreshments-lightBlue text-neutral-darkGray p-2 rounded hover:bg-refreshments-lightBlue/80"
                onClick={() => handleOptionSelect('Refreshments')}
              >
                Add Refreshments
              </button>
              <button
                className="w-full bg-catering-orange text-neutral-darkGray p-2 rounded hover:bg-catering-orange/80"
                onClick={() => handleOptionSelect('Catering/Food')}
              >
                Order Food
              </button>
              <button
                className="w-full bg-venue-green text-neutral-darkGray p-2 rounded hover:bg-venue-green/80"
                onClick={() => handleOptionSelect('Venue Provider')}
              >
                Book a Venue
              </button>
              <button
                className="w-full bg-gray-500 text-neutral-lightGray p-2 rounded hover:bg-gray-600"
                onClick={() => setShowOptions(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Events;