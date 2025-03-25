// src/pages/Feed.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  db,
  getUserData,
  onSnapshot,
  query,
  collection,
  orderBy,
  limit,
  startAfter,
  QuerySnapshot,
  DocumentData,
  QueryDocumentSnapshot,
} from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FaHeart, FaComment, FaTimes, FaArrowUp } from 'react-icons/fa';
import defaultEventImage from '../assets/default-event.jpg';

// Constants
const POSTS_PER_PAGE = 10;

// Interfaces
interface Comment {
  userId: string;
  text: string;
}

interface PostData {
  id: string;
  eventId: string;
  eventTitle?: string;
  mediaUrl: string;
  type: 'photo' | 'video';
  userId: string;
  createdAt: string;
  likes: string[];
  comments: Comment[];
  description?: string;
}

interface UserData {
  displayName: string;
  photoURL?: string;
}

// PostCard Component
const PostCard = ({
  post,
  currentUser,
  usersData,
  handleLike,
  handleComment,
  openMediaModal,
}: {
  post: PostData;
  currentUser: any;
  usersData: { [key: string]: UserData };
  handleLike: (eventId: string, postId: string) => Promise<void>;
  handleComment: (eventId: string, postId: string, text: string) => Promise<void>;
  openMediaModal: (mediaUrl: string, type: 'photo' | 'video') => void;
}) => {
  const [commentText, setCommentText] = useState('');
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const user = usersData[post.userId] || { displayName: 'Anonymous', photoURL: undefined };

  const onSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || commentText.length > 200) {
      toast.error('Comment must be between 1 and 200 characters.');
      return;
    }
    setIsCommenting(true);
    try {
      await handleComment(post.eventId, post.id, commentText);
      setCommentText('');
      toast.success('Comment added successfully!');
    } catch (err) {
      toast.error('Failed to add comment.');
    } finally {
      setIsCommenting(false);
    }
  };

  return (
    <motion.div
      className="bg-neutral-mediumGray/50 backdrop-blur-lg rounded-lg shadow-md border border-neutral-mediumGray/50 overflow-hidden"
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative w-full h-48 sm:h-64">
        {post.type === 'photo' ? (
          <img
            src={post.mediaUrl}
            alt={`${post.eventTitle || 'Event'} post`}
            className="w-full h-full object-cover cursor-pointer"
            loading="lazy"
            onError={(e) => (e.currentTarget.src = defaultEventImage)}
            onClick={() => openMediaModal(post.mediaUrl, post.type)}
          />
        ) : (
          <video
            src={post.mediaUrl}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => openMediaModal(post.mediaUrl, post.type)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-3">
          <h3 className="text-sm sm:text-base font-semibold text-accent-gold line-clamp-1">
            {post.eventTitle || 'Unknown Event'}
          </h3>
          <p className="text-xs text-neutral-lightGray">
            Posted by {user.displayName} on {new Date(post.createdAt).toLocaleDateString()}
          </p>
          {post.description && (
            <p className="text-xs text-neutral-lightGray mt-1 line-clamp-2">{post.description}</p>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <motion.button
            onClick={async () => {
              setIsLiking(true);
              await handleLike(post.eventId, post.id);
              setIsLiking(false);
            }}
            className="flex items-center space-x-1 text-sm disabled:opacity-50"
            disabled={!currentUser || isLiking}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label={currentUser && post.likes.includes(currentUser.uid) ? 'Unlike post' : 'Like post'}
          >
            <FaHeart
              className={
                currentUser && post.likes.includes(currentUser.uid) ? 'text-red-600' : 'text-neutral-lightGray'
              }
            />
            <span>{post.likes.length}</span>
          </motion.button>
          <span className="flex items-center space-x-1 text-sm text-neutral-lightGray">
            <FaComment />
            <span>{post.comments.length}</span>
          </span>
        </div>
        {post.comments.length > 0 && (
          <div className="max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-mediumGray scrollbar-track-neutral-darkGray mb-2">
            {post.comments.map((comment, idx) => (
              <p key={idx} className="text-xs text-neutral-lightGray">
                <strong>{usersData[comment.userId]?.displayName || comment.userId}:</strong> {comment.text}
              </p>
            ))}
          </div>
        )}
        {currentUser ? (
          <form onSubmit={onSubmitComment} className="flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 p-2 rounded-lg bg-neutral-mediumGray text-neutral-lightGray border border-neutral-mediumGray focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm"
              maxLength={200}
              disabled={isCommenting}
              aria-label="Add a comment"
            />
            <motion.button
              type="submit"
              className="p-2 bg-accent-gold text-neutral-darkGray rounded-full hover:bg-yellow-300 transition-all disabled:opacity-50"
              disabled={isCommenting || !commentText.trim()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Submit comment"
            >
              {isCommenting ? (
                <svg className="animate-spin h-5 w-5 text-neutral-darkGray" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    className="opacity-75"
                  />
                </svg>
              ) : (
                <FaComment size={16} />
              )}
            </motion.button>
          </form>
        ) : (
          <p className="text-sm text-neutral-lightGray">Log in to comment.</p>
        )}
      </div>
    </motion.div>
  );
};

// MediaModal Component
const MediaModal = ({
  mediaUrl,
  type,
  onClose,
}: {
  mediaUrl: string;
  type: 'photo' | 'video';
  onClose: () => void;
}) => {
  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClose}
    >
      <motion.div
        className="relative max-w-4xl w-full h-[80vh] rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-lightGray hover:text-accent-gold transition-colors z-10"
          whileHover={{ scale: 1.2, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Close media modal"
        >
          <FaTimes size={24} />
        </motion.button>
        {type === 'photo' ? (
          <img
            src={mediaUrl}
            alt="Full-screen post media"
            className="w-full h-full object-contain"
            onError={(e) => (e.currentTarget.src = defaultEventImage)}
          />
        ) : (
          <video src={mediaUrl} controls className="w-full h-full object-contain" />
        )}
      </motion.div>
    </motion.div>
  );
};

// Main Feed Component
function Feed() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'popularity'>('date');
  const [filterEvent, setFilterEvent] = useState<string>('');
  const [usersData, setUsersData] = useState<{ [key: string]: UserData }>({});
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'photo' | 'video' } | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Animation variants
  const stagger = {
    visible: { transition: { staggerChildren: 0.1 } },
  };

  const headingFade = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut', type: 'spring', bounce: 0.2 },
    },
  };

  // Fetch posts with pagination and real-time updates
  useEffect(() => {
    if (!db) return;

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'posts'),
      orderBy(sortBy === 'date' ? 'createdAt' : 'likes.length', 'desc'),
      limit(POSTS_PER_PAGE)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot: QuerySnapshot<DocumentData>) => {
        const newPosts: PostData[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PostData[];

        // Fetch user data for post authors and commenters
        const userIds = [
          ...new Set([
            ...newPosts.map((post) => post.userId),
            ...newPosts.flatMap((post) => post.comments.map((comment) => comment.userId)),
          ]),
        ].filter((userId) => !usersData[userId]);

        if (userIds.length > 0) {
          const userPromises = userIds.map(async (userId) => {
            const userDoc = await getUserData(userId);
            return { userId, userDoc };
          });
          const userResults = await Promise.all(userPromises);
          const newUsersData = userResults.reduce((acc, { userId, userDoc }) => {
            if (userDoc) {
              acc[userId] = {
                displayName: userDoc.displayName || 'Anonymous',
                photoURL: userDoc.photoURL || undefined,
              };
            }
            return acc;
          }, {} as { [key: string]: UserData });

          setUsersData((prev) => ({ ...prev, ...newUsersData }));
        }

        setPosts(newPosts);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === POSTS_PER_PAGE);
        setLoading(false);
      },
      (err) => {
        setError(`Failed to load feed: ${err.message}`);
        toast.error('Failed to load feed.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sortBy, usersData]);

  // Load more posts
  const loadMorePosts = useCallback(async () => {
    if (!hasMore || loadingMore || !lastVisible) return;

    setLoadingMore(true);
    const q = query(
      collection(db, 'posts'),
      orderBy(sortBy === 'date' ? 'createdAt' : 'likes.length', 'desc'),
      startAfter(lastVisible),
      limit(POSTS_PER_PAGE)
    );

    try {
      const snapshot = await new Promise<QuerySnapshot<DocumentData>>((resolve) => {
        const unsubscribe = onSnapshot(
          q,
          (snap) => {
            resolve(snap);
            unsubscribe();
          },
          (err) => {
            throw err;
          }
        );
      });

      const newPosts: PostData[] = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...doc.data(),
      })) as PostData[];

      const userIds = [
        ...new Set([
          ...newPosts.map((post) => post.userId),
          ...newPosts.flatMap((post) => post.comments.map((comment) => comment.userId)),
        ]),
      ].filter((userId) => !usersData[userId]);

      if (userIds.length > 0) {
        const userPromises = userIds.map(async (userId) => {
          const userDoc = await getUserData(userId);
          return { userId, userDoc };
        });
        const userResults = await Promise.all(userPromises);
        const newUsersData = userResults.reduce((acc, { userId, userDoc }) => {
          if (userDoc) {
            acc[userId] = {
              displayName: userDoc.displayName || 'Anonymous',
              photoURL: userDoc.photoURL || undefined,
            };
          }
          return acc;
        }, {} as { [key: string]: UserData });

        setUsersData((prev) => ({ ...prev, ...newUsersData }));
      }

      setPosts((prev) => [...prev, ...newPosts]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(newPosts.length === POSTS_PER_PAGE);
    } catch (err) {
      toast.error('Failed to load more posts.');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastVisible, sortBy, usersData]);

  // Handle scroll for "Back to Top" button
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setShowScrollToTop(containerRef.current.scrollTop > 300);
      }
    };

    containerRef.current?.addEventListener('scroll', handleScroll);
    return () => containerRef.current?.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle like
  const handleLike = useCallback(
    async (eventId: string, postId: string) => {
      if (!currentUser) {
        toast.error('Please log in to like posts.');
        return;
      }
      try {
        const postRef = doc(db, 'events', eventId, 'posts', postId);
        const post = posts.find((p) => p.id === postId && p.eventId === eventId);
        if (post) {
          const likes = post.likes.includes(currentUser.uid)
            ? post.likes.filter((id) => id !== currentUser.uid)
            : [...post.likes, currentUser.uid];
          await updateDoc(postRef, { likes });
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId && p.eventId === eventId ? { ...p, likes } : p
            )
          );
        }
      } catch (err: any) {
        toast.error('Failed to update like: ' + err.message);
      }
    },
    [currentUser, posts]
  );

  // Handle comment
  const handleComment = useCallback(
    async (eventId: string, postId: string, text: string) => {
      if (!currentUser || !text.trim()) {
        toast.error('Please log in and enter a comment.');
        return;
      }
      try {
        const postRef = doc(db, 'events', eventId, 'posts', postId);
        const post = posts.find((p) => p.id === postId && p.eventId === eventId);
        if (post) {
          const comments = [...post.comments, { userId: currentUser.uid, text }];
          await updateDoc(postRef, { comments });
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId && p.eventId === eventId ? { ...p, comments } : p
            )
          );
        }
      } catch (err: any) {
        toast.error('Failed to add comment: ' + err.message);
      }
    },
    [currentUser, posts]
  );

  // Memoized filtered posts
  const filteredPosts = useMemo(() => {
    return filterEvent
      ? posts.filter((post) => post.eventTitle?.toLowerCase().includes(filterEvent.toLowerCase()))
      : posts;
  }, [posts, filterEvent]);

  // Unique events for filter dropdown
  const uniqueEvents = useMemo(() => {
    return [...new Set(posts.map((post) => post.eventTitle || 'Unknown Event'))];
  }, [posts]);

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
          <span className="text-neutral-lightGray text-base sm:text-lg font-medium">Loading Feed...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray py-8 px-4 sm:px-6">
      <motion.h1
        className="text-xl sm:text-3xl font-bold text-accent-gold text-center mb-6 sm:mb-8"
        initial="hidden"
        animate="visible"
        variants={headingFade}
      >
        Event Feed
      </motion.h1>
      {error && (
        <motion.p
          className="text-red-500 text-center mb-4 text-sm sm:text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
      )}
      <div className="max-w-6xl mx-auto mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date' | 'popularity')}
          className="p-2 sm:p-3 rounded-lg bg-neutral-mediumGray text-neutral-lightGray border border-neutral-mediumGray focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base"
          aria-label="Sort posts by"
        >
          <option value="date">Sort by Date</option>
          <option value="popularity">Sort by Popularity</option>
        </select>
        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="p-2 sm:p-3 rounded-lg bg-neutral-mediumGray text-neutral-lightGray border border-neutral-mediumGray focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base"
          aria-label="Filter posts by event"
        >
          <option value="">All Events</option>
          {uniqueEvents.map((event) => (
            <option key={event} value={event}>
              {event}
            </option>
          ))}
        </select>
      </div>
      <motion.div
        ref={containerRef}
        className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-mediumGray scrollbar-track-neutral-darkGray"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => (
            <PostCard
              key={`${post.eventId}-${post.id}`}
              post={post}
              currentUser={currentUser}
              usersData={usersData}
              handleLike={handleLike}
              handleComment={handleComment}
              openMediaModal={(url, type) => setSelectedMedia({ url, type })}
            />
          ))
        ) : (
          <p className="text-center text-neutral-lightGray col-span-full text-sm sm:text-base">
            No public posts available.
          </p>
        )}
      </motion.div>
      {hasMore && filteredPosts.length > 0 && (
        <motion.button
          onClick={loadMorePosts}
          className="block mx-auto mt-6 p-2 sm:p-3 bg-accent-gold text-neutral-darkGray rounded-full hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base"
          disabled={loadingMore}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {loadingMore ? 'Loading...' : 'Load More Posts'}
        </motion.button>
      )}
      <AnimatePresence>
        {showScrollToTop && (
          <motion.button
            onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-4 right-4 bg-accent-gold text-neutral-darkGray p-2 rounded-full shadow-lg"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Scroll to top"
          >
            <FaArrowUp size={20} />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedMedia && (
          <MediaModal
            mediaUrl={selectedMedia.url}
            type={selectedMedia.type}
            onClose={() => setSelectedMedia(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default Feed;