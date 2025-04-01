// src/pages/Chat.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  db,
  getUserEvents,
  getUserData,
  updateDoc,
  doc,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  setDoc,
  limit,
  startAfter,
  deleteDoc,
} from '../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaPaperPlane,
  FaImage,
  FaVideo,
  FaPlus,
  FaBell,
  FaCog,
  FaSignOutAlt,
  FaTrash,
  FaLock,
  FaUnlock,
  FaArchive,
  FaArrowDown,
  FaBars,
  FaTimes,
  FaHeart,
  FaComment,
  FaUserPlus,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import CustomQRCode from '../components/CustomQRCode';
import debounce from 'lodash/debounce';
import { openDB } from 'idb';
import MediaEditor from '../components/MediaEditor';
import { uploadImageToCloudinary } from '../utils/cloudinary';

// Constants for pagination
const MESSAGES_PER_PAGE = 20;

// Interfaces
interface Message {
  id: string;
  text?: string;
  mediaUrl?: string;
  type?: 'photo' | 'video';
  userId: string;
  createdAt: string;
  visibility: 'private' | 'public';
  likes?: string[];
  comments?: { userId: string; text: string }[];
  overlayText?: string;
  description?: string;
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

interface EventData {
  id: string;
  title: string;
  organizers: string[];
  invitedUsers: string[];
  userId?: string;
  date?: string;
  createdAt?: string;
  image?: string;
  inviteLink?: string;
  archived?: boolean;
  location?: string;
}

interface UserData {
  displayName: string;
  photoURL?: string;
  notificationsEnabled?: boolean;
}

// Initialize IndexedDB for media caching
const initIndexedDB = async () => {
  return openDB('mediaCache', 1, {
    upgrade(db) {
      db.createObjectStore('media', { keyPath: 'url' });
    },
  });
};

// Utility to cache media in IndexedDB
const cacheMediaInStorage = async (mediaUrl: string, data: string) => {
  try {
    const db = await initIndexedDB();
    await db.put('media', { url: mediaUrl, data });
  } catch (error) {
    console.error('Failed to cache media in IndexedDB:', error);
  }
};

// Utility to get cached media from IndexedDB
const getCachedMedia = async (mediaUrl: string): Promise<string | null> => {
  try {
    const db = await initIndexedDB();
    const data = await db.get('media', mediaUrl);
    return data ? data.data : null;
  } catch (error) {
    console.error('Failed to retrieve media from IndexedDB:', error);
    return null;
  }
};

// Utility to fetch and cache media
const fetchAndCacheMedia = async (mediaUrl: string): Promise<string> => {
  const cached = await getCachedMedia(mediaUrl);
  if (cached) return cached;

  try {
    const response = await fetch(mediaUrl, { mode: 'cors' });
    if (!response.ok) throw new Error(`Failed to fetch media: ${response.statusText}`);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => resolve(reader.result as string);
    });
    await cacheMediaInStorage(mediaUrl, base64);
    return base64;
  } catch (error) {
    console.error('Failed to fetch and cache media:', error);
    return mediaUrl; // Fallback to original URL if fetch fails
  }
};

function Chat() {
  const { eventId } = useParams<{ eventId: string }>();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [showMediaEditor, setShowMediaEditor] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [adminsOnlyTalk, setAdminsOnlyTalk] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchChatQuery, setSearchChatQuery] = useState('');
  const [searchEventQuery, setSearchEventQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [lastVisibleMessage, setLastVisibleMessage] = useState<any>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [usersData, setUsersData] = useState<{ [key: string]: UserData }>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  };

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

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 30 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
    exit: { opacity: 0, scale: 0.95, y: 30 },
  };

  // Fetch user data and events
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);

    const fetchInitialData = async () => {
      try {
        const userData = await getUserData(currentUser.uid);
        if (!userData) {
          await setDoc(doc(db, 'users', currentUser.uid), {
            displayName: currentUser.displayName || 'Anonymous',
            email: currentUser.email || '',
            createdAt: new Date().toISOString(),
            notificationsEnabled: true,
            bio: '',
            location: '',
            photoURL: currentUser.photoURL || '',
            contactEmail: '',
            contactPhone: '',
            followers: [],
            following: [],
          });
        }

        const userEvents = await getUserEvents(currentUser.uid);
        const accessibleEvents = userEvents.filter(
          (e) => e?.organizers?.includes(currentUser.uid) || e?.invitedUsers?.includes(currentUser.uid)
        );
        setEvents(accessibleEvents);
        const event = accessibleEvents.find((e) => e.id === eventId);
        if (event) {
          setSelectedEvent(event);
          const link = event.inviteLink || 'https://eventify-ab64e.web.app/default-invite';
          try {
            new URL(link);
            setInviteLink(link);
          } catch (e) {
            setInviteLink('https://eventify-ab64e.web.app/default-invite');
          }
        } else {
          setError('Event not found or you do not have access.');
          toast.error('Event not found or you do not have access.');
          navigate('/events');
        }
        setLoading(false);
      } catch (err) {
        setError(`Failed to load data: ${(err as Error).message}`);
        toast.error('Failed to load data.');
        setLoading(false);
        navigate('/profile');
      }
    };

    fetchInitialData();
  }, [currentUser, eventId, navigate]);

  // Fetch messages with pagination
  useEffect(() => {
    if (!selectedEvent || !selectedEvent.id) {
      setMessages([]);
      setInviteLink('');
      return;
    }

    const q = query(
      collection(db, 'events', selectedEvent.id, 'chat'),
      orderBy('createdAt', 'asc'),
      limit(MESSAGES_PER_PAGE)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot: QuerySnapshot<DocumentData>) => {
        const newMessages: Message[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[];

        // Fetch user data for message authors
        const userIds = [...new Set(newMessages.map((msg) => msg.userId))].filter(
          (userId) => !usersData[userId]
        );
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

        setMessages(newMessages);
        setLastVisibleMessage(snapshot.docs[snapshot.docs.length - 1]);
        setHasMoreMessages(snapshot.docs.length === MESSAGES_PER_PAGE);
      },
      (err) => {
        setError(`Failed to load messages: ${(err as Error).message}`);
        toast.error('Failed to load messages.');
      }
    );

    return () => unsubscribe();
  }, [selectedEvent, usersData]);

  // Load more messages
  const loadMoreMessages = useCallback(async () => {
    if (!selectedEvent || !lastVisibleMessage || !hasMoreMessages || loadingMoreMessages) return;

    setLoadingMoreMessages(true);
    const q = query(
      collection(db, 'events', selectedEvent.id, 'chat'),
      orderBy('createdAt', 'asc'),
      startAfter(lastVisibleMessage),
      limit(MESSAGES_PER_PAGE)
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

      const newMessages: Message[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      const userIds = [...new Set(newMessages.map((msg) => msg.userId))].filter(
        (userId) => !usersData[userId]
      );
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

      setMessages((prev) => [...prev, ...newMessages]);
      setLastVisibleMessage(snapshot.docs[snapshot.docs.length - 1]);
      setHasMoreMessages(newMessages.length === MESSAGES_PER_PAGE);
    } catch (error) {
      toast.error('Failed to load more messages: ' + (error as Error).message);
    } finally {
      setLoadingMoreMessages(false);
    }
  }, [selectedEvent, lastVisibleMessage, hasMoreMessages, loadingMoreMessages, usersData]);

  // Typing indicator
  const debouncedHandleTyping = useCallback(
    debounce(async () => {
      if (!currentUser || !selectedEvent) return;

      try {
        await setDoc(
          doc(db, 'events', selectedEvent.id, 'typing', currentUser.uid),
          { typing: true },
          { merge: true }
        );
        setTimeout(() => {
          setDoc(doc(db, 'events', selectedEvent.id, 'typing', currentUser.uid), { typing: false });
        }, 3000);
      } catch (err) {
        console.error('Failed to update typing status:', err);
      }
    }, 500),
    [currentUser, selectedEvent]
  );

  useEffect(() => {
    if (!selectedEvent) return;

    const q = collection(db, 'events', selectedEvent.id, 'typing');
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const typing: string[] = [];
        snapshot.forEach((doc) => {
          if (doc.data().typing && doc.id !== currentUser?.uid) {
            typing.push(doc.id);
          }
        });
        setTypingUsers(typing);
      },
      (err) => {
        console.error('Failed to fetch typing users:', err);
      }
    );

    return () => unsubscribe();
  }, [selectedEvent, currentUser]);

  // Scroll handling
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleScroll = () => {
      if (chatContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
        setShowScrollToBottom(scrollHeight - scrollTop - clientHeight > 100);
      }
    };

    chatContainerRef.current?.addEventListener('scroll', handleScroll);
    return () => chatContainerRef.current?.removeEventListener('scroll', handleScroll);
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (postVisibility: 'private' | 'public') => {
      if (!selectedEvent || !currentUser || (!newMessage.trim() && !mediaFile)) return;

      if (adminsOnlyTalk && !selectedEvent.organizers.includes(currentUser.uid)) {
        toast.error('Only admins can send messages in this chat.');
        return;
      }

      setUploading(true);
      try {
        let mediaUrl = '';
        let type: 'photo' | 'video' | undefined = undefined;

        if (mediaFile) {
          if (mediaFile.type.startsWith('image')) {
            mediaUrl = await uploadImageToCloudinary(mediaFile);
            type = 'photo';
            await fetchAndCacheMedia(mediaUrl);
          } else if (mediaFile.type.startsWith('video')) {
            throw new Error('Video uploads are not supported yet. Please upload an image.');
          }
        }

        const messageData: any = {
          text: newMessage || '',
          mediaUrl: mediaUrl || null,
          ...(type && { type }),
          userId: currentUser.uid,
          createdAt: new Date().toISOString(),
          visibility: postVisibility,
          description: description || '',
          overlayText: overlayText || '',
        };

        // Only include brightness, contrast, and saturation if they are defined
        if (mediaFile) {
          messageData.brightness = messageData.brightness ?? 100;
          messageData.contrast = messageData.contrast ?? 100;
          messageData.saturation = messageData.saturation ?? 100;
        }

        await addDoc(collection(db, 'events', selectedEvent.id, 'chat'), messageData);

        if (mediaFile && postVisibility === 'public') {
          await addDoc(collection(db, 'events', selectedEvent.id, 'posts'), {
            userId: currentUser.uid,
            eventId: selectedEvent.id,
            mediaUrl,
            type: type || 'photo',
            visibility: 'public',
            likes: [],
            comments: [],
            createdAt: new Date().toISOString(),
            description: description || '',
          });
        }

        setNewMessage('');
        setMediaFile(null);
        setOverlayText('');
        setDescription('');
        setShowMediaEditor(false);
      } catch (err) {
        setError(`Failed to send message: ${(err as Error).message}`);
        toast.error('Failed to send message.');
      } finally {
        setUploading(false);
      }
    },
    [selectedEvent, currentUser, newMessage, mediaFile, description, overlayText, visibility]
  );

  // Delete message
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!selectedEvent || !currentUser) return;

      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      if (message.userId !== currentUser.uid && !selectedEvent.organizers.includes(currentUser.uid)) {
        toast.error('You do not have permission to delete this message.');
        return;
      }

      try {
        await deleteDoc(doc(db, 'events', selectedEvent.id, 'chat', messageId));
        toast.success('Message deleted successfully.');
      } catch (err) {
        toast.error(`Failed to delete message: ${(err as Error).message}`);
      }
    },
    [selectedEvent, currentUser, messages]
  );

  // Like message
  const handleLike = useCallback(
    async (messageId: string) => {
      if (!currentUser || !selectedEvent) return;
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      try {
        const messageRef = doc(db, 'events', selectedEvent.id, 'chat', messageId);
        const likes = message.likes?.includes(currentUser.uid)
          ? message.likes.filter((id) => id !== currentUser.uid)
          : [...(message.likes || []), currentUser.uid];
        await updateDoc(messageRef, { likes });
      } catch (err) {
        toast.error(`Failed to update like: ${(err as Error).message}`);
      }
    },
    [currentUser, selectedEvent, messages]
  );

  // Comment on message
  const handleComment = useCallback(
    async (messageId: string, commentText: string) => {
      if (!currentUser || !selectedEvent || !commentText.trim()) return;
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      try {
        const messageRef = doc(db, 'events', selectedEvent.id, 'chat', messageId);
        const comments = [...(message.comments || []), { userId: currentUser.uid, text: commentText }];
        await updateDoc(messageRef, { comments });
      } catch (err) {
        toast.error(`Failed to add comment: ${(err as Error).message}`);
      }
    },
    [currentUser, selectedEvent, messages]
  );

  // Add collaborator
  const addCollaborator = useCallback(
    async (userId: string) => {
      if (!currentUser || !selectedEvent?.organizers?.includes(currentUser.uid)) return;

      try {
        const eventRef = doc(db, 'events', selectedEvent.id);
        await updateDoc(eventRef, { organizers: [...selectedEvent.organizers, userId] });
        await addDoc(collection(db, 'events', selectedEvent.id, 'chat'), {
          text: `${userId} has been added as a collaborator.`,
          userId: currentUser.uid,
          createdAt: new Date().toISOString(),
          visibility: 'private',
        });
        toast.success('Collaborator added successfully.');
      } catch (err) {
        toast.error(`Failed to add collaborator: ${(err as Error).message}`);
      }
    },
    [currentUser, selectedEvent]
  );

  // Toggle admins only talk
  const toggleAdminsOnlyTalk = useCallback(async () => {
    if (!currentUser || !selectedEvent?.organizers?.includes(currentUser.uid)) return;

    try {
      const newAdminsOnlyTalk = !adminsOnlyTalk;
      setAdminsOnlyTalk(newAdminsOnlyTalk);
      await addDoc(collection(db, 'events', selectedEvent.id, 'chat'), {
        text: `Chat mode: ${newAdminsOnlyTalk ? 'Admins only' : 'All members'}`,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        visibility: 'private',
      });
      toast.success(`Chat mode set to ${newAdminsOnlyTalk ? 'Admins only' : 'All members'}.`);
    } catch (err) {
      toast.error(`Failed to toggle chat mode: ${(err as Error).message}`);
    }
  }, [currentUser, selectedEvent, adminsOnlyTalk]);

  // Delete chat
  const deleteChat = useCallback(async () => {
    if (!currentUser || selectedEvent?.userId !== currentUser.uid) return;

    try {
      const eventRef = doc(db, 'events', selectedEvent!.id);
      await updateDoc(eventRef, { deleted: true });
      setEvents(events.filter((e) => e.id !== selectedEvent!.id));
      setSelectedEvent(null);
      navigate('/events');
      toast.success('Chat deleted successfully.');
    } catch (err) {
      toast.error(`Failed to delete chat: ${(err as Error).message}`);
    }
  }, [currentUser, selectedEvent, events, navigate]);

  // Leave group
  const leaveGroup = useCallback(async () => {
    if (!currentUser || !selectedEvent) return;

    try {
      const eventRef = doc(db, 'events', selectedEvent.id);
      await updateDoc(eventRef, {
        organizers: selectedEvent.organizers.filter((id: string) => id !== currentUser.uid),
        invitedUsers: selectedEvent.invitedUsers.filter((id: string) => id !== currentUser.uid),
      });
      setEvents(events.filter((e) => e.id !== selectedEvent.id));
      setSelectedEvent(null);
      navigate('/events');
      toast.success('You have left the chat.');
    } catch (err) {
      toast.error(`Failed to leave chat: ${(err as Error).message}`);
    }
  }, [currentUser, selectedEvent, events, navigate]);

  // Archive chat
  const archiveChat = useCallback(async () => {
    if (!currentUser || !selectedEvent?.organizers?.includes(currentUser.uid)) return;

    try {
      const eventRef = doc(db, 'events', selectedEvent.id);
      await updateDoc(eventRef, { archived: true });
      setEvents(events.filter((e) => e.id !== selectedEvent.id));
      setSelectedEvent(null);
      navigate('/events');
      toast.success('Chat archived successfully.');
    } catch (err) {
      toast.error(`Failed to archive chat: ${(err as Error).message}`);
    }
  }, [currentUser, selectedEvent, events, navigate]);

  // Change group name
  const changeGroupName = useCallback(
    async (newName: string) => {
      if (!currentUser || !selectedEvent?.organizers?.includes(currentUser.uid) || !newName.trim()) return;

      try {
        const eventRef = doc(db, 'events', selectedEvent.id);
        await updateDoc(eventRef, { title: newName });
        setSelectedEvent({ ...selectedEvent, title: newName });
        toast.success('Chat name updated successfully.');
      } catch (err) {
        toast.error(`Failed to update chat name: ${(err as Error).message}`);
      }
    },
    [currentUser, selectedEvent]
  );

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      toast.success('Logged out successfully.');
    } catch (err) {
      toast.error(`Failed to logout: ${(err as Error).message}`);
    }
  };

  // Memoized filtered data
  const filteredEvents = useMemo(
    () =>
      events.filter((event) =>
        event?.title?.toLowerCase().includes(searchEventQuery.toLowerCase())
      ),
    [events, searchEventQuery]
  );

  const filteredMessages = useMemo(
    () =>
      messages.filter((msg) =>
        msg.text?.toLowerCase().includes(searchChatQuery.toLowerCase())
      ),
    [messages, searchChatQuery]
  );

  // Message Row Component
  const MessageRow = ({ msg }: { msg: Message }) => {
    const user = usersData[msg.userId] || { displayName: 'Anonymous', photoURL: undefined };
    const isOwnMessage = msg.userId === currentUser?.uid;
    const [mediaSrc, setMediaSrc] = useState<string | null>(null);
    const [mediaError, setMediaError] = useState<string | null>(null);

    useEffect(() => {
      if (msg.mediaUrl) {
        fetchAndCacheMedia(msg.mediaUrl)
          .then((src) => {
            setMediaSrc(src);
            setMediaError(null);
          })
          .catch((err) => {
            setMediaError('Failed to load media.');
            console.error('Media load error:', err);
          });
      }
    }, [msg.mediaUrl]);

    return (
      <motion.div
        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4 px-4`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-start gap-3 max-w-[70%] sm:max-w-[60%]`}>
          {/* User Avatar (only for incoming messages) */}
          {!isOwnMessage && (
            <div className="w-10 h-10 rounded-full overflow-hidden shadow-md flex-shrink-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={`${user.displayName}'s avatar`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center text-yellow-400 text-lg font-semibold">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}

          {/* Chat Bubble */}
          <div
            className={`relative p-4 rounded-2xl shadow-lg transition-all duration-300 ${
              isOwnMessage
                ? 'bg-gray-800/90 text-gray-200'
                : 'bg-white text-gray-900'
            } hover:shadow-xl`}
          >
            {/* User Name and Delete Button */}
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-yellow-400">{user.displayName}</p>
              {(isOwnMessage || selectedEvent?.organizers.includes(currentUser?.uid || '')) && (
                <motion.button
                  onClick={() => deleteMessage(msg.id)}
                  className="text-red-400 hover:text-red-300 transition-colors group relative"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Delete message"
                >
                  <FaTrash size={12} />
                  <span className="absolute left-1/2 transform -translate-x-1/2 bottom-6 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    Delete
                  </span>
                </motion.button>
              )}
            </div>

            {/* Message Content */}
            {msg.text && <p className="text-sm break-words">{msg.text}</p>}
            {msg.overlayText && <p className="font-semibold text-sm mt-1 text-gray-300">{msg.overlayText}</p>}
            {msg.mediaUrl && (
              <div className="relative mt-2 w-full h-48 rounded-lg overflow-hidden">
                {mediaError ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-700 text-red-400 text-sm">
                    {mediaError}
                  </div>
                ) : mediaSrc ? (
                  <>
                    {msg.type === 'photo' ? (
                      <img
                        src={mediaSrc}
                        alt="Chat media"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        style={{
                          filter: `brightness(${msg.brightness ?? 100}%) contrast(${msg.contrast ?? 100}%) saturate(${msg.saturation ?? 100}%)`,
                        }}
                        onError={() => setMediaError('Failed to load media.')}
                      />
                    ) : (
                      <video
                        src={mediaSrc}
                        controls
                        className="w-full h-full object-cover"
                        onError={() => setMediaError('Failed to load media.')}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-700 text-gray-400 text-sm">
                    Loading media...
                  </div>
                )}
              </div>
            )}
            {msg.description && <p className="text-xs mt-2 italic text-gray-400">{msg.description}</p>}

            {/* Timestamp */}
            <p className="text-xs text-gray-500 mt-2">
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>

            {/* Likes and Comments */}
            {msg.visibility === 'public' && (
              <div className="flex gap-3 mt-3">
                <motion.button
                  onClick={() => handleLike(msg.id)}
                  className={`text-sm flex items-center gap-1 ${
                    msg.likes?.includes(currentUser?.uid || '') ? 'text-yellow-400' : 'text-gray-400'
                  } hover:text-yellow-300 transition-colors group relative`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label={msg.likes?.includes(currentUser?.uid || '') ? 'Unlike message' : 'Like message'}
                >
                  <FaHeart size={14} />
                  <span>{msg.likes?.length || 0}</span>
                  <span className="absolute left-1/2 transform -translate-x-1/2 bottom-6 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {msg.likes?.includes(currentUser?.uid || '') ? 'Unlike' : 'Like'}
                  </span>
                </motion.button>
                <motion.button
                  onClick={() => {
                    const comment = prompt('Enter your comment:');
                    if (comment) handleComment(msg.id, comment);
                  }}
                  className="text-sm flex items-center gap-1 text-gray-400 hover:text-yellow-300 transition-colors group relative"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Comment on message"
                >
                  <FaComment size={14} />
                  <span>{msg.comments?.length || 0}</span>
                  <span className="absolute left-1/2 transform -translate-x-1/2 bottom-6 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    Comment
                  </span>
                </motion.button>
              </div>
            )}

            {/* Comments Display */}
            {msg.comments && msg.comments.length > 0 && (
              <div className="mt-3 space-y-2">
                {msg.comments.map((comment, idx) => (
                  <p key={idx} className="text-xs text-gray-400">
                    <span className="font-semibold text-yellow-400">
                      {usersData[comment.userId]?.displayName || 'Anonymous'}:
                    </span>{' '}
                    {comment.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <motion.div
          className="text-yellow-400 text-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <motion.div
          className="text-red-400 text-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {error}
        </motion.div>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <motion.div
          className="text-yellow-400 text-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          No event selected.
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-900">
      {/* Sidebar (Chat List) */}
      <motion.div
        className={`md:w-64 bg-gray-800/90 backdrop-blur-lg p-4 z-40 md:static md:block ${
          isSidebarOpen ? 'block fixed inset-y-0 left-0 w-64' : 'hidden'
        } md:h-[calc(100vh-4rem)] md:overflow-y-auto`} // Adjusted for desktop
        initial={{ x: -256 }}
        animate={{ x: isSidebarOpen ? 0 : -256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="flex justify-between items-center mb-6">
          <Link to="/events">
            <motion.h2
              className="text-2xl font-bold text-yellow-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Eventify
            </motion.h2>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-gray-400 hover:text-yellow-400 md:hidden"
            aria-label="Close sidebar"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Search Events */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search events..."
            value={searchEventQuery}
            onChange={(e) => setSearchEventQuery(e.target.value)}
            className="w-full p-2 rounded-lg bg-gray-700 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm"
          />
        </div>

        {/* Event List */}
        <motion.div className="space-y-3" variants={stagger} initial="hidden" animate="visible">
          {filteredEvents.map((event) => (
            <motion.div key={event.id} variants={fadeIn}>
              <Link
                to={`/chat/${event.id}`}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  selectedEvent.id === event.id
                    ? 'bg-yellow-400 text-gray-900'
                    : 'bg-gray-700/50 text-gray-200 hover:bg-gray-600/50'
                }`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  {event.image ? (
                    <img
                      src={event.image}
                      alt={`${event.title} image`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-600 flex items-center justify-center text-yellow-400 text-lg font-semibold">
                      {event.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{event.title}</p>
                  <p className="text-xs text-gray-400">
                    {event.date
                      ? new Date(event.date).toLocaleDateString()
                      : event.createdAt
                      ? new Date(event.createdAt).toLocaleDateString()
                      : 'No date'}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Create Event Button (Navigates to /events) */}
        <Link to="/events">
          <motion.button
            className="w-full mt-6 flex items-center gap-2 p-3 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaPlus /> <span>Create Event</span>
          </motion.button>
        </Link>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <motion.header
          className="bg-gray-800/90 backdrop-blur-lg p-4 flex justify-between items-center shadow-lg sticky top-0 z-30"
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="text-gray-400 hover:text-yellow-400 md:hidden"
              aria-label="Open sidebar"
            >
              <FaBars size={20} />
            </button>
            <motion.h1
              className="text-xl font-bold text-yellow-400"
              variants={headingFade}
              initial="hidden"
              animate="visible"
            >
              {selectedEvent.title}
            </motion.h1>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setShowQRCode(true)}
              className="text-gray-400 hover:text-yellow-400 transition-colors group relative"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Show QR code"
            >
              <FaBell size={20} />
              <span className="absolute left-1/2 transform -translate-x-1/2 bottom-8 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Invite
              </span>
            </motion.button>
            <motion.button
              onClick={() => setShowSettings(true)}
              className="text-gray-400 hover:text-yellow-400 transition-colors group relative"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Settings"
            >
              <FaCog size={20} />
              <span className="absolute left-1/2 transform -translate-x-1/2 bottom-8 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Settings
              </span>
            </motion.button>
            <motion.button
              onClick={handleLogout}
              className="text-gray-400 hover:text-yellow-400 transition-colors group relative"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Logout"
            >
              <FaSignOutAlt size={20} />
              <span className="absolute left-1/2 transform -translate-x-1/2 bottom-8 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Logout
              </span>
            </motion.button>
          </div>
        </motion.header>

        {/* Chat Messages */}
        <div
          className="flex-1 p-4 overflow-y-auto"
          ref={chatContainerRef}
          style={{ maxHeight: 'calc(100vh - 8rem)' }} // Adjusted to account for header and footer
        >
          {/* Search Chat */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search chat..."
              value={searchChatQuery}
              onChange={(e) => setSearchChatQuery(e.target.value)}
              className="w-full p-2 rounded-lg bg-gray-700 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm"
            />
          </div>

          {/* Messages */}
          <motion.div className="space-y-4" variants={stagger} initial="hidden" animate="visible">
            {filteredMessages.length === 0 ? (
              <div className="text-center text-gray-400">No messages yet.</div>
            ) : (
              filteredMessages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
            )}
            {loadingMoreMessages && (
              <div className="text-center text-gray-400">Loading more messages...</div>
            )}
            {hasMoreMessages && !loadingMoreMessages && (
              <div className="text-center">
                <motion.button
                  onClick={loadMoreMessages}
                  className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Load More
                </motion.button>
              </div>
            )}
            <div ref={chatEndRef} />
          </motion.div>

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <motion.div
              className="flex items-center gap-2 mt-4 px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-sm text-gray-400">
                {typingUsers
                  .slice(0, 3)
                  .map((userId) => usersData[userId]?.displayName || 'Anonymous')
                  .join(', ')}{' '}
                {typingUsers.length > 3 && `and ${typingUsers.length - 3} others`} typing
              </p>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-yellow-400 rounded-full"
                    animate={{
                      y: [0, -5, 0],
                      transition: { repeat: Infinity, delay: i * 0.2, duration: 0.6 },
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollToBottom && (
          <motion.button
            onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="fixed bottom-20 right-4 bg-yellow-400 text-gray-900 p-3 rounded-full shadow-lg hover:bg-yellow-300 transition-all"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Scroll to bottom"
          >
            <FaArrowDown size={16} />
          </motion.button>
        )}

        {/* Message Input */}
        <motion.div
          className="bg-gray-800/90 backdrop-blur-lg p-4 flex items-center gap-3 shadow-lg sticky bottom-0 z-30"
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setMediaFile(file);
                setShowMediaEditor(true);
              }
              e.target.value = ''; // Reset input
            }}
            className="hidden"
            id="media-upload"
          />
          <motion.label
            htmlFor="media-upload"
            className="text-gray-400 hover:text-yellow-400 transition-colors cursor-pointer group relative"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Upload media"
          >
            <FaImage size={20} />
            <span className="absolute left-1/2 transform -translate-x-1/2 bottom-8 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
              Upload Media
            </span>
          </motion.label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              debouncedHandleTyping();
            }}
            placeholder="Type a message..."
            className="flex-1 p-2 rounded-lg bg-gray-700 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(visibility);
              }
            }}
          />
          <motion.button
            onClick={() => sendMessage(visibility)}
            disabled={uploading || (!newMessage.trim() && !mediaFile)}
            className="bg-yellow-400 text-gray-900 p-2 rounded-lg hover:bg-yellow-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Send message"
          >
            {uploading ? (
              <svg className="animate-spin h-5 w-5 text-gray-900" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  className="opacity-75"
                />
              </svg>
            ) : (
              <FaPaperPlane size={20} />
            )}
          </motion.button>
        </motion.div>
      </div>

      {/* Media Editor */}
      <MediaEditor
        mediaFile={mediaFile}
        setMediaFile={setMediaFile}
        showMediaEditor={showMediaEditor}
        setShowMediaEditor={setShowMediaEditor}
        setOverlayText={setOverlayText}
        setDescription={setDescription}
        setVisibility={setVisibility}
        overlayText={overlayText}
        description={description}
        visibility={visibility}
      />

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRCode && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            onClick={() => setShowQRCode(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800/90 backdrop-blur-lg rounded-2xl max-w-sm w-full p-6 relative shadow-2xl border border-gray-700/50"
              role="dialog"
              aria-labelledby="qr-code-modal-title"
            >
              <motion.button
                onClick={() => setShowQRCode(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-yellow-400 transition-colors"
                whileHover={{ scale: 1.2, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close QR code modal"
              >
                <FaTimes size={20} />
              </motion.button>
              <motion.h2
                id="qr-code-modal-title"
                className="text-2xl font-bold text-yellow-400 mb-6 text-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                Invite to {selectedEvent.title}
              </motion.h2>
              <div className="flex justify-center mb-4">
                <CustomQRCode value={inviteLink} />
              </div>
              <p className="text-gray-400 text-center text-sm break-all">{inviteLink}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              ref={modalRef}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800/90 backdrop-blur-lg rounded-2xl max-w-md w-full p-6 relative shadow-2xl border border-gray-700/50"
              role="dialog"
              aria-labelledby="settings-modal-title"
            >
              <motion.button
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-yellow-400 transition-colors"
                whileHover={{ scale: 1.2, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close settings modal"
              >
                <FaTimes size={20} />
              </motion.button>
              <motion.h2
                id="settings-modal-title"
                className="text-2xl font-bold text-yellow-400 mb-6 text-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                Chat Settings
              </motion.h2>
              <div className="space-y-4">
                {/* Change Group Name */}
                {selectedEvent.organizers.includes(currentUser?.uid || '') && (
                  <div>
                    <label className="text-sm text-gray-400">Group Name</label>
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        defaultValue={selectedEvent.title}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            changeGroupName((e.target as HTMLInputElement).value);
                          }
                        }}
                        className="flex-1 p-2 rounded-lg bg-gray-700 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm"
                      />
                      <motion.button
                        onClick={() => {
                          const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                          changeGroupName(input.value);
                        }}
                        className="bg-yellow-400 text-gray-900 p-2 rounded-lg hover:bg-yellow-300 transition-all"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Update
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* Add Collaborator */}
                {selectedEvent.organizers.includes(currentUser?.uid || '') && (
                  <div>
                    <label className="text-sm text-gray-400">Add Collaborator (User ID)</label>
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Enter user ID..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addCollaborator((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                        className="flex-1 p-2 rounded-lg bg-gray-700 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm"
                      />
                      <motion.button
                        onClick={() => {
                          const input = document.querySelector('input[placeholder="Enter user ID..."]') as HTMLInputElement;
                          addCollaborator(input.value);
                          input.value = '';
                        }}
                        className="bg-yellow-400 text-gray-900 p-2 rounded-lg hover:bg-yellow-300 transition-all"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <FaUserPlus size={16} />
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* Admins Only Talk */}
                {selectedEvent.organizers.includes(currentUser?.uid || '') && (
                  <motion.button
                    onClick={toggleAdminsOnlyTalk}
                    className="w-full flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg text-gray-200 hover:bg-gray-600/50 transition-all shadow-md text-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {adminsOnlyTalk ? <FaLock /> : <FaUnlock />}
                    <span>{adminsOnlyTalk ? 'Admins Only' : 'All Members'}</span>
                  </motion.button>
                )}

                {/* Archive Chat */}
                {selectedEvent.organizers.includes(currentUser?.uid || '') && (
                  <motion.button
                    onClick={archiveChat}
                    className="w-full flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg text-gray-200 hover:bg-gray-600/50 transition-all shadow-md text-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaArchive /> <span>Archive Chat</span>
                  </motion.button>
                )}

                {/* Delete Chat */}
                {selectedEvent.userId === currentUser?.uid && (
                  <motion.button
                    onClick={deleteChat}
                    className="w-full flex items-center gap-2 p-3 bg-red-600/50 rounded-lg text-gray-200 hover:bg-red-500/50 transition-all shadow-md text-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaTrash /> <span>Delete Chat</span>
                  </motion.button>
                )}

                {/* Leave Group */}
                <motion.button
                  onClick={leaveGroup}
                  className="w-full flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg text-gray-200 hover:bg-gray-600/50 transition-all shadow-md text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaSignOutAlt /> <span>Leave Group</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer (Ensuring visibility on mobile) */}
      <footer className="bg-gray-800/90 backdrop-blur-lg p-4 text-center text-gray-400 text-sm z-30">
        <p>&copy; 2025 Eventify. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default Chat;