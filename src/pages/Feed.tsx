import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, startAfter, limit } from 'firebase/firestore'; // Removed getFirestore
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { FaHeart, FaComment } from 'react-icons/fa';

interface Event {
  id: string;
  title: string;
  category: 'Refreshments' | 'Catering/Food' | 'Venue Provider';
}

interface Post {
  id: string;
  eventId: string;
  userId: string;
  mediaUrl: string;
  type: 'photo' | 'video';
  visibility: 'public' | 'private'; // Added visibility
  likes: string[];
  comments: { userId: string; text: string }[];
  createdAt: string;
}

function Feed() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<(Post & { eventTitle: string; eventCategory: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const POSTS_PER_PAGE = 10;

  // Fetch events to map eventId to title and category
  const fetchEvents = async () => {
    const eventsCol = collection(db, 'events');
    const snapshot = await getDocs(eventsCol);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      category: doc.data().category,
    })) as Event[];
  };

  // Fetch public posts with pagination
  const fetchPublicPosts = async (isInitialLoad = false) => {
    setLoading(true);
    setError(null);
    try {
      const events = await fetchEvents();
      const publicPosts: (Post & { eventTitle: string; eventCategory: string })[] = [];
      const eventsCol = collection(db, 'events');
      const eventsSnapshot = await getDocs(eventsCol);

      for (const eventDoc of eventsSnapshot.docs) {
        const event = events.find((e) => e.id === eventDoc.id);
        if (!event) continue;

        const postsQuery = query(
          collection(db, 'events', eventDoc.id, 'posts'),
          orderBy('createdAt', 'desc'),
          ...(isInitialLoad || !lastDoc ? [] : [startAfter(lastDoc)]),
          limit(POSTS_PER_PAGE)
        );
        const postsSnapshot = await getDocs(postsQuery);
        const eventPosts = postsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            eventId: eventDoc.id,
            eventTitle: event.title,
            eventCategory: event.category,
            userId: doc.data().userId,
            mediaUrl: doc.data().mediaUrl,
            type: doc.data().type,
            visibility: doc.data().visibility, // Now included in Post interface
            likes: doc.data().likes,
            comments: doc.data().comments,
            createdAt: doc.data().createdAt,
          }))
          .filter((post) => post.visibility === 'public') as (Post & { eventTitle: string; eventCategory: string })[];

        if (filter && eventPosts.length > 0) {
          publicPosts.push(...eventPosts.filter((post) => post.eventCategory === filter));
        } else if (!filter) {
          publicPosts.push(...eventPosts);
        }

        if (postsSnapshot.docs.length > 0) {
          setLastDoc(postsSnapshot.docs[postsSnapshot.docs.length - 1]);
        }
      }

      if (isInitialLoad) {
        setPosts(publicPosts);
      } else {
        setPosts((prev) => [...prev, ...publicPosts]);
      }
      setHasMore(publicPosts.length === POSTS_PER_PAGE);
    } catch (err) {
      setError('Failed to fetch public posts.');
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and filter change
  useEffect(() => {
    fetchPublicPosts(true);
  }, [filter]);

  // Infinite scrolling
  useEffect(() => {
    if (loading || !hasMore) return;

    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchPublicPosts();
        }
      },
      { threshold: 1.0 }
    );

    if (loadMoreRef.current) {
      observer.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observer.current && loadMoreRef.current) {
        observer.current.unobserve(loadMoreRef.current);
      }
    };
  }, [loading, hasMore]);

  // Handle like
  const handleLike = async (eventId: string, postId: string) => {
    if (!currentUser) return setError('Please log in to like posts.');
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
  };

  // Handle comment
  const handleComment = async (eventId: string, postId: string, text: string) => {
    if (!currentUser || !text) return setError('Please log in and enter a comment.');
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
  };

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray">
      {/* Header */}
      <section className="bg-primary-navy p-6">
        <div className="container mx-auto">
          <h1 className="text-4xl font-bold">Eventify Feed</h1>
          <p className="text-lg mt-2">See what’s happening across all public events!</p>
        </div>
      </section>

      {/* Filter Buttons */}
      <section className="container mx-auto p-6">
        <div className="flex flex-wrap gap-4 mb-6">
          <button
            className={`px-4 py-2 rounded ${filter === null ? 'bg-secondary-deepRed' : 'bg-gray-500'} text-neutral-lightGray hover:bg-secondary-darkRed`}
            onClick={() => setFilter(null)}
          >
            All
          </button>
          <button
            className={`px-4 py-2 rounded ${filter === 'Refreshments' ? 'bg-refreshments-lightBlue' : 'bg-gray-500'} text-neutral-darkGray hover:bg-refreshments-lightBlue`}
            onClick={() => setFilter('Refreshments')}
          >
            Refreshments
          </button>
          <button
            className={`px-4 py-2 rounded ${filter === 'Catering/Food' ? 'bg-catering-orange' : 'bg-gray-500'} text-neutral-darkGray hover:bg-catering-orange`}
            onClick={() => setFilter('Catering/Food')}
          >
            Catering/Food
          </button>
          <button
            className={`px-4 py-2 rounded ${filter === 'Venue Provider' ? 'bg-venue-green' : 'bg-gray-500'} text-neutral-darkGray hover:bg-venue-green`}
            onClick={() => setFilter('Venue Provider')}
          >
            Venue Provider
          </button>
        </div>

        {/* Feed Content */}
        {loading && posts.length === 0 && <p className="text-center">Loading feed...</p>}
        {error && <p className="text-red-500 text-center">{error}</p>}
        {!loading && !error && (
          <div className="space-y-6">
            {posts.length > 0 ? (
              posts.map((post) => (
                <div key={`${post.eventId}-${post.id}`} className="bg-neutral-offWhite text-neutral-darkGray p-4 rounded shadow">
                  {post.type === 'photo' ? (
                    <img src={post.mediaUrl} alt={`Post by ${post.userId}`} className="w-full h-64 object-cover rounded" />
                  ) : (
                    <video src={post.mediaUrl} controls className="w-full h-64 rounded" />
                  )}
                  <div className="mt-2">
                    <Link
                      to={`/events/${post.eventId}`}
                      className="text-lg font-semibold text-accent-gold hover:underline"
                    >
                      {post.eventTitle}
                    </Link>
                    <p className="text-sm text-accent-gold">
                      Posted by {post.userId} on {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex justify-between items-center mt-2">
                      <button
                        className="flex items-center space-x-1"
                        onClick={() => handleLike(post.eventId, post.id)}
                        aria-label={`Like post by ${post.userId}`}
                        disabled={!currentUser}
                      >
                        <FaHeart className={post.likes.includes(currentUser?.uid || '') ? 'text-red-600' : 'text-gray-400'} />
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
                    {currentUser ? (
                      <>
                        <label htmlFor={`comment-${post.id}`} className="sr-only">Add a comment</label>
                        <input
                          id={`comment-${post.id}`}
                          type="text"
                          placeholder="Add a comment..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value) {
                              handleComment(post.eventId, post.id, e.currentTarget.value);
                              e.currentTarget.value = '';
                            }
                          }}
                          className="w-full p-1 mt-2 rounded bg-neutral-offWhite text-neutral-darkGray"
                        />
                      </>
                    ) : (
                      <p className="text-sm mt-2">Log in to comment.</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center">No public posts available for this filter.</p>
            )}
            {hasMore && (
              <div ref={loadMoreRef} className="text-center py-4">
                <button
                  className="bg-secondary-deepRed text-neutral-lightGray px-4 py-2 rounded hover:bg-secondary-darkRed"
                  onClick={() => fetchPublicPosts()}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default Feed;