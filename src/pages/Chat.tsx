// src/pages/Chat.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  db,
  storage,
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
  QueryDocumentSnapshot,
  setDoc,
  limit,
  startAfter,
  deleteDoc,
} from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import CustomQRCode from '../components/CustomQRCode';
import Cropper from 'react-easy-crop';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import debounce from 'lodash/debounce';
import { openDB } from 'idb';

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

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'invite' | 'post';
  message: string;
  postId?: string;
  eventId: string;
  createdAt: string;
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
    const response = await fetch(mediaUrl);
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
    return mediaUrl;
  }
};

function Chat() {
  const { eventId } = useParams<{ eventId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [showMediaEditor, setShowMediaEditor] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [overlayText, setOverlayText] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
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

  // Animation variants from Events.tsx
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
          setNotificationsEnabled(true);
        } else {
          setNotificationsEnabled(userData.notificationsEnabled ?? true);
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

  // Fetch notifications
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'users', currentUser.uid, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotifications(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }) as Notification)
        );
      },
      (err) => {
        setError(`Failed to load notifications: ${(err as Error).message}`);
        toast.error('Failed to load notifications.');
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

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
          const storageRef = ref(storage, `chat/${selectedEvent.id}/${mediaFile.name}-${Date.now()}`);
          await uploadBytes(storageRef, mediaFile);
          mediaUrl = await getDownloadURL(storageRef);
          if (mediaFile.type.startsWith('image')) {
            type = 'photo';
          } else if (mediaFile.type.startsWith('video')) {
            type = 'video';
          }
        }

        const messageData = {
          text: newMessage || '',
          mediaUrl: mediaUrl || null,
          ...(type && { type }),
          userId: currentUser.uid,
          createdAt: new Date().toISOString(),
          visibility: postVisibility,
          description: description || '',
          overlayText: overlayText || '',
          brightness,
          contrast,
          saturation,
        };

        await addDoc(collection(db, 'events', selectedEvent.id, 'chat'), messageData);

        if (mediaFile && postVisibility === 'public') {
          const postDoc = await addDoc(collection(db, 'events', selectedEvent.id, 'posts'), {
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

          for (const organizerId of selectedEvent.organizers) {
            if (organizerId !== currentUser.uid) {
              await addDoc(collection(db, 'users', organizerId, 'notifications'), {
                type: 'post',
                message: `${currentUser.displayName || 'A user'} posted in ${selectedEvent.title || 'an event'}`,
                eventId: selectedEvent.id,
                postId: postDoc.id,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }

        setNewMessage('');
        setMediaFile(null);
        setOverlayText('');
        setDescription('');
        setShowMediaEditor(false);
        setBrightness(100);
        setContrast(100);
        setSaturation(100);
      } catch (err) {
        setError(`Failed to send message: ${(err as Error).message}`);
        toast.error('Failed to send message.');
      } finally {
        setUploading(false);
      }
    },
    [selectedEvent, currentUser, newMessage, mediaFile, description, overlayText, brightness, contrast, saturation]
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

        if (likes.includes(currentUser.uid) && message.userId !== currentUser.uid) {
          await addDoc(collection(db, 'users', message.userId, 'notifications'), {
            type: 'like',
            message: `${currentUser.displayName || 'A user'} liked your message in ${selectedEvent.title || 'an event'}`,
            eventId: selectedEvent.id,
            postId: messageId,
            createdAt: new Date().toISOString(),
          });
        }
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

        if (message.userId !== currentUser.uid) {
          await addDoc(collection(db, 'users', message.userId, 'notifications'), {
            type: 'comment',
            message: `${currentUser.displayName || 'A user'} commented on your message in ${selectedEvent.title || 'an event'}`,
            eventId: selectedEvent.id,
            postId: messageId,
            createdAt: new Date().toISOString(),
          });
        }
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

  // Media editing
  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const getCroppedImg = async () => {
    if (!croppedAreaPixels || !mediaFile) {
      throw new Error('Cropped area or media file is not defined');
    }
    const canvas = document.createElement('canvas');
    const image = new Image();
    image.src = URL.createObjectURL(mediaFile);
    await new Promise((resolve) => (image.onload = resolve));
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
    }
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg'));
  };

  const applyMediaEdits = async () => {
    try {
      const croppedBlob = await getCroppedImg();
      if (croppedBlob) {
        const croppedFile = new File([croppedBlob as Blob], 'cropped.jpg', { type: 'image/jpeg' });
        setMediaFile(croppedFile);
      }
    } catch (err) {
      setError(`Failed to apply edits: ${(err as Error).message}`);
      toast.error('Failed to apply edits.');
    }
  };

  // Toggle notifications
  const toggleNotifications = useCallback(async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { notificationsEnabled: !notificationsEnabled });
      setNotificationsEnabled((prev) => !prev);
      toast.success(`Notifications ${notificationsEnabled ? 'disabled' : 'enabled'}.`);
    } catch (err) {
      toast.error(`Failed to toggle notifications: ${(err as Error).message}`);
    }
  }, [currentUser, notificationsEnabled]);

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

    useEffect(() => {
      if (msg.mediaUrl) {
        fetchAndCacheMedia(msg.mediaUrl).then((src) => setMediaSrc(src));
      }
    }, [msg.mediaUrl]);

    return (
      <motion.div
        className={`mb-4 flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={`flex items-start ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} gap-2 max-w-[80%] sm:max-w-md`}>
          <div className="w-10 h-10 rounded-full overflow-hidden">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={`${user.displayName}'s avatar`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-neutral-mediumGray flex items-center justify-center text-accent-gold text-lg">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div
            className={`flex-1 p-3 rounded-lg relative overflow-hidden ${
              isOwnMessage
                ? 'bg-gradient-to-r from-accent-gold/70 to-yellow-300/70 text-neutral-darkGray'
                : 'bg-neutral-mediumGray/50 backdrop-blur-lg text-neutral-lightGray'
            } shadow-md border border-neutral-mediumGray/50`}
          >
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs font-semibold text-accent-gold">{user.displayName}</p>
              {(isOwnMessage || selectedEvent?.organizers.includes(currentUser?.uid || '')) && (
                <motion.button
                  onClick={() => deleteMessage(msg.id)}
                  className="text-red-500 hover:text-red-400 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Delete message"
                >
                  <FaTrash size={12} />
                </motion.button>
              )}
            </div>
            {msg.text && <p className="text-sm break-words">{msg.text}</p>}
            {msg.overlayText && <p className="font-semibold text-sm mt-1">{msg.overlayText}</p>}
            {msg.mediaUrl && mediaSrc && (
              <div className="relative mt-2 w-full h-32 rounded-lg overflow-hidden">
                {msg.type === 'photo' ? (
                  <img
                    src={mediaSrc}
                    alt="Chat media"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    style={{
                      filter: `brightness(${msg.brightness ?? 100}%) contrast(${msg.contrast ?? 100}%) saturate(${msg.saturation ?? 100}%)`,
                    }}
                  />
                ) : (
                  <video src={mediaSrc} controls className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
            )}
            {msg.description && <p className="text-xs mt-1 italic">{msg.description}</p>}
            <p className="text-xs text-neutral-lightGray mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</p>
            {msg.visibility === 'public' && (
              <div className="flex gap-2 mt-2">
                <motion.button
                  onClick={() => handleLike(msg.id)}
                  className={`text-sm ${msg.likes?.includes(currentUser?.uid || '') ? 'text-accent-gold' : 'text-neutral-lightGray'}`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label={msg.likes?.includes(currentUser?.uid || '') ? 'Unlike message' : 'Like message'}
                >
                  ❤️ {msg.likes?.length || 0}
                </motion.button>
                <motion.button
                  onClick={() => {
                    const comment = prompt('Enter your comment:');
                    if (comment) handleComment(msg.id, comment);
                  }}
                  className="text-sm text-neutral-lightGray"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Comment on message"
                >
                  💬 {msg.comments?.length || 0}
                </motion.button>
              </div>
            )}
            {msg.comments && msg.comments.length > 0 && (
              <div className="mt-2">
                {msg.comments.map((comment, idx) => (
                  <p key={idx} className="text-xs text-neutral-lightGray">
                    <span className="font-semibold">{usersData[comment.userId]?.displayName || 'Anonymous'}:</span>{' '}
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
          <span className="text-neutral-lightGray text-base sm:text-lg font-medium">Loading Chat...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center flex-col">
        <p className="text-red-500 text-sm sm:text-lg">{error}</p>
        <button
          onClick={() => navigate('/events')}
          className="mt-4 bg-accent-gold text-neutral-darkGray font-semibold rounded-full px-5 py-2 sm:px-6 sm:py-3 hover:bg-yellow-300 transition-all shadow-lg text-sm sm:text-base"
        >
          Back to Events
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray flex">
      {/* Sidebar */}
      <motion.div
        className={`fixed inset-y-0 left-0 w-80 bg-neutral-mediumGray/50 backdrop-blur-lg transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-20 shadow-xl border-r border-neutral-mediumGray/50`}
        initial={{ x: '-100%' }}
        animate={{ x: isSidebarOpen ? 0 : '-100%' }}
        transition={{ duration: 0.3 }}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <motion.h2
              className="text-xl sm:text-2xl font-bold text-accent-gold"
              initial="hidden"
              animate="visible"
              variants={headingFade}
            >
              Event Chats
              <span className="bg-red-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ml-2 sm:ml-3">
                {filteredEvents.length} Live
              </span>
            </motion.h2>
            <motion.button
              onClick={() => navigate('/events')}
              className="text-accent-gold hover:text-yellow-300 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Add New Event"
            >
              <FaPlus size={20} />
            </motion.button>
          </div>
          <input
            type="text"
            value={searchEventQuery}
            onChange={(e) => setSearchEventQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full p-2 sm:p-3 rounded-lg bg-neutral-mediumGray text-neutral-lightGray border border-neutral-mediumGray focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base"
          />
          <motion.div
            className="mt-4 sm:mt-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-mediumGray scrollbar-track-neutral-darkGray"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {filteredEvents.map((event) => (
              <motion.div
                key={event.id}
                className={`rounded-lg overflow-hidden shadow-md cursor-pointer relative ${
                  selectedEvent?.id === event.id ? 'border-2 border-accent-gold' : 'border border-neutral-mediumGray/50'
                }`}
                onClick={() => {
                  navigate(`/chat/${event.id}`);
                  setIsSidebarOpen(false);
                }}
                variants={fadeIn}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative w-full h-32">
                  <img
                    src={event.image || 'https://placehold.co/40x40?text=Event'}
                    alt={event.title || 'Event'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-3">
                    <h3 className="text-sm font-semibold text-accent-gold line-clamp-1">{event.title || 'Untitled Event'}</h3>
                    <p className="text-xs text-neutral-lightGray mt-1 line-clamp-1">
                      {new Date(event.date || event.createdAt || Date.now()).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-neutral-lightGray line-clamp-1">{event.location || 'Location TBD'}</p>
                  </div>
                  <span className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                    Live
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-neutral-mediumGray/50 backdrop-blur-lg shadow p-4 sm:p-6 flex justify-between items-center border-b border-neutral-mediumGray/50">
          <div className="flex items-center gap-3">
            <motion.button
              className="md:hidden text-accent-gold"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle sidebar"
            >
              <FaBars size={20} />
            </motion.button>
            <motion.h1
              className="text-xl sm:text-2xl font-bold text-accent-gold"
              initial="hidden"
              animate="visible"
              variants={headingFade}
            >
              <Link to={`/events?search=${selectedEvent?.title}`} className="hover:underline">
                {selectedEvent?.title || 'Untitled Event'}
              </Link>{' '}
              Chat
            </motion.h1>
          </div>
          <div className="flex gap-3">
            <motion.button
              onClick={() => setShowQRCode(true)}
              className="text-accent-gold hover:text-yellow-300 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Share invite link"
            >
              Share Invite
            </motion.button>
            <motion.button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative text-accent-gold"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle notifications"
            >
              <FaBell size={20} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </motion.button>
            <motion.button
              onClick={() => setShowSettings(!showSettings)}
              className="text-accent-gold"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle settings"
            >
              <FaCog size={20} />
            </motion.button>
          </div>
        </div>

        {/* Chat Messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-darkGray relative"
          style={{ maxHeight: 'calc(100vh - 200px)' }}
        >
          <input
            type="text"
            value={searchChatQuery}
            onChange={(e) => setSearchChatQuery(e.target.value)}
            placeholder="Search chat..."
            className="w-full p-2 sm:p-3 rounded-lg bg-neutral-mediumGray text-neutral-lightGray border border-neutral-mediumGray focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base mb-4"
          />
          {filteredMessages.length > 0 ? (
            <>
              {filteredMessages.map((msg) => (
                <MessageRow key={msg.id} msg={msg} />
              ))}
              {hasMoreMessages && (
                <motion.button
                  onClick={loadMoreMessages}
                  className="w-full p-2 sm:p-3 mt-2 text-accent-gold bg-neutral-mediumGray/50 backdrop-blur-lg rounded-lg hover:bg-neutral-mediumGray/80 transition-all shadow-md text-sm sm:text-base"
                  disabled={loadingMoreMessages}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {loadingMoreMessages ? 'Loading...' : 'Load More Messages'}
                </motion.button>
              )}
            </>
          ) : (
            <p className="text-neutral-lightGray text-center py-6 text-sm sm:text-base">No messages yet. Start the conversation!</p>
          )}
          <div ref={chatEndRef} />
          {showScrollToBottom && (
            <motion.button
              onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="fixed bottom-20 right-4 bg-accent-gold text-neutral-darkGray p-2 rounded-full shadow-lg"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Scroll to bottom"
            >
              <FaArrowDown size={20} />
            </motion.button>
          )}
        </div>

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="p-2 sm:p-3 text-sm text-neutral-lightGray">
            {typingUsers.map((userId) => usersData[userId]?.displayName || 'Someone').join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
          </div>
        )}

        {/* Message Input */}
        {selectedEvent && (
          <div className="p-4 sm:p-6 border-t border-neutral-mediumGray/50">
            {showMediaEditor && mediaFile && (
              <motion.div
                className="mb-4 p-4 sm:p-6 bg-neutral-mediumGray/50 backdrop-blur-lg rounded-lg shadow-md border border-neutral-mediumGray/50"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="relative w-full h-64 mb-4 rounded-lg overflow-hidden">
                  <Cropper
                    image={URL.createObjectURL(mediaFile)}
                    crop={crop}
                    zoom={zoom}
                    aspect={4 / 3}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm text-neutral-lightGray mb-1">Brightness</label>
                    <Slider
                      min={0}
                      max={200}
                      value={brightness}
                      onChange={(value: number | number[]) => {
                        if (typeof value === 'number') setBrightness(value);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-neutral-lightGray mb-1">Contrast</label>
                    <Slider
                      min={0}
                      max={200}
                      value={contrast}
                      onChange={(value: number | number[]) => {
                        if (typeof value === 'number') setContrast(value);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-neutral-lightGray mb-1">Saturation</label>
                    <Slider
                      min={0}
                      max={200}
                      value={saturation}
                      onChange={(value: number | number[]) => {
                        if (typeof value === 'number') setSaturation(value);
                      }}
                    />
                  </div>
                  <input
                    type="text"
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value)}
                    className="w-full p-2 sm:p-3 rounded-lg bg-neutral-mediumGray text-neutral-lightGray border border-neutral-mediumGray focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base"
                    placeholder="Overlay text"
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2 sm:p-3 rounded-lg bg-neutral-mediumGray text-neutral-lightGray border border-neutral-mediumGray focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base"
                    rows={3}
                    placeholder="Description"
                  />
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}
                    className="w-full p-2 sm:p-3 rounded-lg bg-neutral-mediumGray text-neutral-lightGray border border-neutral-mediumGray focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all text-sm sm:text-base"
                    aria-label="Select message visibility"
                  >
                    <option value="private">Private (Chat Only)</option>
                    <option value="public">Public (Chat & Feed)</option>
                  </select>
                  <div className="flex gap-2">
                    <motion.button
                      onClick={applyMediaEdits}
                      className="flex-1 p-2 sm:p-3 bg-accent-gold text-neutral-darkGray rounded-lg hover:bg-yellow-300 transition-all shadow-md text-sm sm:text-base"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Apply Edits
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        setShowMediaEditor(false);
                        setMediaFile(null);
                        setOverlayText('');
                        setDescription('');
                        setBrightness(100);
                        setContrast(100);
                        setSaturation(100);
                      }}
                      className="flex-1 p-2 sm:p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md text-sm sm:text-base"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
            <div className="flex items-start gap-3">
              <textarea
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  debouncedHandleTyping();
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(visibility);
                  }
                }}
                className="flex-1 p-3 rounded-lg bg-neutral-mediumGray text-neutral-lightGray border border-neutral-mediumGray focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all resize-none text-sm sm:text-base"
                rows={2}
                placeholder="Type your message..."
                disabled={uploading || (adminsOnlyTalk && currentUser && !selectedEvent.organizers.includes(currentUser.uid))}
                aria-label="Type your message"
              />
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 p-2 bg-neutral-mediumGray rounded-lg text-neutral-lightGray hover:bg-neutral-mediumGray/80 transition-all cursor-pointer">
                  {mediaFile?.type.startsWith('video') ? <FaVideo size={20} /> : <FaImage size={20} />}
                  <span className="sr-only">Upload media</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setMediaFile(file);
                      if (file) setShowMediaEditor(true);
                    }}
                    className="hidden"
                    disabled={uploading}
                    id="media-upload"
                  />
                </label>
                <motion.button
                  onClick={() => {
                    if (mediaFile) setShowMediaEditor(true);
                    else sendMessage(visibility);
                  }}
                  className="p-3 bg-accent-gold text-neutral-darkGray rounded-lg hover:bg-yellow-300 flex items-center justify-center disabled:opacity-50 transition-all shadow-md"
                  disabled={uploading || (!newMessage.trim() && !mediaFile)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Send message"
                >
                  {uploading ? (
                    <svg className="animate-spin h-5 w-5 text-neutral-darkGray" viewBox="0 0 24 24">
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
              </div>
            </div>
            {mediaFile && !showMediaEditor && (
              <div className="mt-2 flex items-center gap-2 text-neutral-lightGray">
                <span className="text-sm">{mediaFile.name}</span>
                <motion.button
                  onClick={() => setMediaFile(null)}
                  className="text-red-500 hover:text-red-400 transition-all"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Remove selected media"
                >
                  <FaTrash size={16} />
                </motion.button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRCode && selectedEvent && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            onClick={() => setShowQRCode(false)}
          >
            <motion.div
              ref={modalRef}
              onClick={(e) => e.stopPropagation()}
              className="bg-neutral-mediumGray/90 backdrop-blur-lg rounded-2xl max-w-md w-full mx-2 p-4 sm:p-6 relative shadow-2xl border border-neutral-mediumGray/50"
              role="dialog"
              aria-labelledby="qr-code-modal-title"
            >
              <motion.button
                type="button"
                onClick={() => setShowQRCode(false)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-neutral-lightGray hover:text-accent-gold transition-colors z-10"
                whileHover={{ scale: 1.2, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close modal"
              >
                <FaTimes size={20} />
              </motion.button>
              <motion.h2
                id="qr-code-modal-title"
                className="text-xl sm:text-2xl font-bold text-accent-gold mb-4 sm:mb-6 text-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {selectedEvent.title || 'Untitled Event'}
              </motion.h2>
              <CustomQRCode
                value={inviteLink}
                size={200}
                ariaLabel={`QR code for ${selectedEvent.title || 'event'} invite`}
              />
              <p className="mt-4 text-sm sm:text-base text-neutral-lightGray">
                Time: {new Date(selectedEvent.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-sm sm:text-base text-neutral-lightGray">
                Date: {new Date(selectedEvent.date || Date.now()).toLocaleDateString()}
              </p>
              <motion.button
                onClick={() => setShowQRCode(false)}
                className="w-full bg-accent-gold text-neutral-darkGray p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md mt-4 text-sm sm:text-base"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Close
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications Modal */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            className="fixed inset-0 md:inset-auto md:top-16 md:right-4 bg-black bg-opacity-70 md:bg-transparent backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            onClick={() => setShowNotifications(false)}
          >
            <motion.div
              ref={modalRef}
              onClick={(e) => e.stopPropagation()}
              className="bg-neutral-mediumGray/90 backdrop-blur-lg rounded-2xl max-w-md w-full mx-2 p-4 sm:p-6 relative shadow-2xl border border-neutral-mediumGray/50"
              role="dialog"
              aria-labelledby="notifications-modal-title"
            >
              <motion.button
                type="button"
                onClick={() => setShowNotifications(false)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-neutral-lightGray hover:text-accent-gold transition-colors z-10"
                whileHover={{ scale: 1.2, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close modal"
              >
                <FaTimes size={20} />
              </motion.button>
              <motion.h2
                id="notifications-modal-title"
                className="text-xl sm:text-2xl font-bold text-accent-gold mb-4 sm:mb-6 text-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                Notifications
              </motion.h2>
              <motion.button
                onClick={toggleNotifications}
                className="w-full p-2 sm:p-3 text-accent-gold bg-neutral-mediumGray/50 rounded-lg hover:bg-neutral-mediumGray/80 transition-all shadow-md mb-4 text-sm sm:text-base"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications'}
              </motion.button>
              <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-mediumGray scrollbar-track-neutral-darkGray space-y-2">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <motion.div
                      key={notif.id}
                      className={`p-2 sm:p-3 rounded-lg ${
                        notificationsEnabled ? 'bg-neutral-mediumGray/50' : 'bg-neutral-mediumGray/30 opacity-50'
                      } shadow-md border border-neutral-mediumGray/50`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <p className="text-neutral-lightGray text-sm">{notif.message}</p>
                      <p className="text-xs text-neutral-lightGray mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-neutral-lightGray text-center text-sm sm:text-base">No notifications.</p>
                )}
              </div>
              <motion.button
                onClick={() => setShowNotifications(false)}
                className="w-full bg-accent-gold text-neutral-darkGray p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md mt-4 text-sm sm:text-base"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Close
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && selectedEvent && (
          <motion.div
            className="fixed inset-0 md:inset-auto md:top-16 md:right-4 bg-black bg-opacity-70 md:bg-transparent backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              ref={modalRef}
              onClick={(e) => e.stopPropagation()}
              className="bg-neutral-mediumGray/90 backdrop-blur-lg rounded-2xl max-w-md w-full mx-2 p-4 sm:p-6 relative shadow-2xl border border-neutral-mediumGray/50"
              role="dialog"
              aria-labelledby="settings-modal-title"
            >
              <motion.button
                type="button"
                onClick={() => setShowSettings(false)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-neutral-lightGray hover:text-accent-gold transition-colors z-10"
                whileHover={{ scale: 1.2, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close modal"
              >
                <FaTimes size={20} />
              </motion.button>
              <motion.h2
                id="settings-modal-title"
                className="text-xl sm:text-2xl font-bold text-accent-gold mb-4 sm:mb-6 text-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                Chat Settings
              </motion.h2>
              <div className="space-y-2">
                {selectedEvent.organizers?.includes(currentUser?.uid) && (
                  <>
                    <motion.button
                      onClick={toggleAdminsOnlyTalk}
                      className="w-full flex items-center gap-2 p-2 sm:p-3 bg-neutral-mediumGray/50 rounded-lg text-neutral-lightGray hover:bg-neutral-mediumGray/80 transition-all shadow-md text-sm sm:text-base"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {adminsOnlyTalk ? <FaUnlock /> : <FaLock />}
                      <span>{adminsOnlyTalk ? 'Allow All to Talk' : 'Admins Only Talk'}</span>
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        const userId = prompt('Enter user ID to add as collaborator:', '');
                        if (userId) addCollaborator(userId);
                      }}
                      className="w-full p-2 sm:p-3 bg-neutral-mediumGray/50 rounded-lg text-neutral-lightGray hover:bg-neutral-mediumGray/80 transition-all shadow-md text-sm sm:text-base"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Add Collaborator
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        const newName = prompt('Enter new group name:', selectedEvent.title || 'Untitled Event');
                        if (newName) changeGroupName(newName);
                      }}
                      className="w-full p-2 sm:p-3 bg-neutral-mediumGray/50 rounded-lg text-neutral-lightGray hover:bg-neutral-mediumGray/80 transition-all shadow-md text-sm sm:text-base"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Change Group Name
                    </motion.button>
                    <motion.button
                      onClick={archiveChat}
                      className="w-full flex items-center gap-2 p-2 sm:p-3 bg-neutral-mediumGray/50 rounded-lg text-neutral-lightGray hover:bg-neutral-mediumGray/80 transition-all shadow-md text-sm sm:text-base"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FaArchive /> <span>Archive Chat</span>
                    </motion.button>
                  </>
                )}
                {selectedEvent.userId === currentUser?.uid && (
                  <motion.button
                    onClick={deleteChat}
                    className="w-full flex items-center gap-2 p-2 sm:p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md text-sm sm:text-base"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaTrash /> <span>Delete Chat</span>
                  </motion.button>
                )}
                <motion.button
                  onClick={leaveGroup}
                  className="w-full flex items-center gap-2 p-2 sm:p-3 bg-neutral-mediumGray/50 rounded-lg text-neutral-lightGray hover:bg-neutral-mediumGray/80 transition-all shadow-md text-sm sm:text-base"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaSignOutAlt /> <span>Leave Group</span>
                </motion.button>
              </div>
              <motion.button
                onClick={() => setShowSettings(false)}
                className="w-full bg-accent-gold text-neutral-darkGray p-2 sm:p-3 rounded-lg hover:bg-yellow-300 transition-all shadow-md mt-4 text-sm sm:text-base"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Close
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Chat;