import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  startAfter,
  Timestamp,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { EventData, NormalizedEventData, RawComment, Comment, NormalizedComment } from '../types';
import { normalizeEventData, normalizeComment } from '../utils/normalizeEvent';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiShare2, FiEdit, FiTrash2, FiSend, FiMoreHorizontal } from 'react-icons/fi';
import { FaComments } from 'react-icons/fa';

function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const { currentUser, isModerator } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<NormalizedEventData | null>(null);
  const [creatorName, setCreatorName] = useState('');
  const [hasAccess, setHasAccess] = useState(false);
  const [canComment, setCanComment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<NormalizedComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const commentsPerPage = 5;
  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  // Fetch event data and check access
  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      toast.error('Event ID is missing.');
      return;
    }

    setLoading(true);
    const eventRef = doc(db, 'events', eventId);
    const unsubscribeEvent = onSnapshot(
      eventRef,
      (eventDoc) => {
        if (eventDoc.exists()) {
          const eventData = { id: eventDoc.id, ...eventDoc.data() } as EventData;
          const normalizedEvent = normalizeEventData(eventData);
          setEvent(normalizedEvent);
          setFormData({
            title: normalizedEvent.title,
            date: new Date(normalizedEvent.date).toISOString().split('T')[0],
            location: normalizedEvent.location || '',
          });
          setCreatorName(eventData.creatorName || 'Unknown User');

          // Check if the user has access to the event
          if (currentUser) {
            const userHasAccess =
              eventData.organizers?.includes(currentUser.uid) ||
              eventData.invitedUsers?.includes(currentUser.uid);
            setHasAccess(userHasAccess);

            // Determine if the user can comment
            const canUserComment =
              eventData.visibility === 'public' || // Public events: any authenticated user can comment
              userHasAccess; // Private events: only organizers or invited users can comment
            setCanComment(canUserComment);
          } else {
            setHasAccess(false);
            setCanComment(false);
          }
        } else {
          toast.error('Event not found.');
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching event:', error);
        toast.error('Failed to load event.');
        setLoading(false);
      }
    );

    return () => unsubscribeEvent();
  }, [eventId, currentUser]);

  // Fetch comments with pagination
  useEffect(() => {
    if (!eventId) return;

    const commentsRef = collection(db, 'events', eventId, 'comments');
    const initialQuery = query(commentsRef, orderBy('createdAt', 'desc'), limit(commentsPerPage));

    const unsubscribeComments = onSnapshot(
      initialQuery,
      (snapshot) => {
        const commentData = snapshot.docs.map((doc) => {
          const data = doc.data() as RawComment;
          return normalizeComment({
            id: doc.id,
            ...data,
          });
        });
        setComments(commentData);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === commentsPerPage);
      },
      (error) => {
        console.error('Error fetching comments:', error);
        toast.error('Failed to load comments.');
      }
    );

    return () => unsubscribeComments();
  }, [eventId]);

  // Load more comments
  const loadMoreComments = useCallback(async () => {
    if (!eventId || !lastVisible || !hasMore || loadingMore) return;

    setLoadingMore(true);
    const commentsRef = collection(db, 'events', eventId, 'comments');
    const nextQuery = query(commentsRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(commentsPerPage));

    try {
      const snapshot = await new Promise<any>((resolve) => {
        const unsubscribe = onSnapshot(nextQuery, (snap) => {
          resolve(snap);
          unsubscribe();
        });
      });

      const newComments = snapshot.docs.map((doc: any) => {
        const data = doc.data() as RawComment;
        return normalizeComment({
          id: doc.id,
          ...data,
        });
      });

      setComments((prev) => [...prev, ...newComments]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(newComments.length === commentsPerPage);
    } catch (error) {
      console.error('Error loading more comments:', error);
      toast.error('Failed to load more comments.');
    } finally {
      setLoadingMore(false);
    }
  }, [eventId, lastVisible, hasMore, loadingMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMoreComments();
      }
    });

    if (loadMoreRef.current) observer.current.observe(loadMoreRef.current);

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [loadMoreComments, hasMore, loadingMore]);

  const [formData, setFormData] = useState({ title: '', date: '', location: '' });

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !currentUser || currentUser.uid !== event?.userId) return;

    setSubmitting(true);
    try {
      const eventDate = new Date(formData.date);
      await updateDoc(doc(db, 'events', eventId), {
        title: formData.title,
        date: Timestamp.fromDate(eventDate),
        location: formData.location,
      });
      setEvent((prev: NormalizedEventData | null) =>
        prev
          ? {
              ...prev,
              title: formData.title,
              date: eventDate.toISOString(),
              location: formData.location,
            }
          : null
      );
      setEditing(false);
      toast.success('Event updated successfully!');
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!eventId || !currentUser || currentUser.uid !== event?.userId) return;

    if (window.confirm('Are you sure you want to delete this event?')) {
      setSubmitting(true);
      try {
        await deleteDoc(doc(db, 'events', eventId));
        toast.success('Event deleted successfully!');
        navigate('/');
      } catch (error) {
        console.error('Error deleting event:', error);
        toast.error('Failed to delete event.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/events/${eventId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.title,
          text: `Check out this event: ${event?.title}`,
          url: shareUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Event URL copied to clipboard!');
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('Please log in to comment.');
      return;
    }
    if (!newComment.trim()) {
      toast.error('Comment cannot be empty.');
      return;
    }
    if (!eventId) {
      toast.error('Event ID is missing.');
      return;
    }

    setCommentSubmitting(true);
    try {
      const commentsRef = collection(db, 'events', eventId, 'comments');
      await addDoc(commentsRef, {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous',
        content: newComment.trim(),
        createdAt: Timestamp.now(),
        eventId: eventId,
      });
      setNewComment('');
      toast.success('Comment added successfully!');
    } catch (error: any) {
      console.error('Error adding comment:', error);
      if (error.code === 'permission-denied') {
        toast.error('You do not have permission to comment on this event.');
      } else {
        toast.error('Failed to add comment: ' + error.message);
      }
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser) {
      toast.error('Please log in to delete comments.');
      return;
    }
    if (!eventId) {
      toast.error('Event ID is missing.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        await deleteDoc(doc(db, 'events', eventId, 'comments', commentId));
        toast.success('Comment deleted successfully!');
      } catch (error) {
        console.error('Error deleting comment:', error);
        toast.error('Failed to delete comment.');
      }
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!currentUser) {
      toast.error('Please log in to edit comments.');
      return;
    }
    if (!editingCommentContent.trim()) {
      toast.error('Comment cannot be empty.');
      return;
    }
    if (!eventId) {
      toast.error('Event ID is missing.');
      return;
    }

    try {
      await updateDoc(doc(db, 'events', eventId, 'comments', commentId), {
        content: editingCommentContent.trim(),
      });
      setEditingCommentId(null);
      setEditingCommentContent('');
      toast.success('Comment updated successfully!');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Failed to update comment.');
    }
  };

  const handleReportComment = async (commentId: string) => {
    if (!currentUser) {
      toast.error('Please log in to report comments.');
      return;
    }
    if (!reportReason.trim()) {
      toast.error('Please provide a reason for reporting.');
      return;
    }
    if (!eventId) {
      toast.error('Event ID is missing.');
      return;
    }

    try {
      const reportsRef = collection(db, 'events', eventId, 'comments', commentId, 'reports');
      await addDoc(reportsRef, {
        userId: currentUser.uid,
        reason: reportReason.trim(),
        createdAt: Timestamp.now(),
      });
      setReportingCommentId(null);
      setReportReason('');
      toast.success('Comment reported successfully!');
    } catch (error) {
      console.error('Error reporting comment:', error);
      toast.error('Failed to report comment.');
    }
  };

  const canDeleteComment = (comment: NormalizedComment) =>
    currentUser &&
    (currentUser.uid === comment.userId || event?.organizers?.includes(currentUser.uid) || isModerator);

  const canEditComment = (comment: NormalizedComment) => currentUser && currentUser.uid === comment.userId;

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
          <span className="text-neutral-lightGray text-base font-medium">Loading Event...</span>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center flex-col">
        <p className="text-red-500 text-sm">Event not found.</p>
        <motion.button
          onClick={() => navigate('/events')}
          className="mt-4 bg-accent-gold text-neutral-darkGray font-semibold rounded-full px-5 py-2 hover:bg-yellow-300 transition-all shadow-lg text-sm"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Back to Events
        </motion.button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray relative overflow-hidden">
      {/* Subtle Animated Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-accent-gold/10 to-transparent animate-pulse-slow" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-neutral-darkGray/50" />
      </div>

      {/* Back Button */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 relative z-10">
        <motion.button
          onClick={() => navigate(-1)}
          className="flex items-center text-accent-gold hover:text-yellow-300 transition-colors text-sm font-medium"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiArrowLeft className="w-5 h-5 mr-2" />
          Back to Events
        </motion.button>
      </div>

      {/* Event Details Section */}
      <motion.section
        className="max-w-5xl mx-auto px-4 sm:px-6 py-6 relative z-10"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <div className="bg-neutral-mediumGray/80 backdrop-blur-lg rounded-2xl overflow-hidden shadow-2xl border border-neutral-mediumGray/50">
          {/* Event Image with Overlay */}
          <div className="relative w-full h-64 sm:h-80 md:h-96">
            <img
              src={event.image || 'https://via.placeholder.com/600x300?text=Event'}
              alt={event.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/600x300?text=Event+Image+Not+Found')}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-darkGray/80 to-transparent flex flex-col justify-end p-4 sm:p-6">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-lg leading-tight">
                {event.title}
              </h1>
              <p className="text-sm sm:text-lg text-neutral-lightGray mt-2 drop-shadow-md">
                {event.location ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-gold hover:underline"
                  >
                    {event.location}
                  </a>
                ) : (
                  'Location TBD'
                )}
              </p>
            </div>
          </div>

          {/* Event Details */}
          <div className="p-4 sm:p-6 md:p-8">
            {editing ? (
              <form onSubmit={handleEdit} className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-neutral-lightGray">
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full mt-2 p-3 bg-neutral-mediumGray text-white rounded-lg border border-neutral-lightGray/50 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm placeholder-neutral-lightGray/70"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-neutral-lightGray">
                    Date
                  </label>
                  <input
                    id="date"
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full mt-2 p-3 bg-neutral-mediumGray text-white rounded-lg border border-neutral-lightGray/50 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm placeholder-neutral-lightGray/70"
                  />
                </div>
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-neutral-lightGray">
                    Location
                  </label>
                  <input
                    id="location"
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="w-full mt-2 p-3 bg-neutral-mediumGray text-white rounded-lg border border-neutral-lightGray/50 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm placeholder-neutral-lightGray/70"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
                  <motion.button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="w-full sm:w-auto px-6 py-2.5 bg-neutral-mediumGray text-neutral-lightGray rounded-lg hover:bg-neutral-mediumGray/80 transition-all text-sm font-medium"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={submitting}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 bg-accent-gold text-neutral-darkGray rounded-lg hover:bg-yellow-300 transition-all text-sm font-medium"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </motion.button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-neutral-lightGray">
                      <strong className="text-accent-gold">Date:</strong>{' '}
                      {new Date(event.date).toLocaleString()}
                    </p>
                    <p className="text-sm text-neutral-lightGray mt-2">
                      <strong className="text-accent-gold">Created by:</strong> {creatorName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-lightGray">
                      <strong className="text-accent-gold">Visibility:</strong> {event.visibility}
                    </p>
                    <p className="text-sm text-neutral-lightGray mt-2">
                      <strong className="text-accent-gold">Category:</strong> {event.category || 'General'}
                    </p>
                  </div>
                </div>
                {event.description && (
                  <div>
                    <h2 className="text-lg font-semibold text-accent-gold">Description</h2>
                    <p className="text-sm text-neutral-lightGray mt-2">{event.description}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 pt-4">
                  <motion.button
                    onClick={handleShare}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-all text-sm font-medium"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FiShare2 className="w-4 h-4 mr-2" />
                    Share
                  </motion.button>
                  {currentUser && hasAccess && (
                    <Link
                      to={`/chat/${eventId}`}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-all text-sm font-medium"
                      onClick={() => console.log('Navigating to chat for event:', eventId)}
                    >
                      <FaComments className="w-4 h-4 mr-2" />
                      Join Chat
                    </Link>
                  )}
                  {currentUser?.uid === event.userId && (
                    <>
                      <motion.button
                        onClick={() => setEditing(true)}
                        className="flex items-center px-4 py-2 bg-accent-gold text-neutral-darkGray rounded-full hover:bg-yellow-300 transition-all text-sm font-medium"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={submitting}
                      >
                        <FiEdit className="w-4 h-4 mr-2" />
                        Edit
                      </motion.button>
                      <motion.button
                        onClick={handleDelete}
                        className="flex items-center px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-400 transition-all text-sm font-medium"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={submitting}
                      >
                        <FiTrash2 className="w-4 h-4 mr-2" />
                        {submitting ? 'Deleting...' : 'Delete'}
                      </motion.button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* Comment Section */}
      <motion.section
        className="max-w-5xl mx-auto px-4 sm:px-6 py-6 relative z-10"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <div className="bg-neutral-mediumGray/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 shadow-2xl border border-neutral-mediumGray/50">
          <h2 className="text-xl sm:text-2xl font-bold text-accent-gold mb-6">Comments</h2>
          {currentUser ? (
            canComment ? (
              <form onSubmit={handleCommentSubmit} className="mb-6">
                <label htmlFor="new-comment" className="block text-sm font-medium text-neutral-lightGray mb-2">
                  Add a Comment
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <textarea
                    id="new-comment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 p-3 bg-neutral-mediumGray text-black rounded-lg border border-neutral-lightGray/50 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm resize-none min-h-[80px] placeholder-neutral-lightGray/70"
                    required
                    aria-label="Add a comment"
                  />
                  <motion.button
                    type="submit"
                    className="px-4 py-2 bg-accent-gold text-neutral-darkGray rounded-full hover:bg-yellow-300 transition-all text-sm font-medium flex items-center"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={commentSubmitting}
                  >
                    <FiSend className="w-4 h-4 mr-2" />
                    {commentSubmitting ? 'Posting...' : 'Post'}
                  </motion.button>
                </div>
              </form>
            ) : (
              <p className="text-neutral-lightGray text-sm mb-6">
                You do not have permission to comment on this event.
              </p>
            )
          ) : (
            <p className="text-neutral-lightGray text-sm mb-6">
              Please <a href="/login" className="text-accent-gold hover:underline">log in</a> to add a comment.
            </p>
          )}
          {comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => (
                <motion.div
                  key={comment.id}
                  className="bg-neutral-darkGray/50 p-4 rounded-lg shadow-sm border border-neutral-mediumGray/50"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-mediumGray flex items-center justify-center text-neutral-lightGray font-semibold text-sm">
                      {comment.userName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-semibold text-accent-gold">{comment.userName}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-neutral-lightGray">
                            {new Date(comment.createdAt).toLocaleString()}
                          </p>
                          {currentUser && (
                            <div className="relative group">
                              <FiMoreHorizontal className="w-5 h-5 text-neutral-lightGray cursor-pointer" />
                              <div className="absolute right-0 mt-2 w-40 bg-neutral-mediumGray rounded-lg shadow-lg border border-neutral-mediumGray/50 hidden group-hover:block z-20">
                                <div className="py-2">
                                  {canEditComment(comment) && (
                                    <button
                                      onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setEditingCommentContent(comment.content);
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-neutral-lightGray hover:bg-neutral-mediumGray/80"
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {canDeleteComment(comment) && (
                                    <button
                                      onClick={() => handleDeleteComment(comment.id)}
                                      className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-neutral-mediumGray/80"
                                    >
                                      Delete
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setReportingCommentId(comment.id)}
                                    className="block w-full text-left px-4 py-2 text-sm text-neutral-lightGray hover:bg-neutral-mediumGray/80"
                                  >
                                    Report
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {editingCommentId === comment.id ? (
                        <div className="mt-3">
                          <textarea
                            value={editingCommentContent}
                            onChange={(e) => setEditingCommentContent(e.target.value)}
                            className="w-full p-3 bg-neutral-mediumGray text-black rounded-lg border border-neutral-lightGray/50 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm resize-none min-h-[80px] placeholder-neutral-lightGray/70"
                            required
                            aria-label="Edit comment"
                          />
                          <div className="flex gap-3 mt-3">
                            <motion.button
                              onClick={() => setEditingCommentId(null)}
                              className="px-4 py-2 bg-neutral-mediumGray text-neutral-lightGray rounded-full hover:bg-neutral-mediumGray/80 transition-all text-sm font-medium"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              Cancel
                            </motion.button>
                            <motion.button
                              onClick={() => handleEditComment(comment.id)}
                              className="px-4 py-2 bg-accent-gold text-neutral-darkGray rounded-full hover:bg-yellow-300 transition-all text-sm font-medium"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              Save
                            </motion.button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-lightGray">{comment.content}</p>
                      )}
                      {reportingCommentId === comment.id && (
                        <div className="mt-3">
                          <label htmlFor={`report-reason-${comment.id}`} className="block text-sm font-medium text-neutral-lightGray mb-2">
                            Reason for Reporting
                          </label>
                          <textarea
                            id={`report-reason-${comment.id}`}
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder="Reason for reporting..."
                            className="w-full p-3 bg-neutral-mediumGray text-black rounded-lg border border-neutral-lightGray/50 focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm resize-none min-h-[80px] placeholder-neutral-lightGray/70"
                            required
                            aria-label="Reason for reporting comment"
                          />
                          <div className="flex gap-3 mt-3">
                            <motion.button
                              onClick={() => setReportingCommentId(null)}
                              className="px-4 py-2 bg-neutral-mediumGray text-neutral-lightGray rounded-full hover:bg-neutral-mediumGray/80 transition-all text-sm font-medium"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              Cancel
                            </motion.button>
                            <motion.button
                              onClick={() => handleReportComment(comment.id)}
                              className="px-4 py-2 bg-accent-gold text-neutral-darkGray rounded-full hover:bg-yellow-300 transition-all text-sm font-medium"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              Submit Report
                            </motion.button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              {hasMore && (
                <div ref={loadMoreRef} className="text-center mt-6">
                  {loadingMore ? (
                    <p className="text-neutral-lightGray text-sm">Loading more comments...</p>
                  ) : (
                    <motion.button
                      onClick={loadMoreComments}
                      className="px-6 py-2 bg-accent-gold text-neutral-darkGray rounded-full hover:bg-yellow-300 transition-all text-sm font-medium"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Load More
                    </motion.button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-neutral-lightGray text-sm">No comments yet. Be the first to comment!</p>
          )}
        </div>
      </motion.section>

      {/* Floating Action Button for Mobile */}
      {currentUser && canComment && (
        <motion.div
          className="fixed bottom-6 right-6 z-20 sm:hidden"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.button
            onClick={() => document.getElementById('new-comment')?.focus()}
            className="w-14 h-14 bg-accent-gold text-neutral-darkGray rounded-full flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Add a comment"
          >
            <FiSend className="w-6 h-6" />
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

export default EventDetail;