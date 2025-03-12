import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getFeedPosts, PostData } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { FaHeart, FaComment } from 'react-icons/fa';

function Feed() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const stagger = {
    visible: { transition: { staggerChildren: 0.2 } },
  };

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const feedPosts = await getFeedPosts();
        setPosts(feedPosts);
      } catch (err: any) {
        setError('Failed to load feed: ' + err.message);
        console.error('Error fetching feed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const handleLike = async (eventId: string, postId: string) => {
    if (!currentUser) return setError('Please log in to like posts.');
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
      setError('Failed to update like: ' + err.message);
      console.error('Error liking post:', err);
    }
  };

  const handleComment = async (eventId: string, postId: string, text: string) => {
    if (!currentUser || !text.trim()) return setError('Please log in and enter a comment.');
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
      setError('Failed to add comment: ' + err.message);
      console.error('Error adding comment:', err);
    }
  };

  if (loading) {
    return <div className="text-center py-10 text-neutral-lightGray">Loading feed...</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray py-10 px-4">
      <motion.h1
        className="text-4xl font-bold text-accent-gold text-center mb-8"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        Event Feed
      </motion.h1>
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}
      <motion.div
        className="max-w-2xl mx-auto space-y-6"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        {posts.length > 0 ? (
          posts.map((post) => (
            <motion.div
              key={`${post.eventId}-${post.id}`}
              className="bg-neutral-offWhite text-neutral-darkGray p-4 rounded-lg shadow"
              variants={fadeIn}
            >
              {post.type === 'photo' ? (
                <img src={post.mediaUrl} alt="Feed Post" className="w-full h-64 object-cover rounded" />
              ) : (
                <video src={post.mediaUrl} controls className="w-full h-64 rounded" />
              )}
              <div className="flex justify-between items-center mt-2">
                <button
                  className="flex items-center space-x-1"
                  onClick={() => handleLike(post.eventId, post.id)}
                  disabled={!currentUser}
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
              {currentUser ? (
                <input
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
              ) : (
                <p className="text-sm mt-2">Log in to comment.</p>
              )}
            </motion.div>
          ))
        ) : (
          <p className="text-center text-neutral-lightGray">No public posts available.</p>
        )}
      </motion.div>
    </div>
  );
}

export default Feed;