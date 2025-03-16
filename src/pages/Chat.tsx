// src/pages/Chat.tsx
import { useState, useEffect } from 'react';
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
} from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion } from 'framer-motion';
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
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import CustomQRCode from '../components/CustomQRCode';
import Cropper from 'react-easy-crop';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import './Chat.css';

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
}

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'invite' | 'post';
  message: string;
  postId?: string;
  eventId: string;
  createdAt: string;
}

function Chat() {
  const { eventId } = useParams<{ eventId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
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

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);
    console.log('Fetching user data for UID:', currentUser.uid);

    getUserData(currentUser.uid)
      .then(async (userData) => {
        if (!userData) {
          console.warn('No user document found for UID:', currentUser.uid);
          toast.info('Creating user profile...');
          try {
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
            console.log('User document created for UID:', currentUser.uid);
            setNotificationsEnabled(true);
          } catch (err: unknown) {
            console.error('Failed to create user document:', err);
            setError(`Failed to create user profile: ${(err as Error).message}`);
            toast.error('Failed to create user profile.');
            setLoading(false);
            navigate('/profile');
            return;
          }
        } else {
          setNotificationsEnabled(userData.notificationsEnabled ?? true);
        }

        getUserEvents(currentUser.uid)
          .then((userEvents) => {
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
              } catch (e: unknown) {
                console.error('Invalid inviteLink:', link, e);
                setInviteLink('https://eventify-ab64e.web.app/default-invite');
              }
            } else {
              setError('Event not found or you do not have access.');
              toast.error('Event not found or you do not have access.');
              navigate('/events');
            }
            setLoading(false);
          })
          .catch((err: unknown) => {
            console.error('Failed to fetch events:', err);
            setError(`Failed to load events: ${(err as Error).message}`);
            toast.error('Failed to load events.');
            setLoading(false);
            navigate('/events');
          });
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch user data:', err);
        setError(`Failed to load user data: ${(err as Error).message}`);
        toast.error('Failed to load user data.');
        setLoading(false);
        navigate('/profile');
      });
  }, [currentUser, eventId, navigate]);

  useEffect(() => {
    if (!selectedEvent || !selectedEvent.id) {
      setMessages([]);
      setInviteLink('');
      return;
    }
    const q = query(collection(db, 'events', selectedEvent.id, 'chat'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        setMessages(
          snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...doc.data(),
          }) as Message)
        );
      },
      (err: unknown) => {
        console.error('Failed to load chat:', err);
        setError(`Failed to load chat: ${(err as Error).message}`);
        toast.error('Failed to load chat.');
      }
    );
    const link = selectedEvent.inviteLink || 'https://eventify-ab64e.web.app/default-invite';
    try {
      new URL(link);
      setInviteLink(link);
    } catch (e: unknown) {
      console.error('Invalid inviteLink:', link, e);
      setInviteLink('https://eventify-ab64e.web.app/default-invite');
    }
    return () => unsubscribe();
  }, [selectedEvent]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    const q = query(collection(db, 'users', currentUser.uid, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        setNotifications(
          snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...doc.data(),
          }) as Notification)
        );
      },
      (err: unknown) => {
        console.error('Failed to load notifications:', err);
        const errorMessage = (err as Error).message;
        setError(`Failed to load notifications: ${errorMessage}`);
        if (!errorMessage.includes('Missing or insufficient permissions')) {
          toast.error('Failed to load notifications.');
        }
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const sendMessage = async (postVisibility: 'private' | 'public') => {
    if (!selectedEvent || !currentUser || (!newMessage.trim() && !mediaFile)) return;

    try {
      let mediaUrl = '';
      let type: 'photo' | 'video' | undefined = undefined;

      if (mediaFile) {
        const storageRef = ref(storage, `chat/${selectedEvent.id}/${mediaFile.name}-${Date.now()}`);
        await uploadBytes(storageRef, mediaFile);
        mediaUrl = await getDownloadURL(storageRef);

        // Determine type only if mediaFile is valid
        if (mediaFile.type.startsWith('image')) {
          type = 'photo';
        } else if (mediaFile.type.startsWith('video')) {
          type = 'video';
        }
      }

      // Prepare the chat message data
      const chatData = {
        text: newMessage || '',
        mediaUrl: mediaUrl || null, // Explicitly set to null if no media
        ...(type && { type }), // Include type only if defined
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        visibility: postVisibility,
        description: description || '',
        overlayText: overlayText || '',
      };

      await addDoc(collection(db, 'events', selectedEvent.id, 'chat'), chatData);

      // Handle public post creation if visibility is public
      if (mediaFile && postVisibility === 'public') {
        const postDoc = await addDoc(collection(db, 'events', selectedEvent.id, 'posts'), {
          userId: currentUser.uid,
          eventId: selectedEvent.id,
          mediaUrl,
          type: type || 'photo', // Default to 'photo' if type is undefined (should not happen)
          visibility: 'public',
          likes: [],
          comments: [],
          createdAt: new Date().toISOString(),
          description: description || '',
        });
        await addDoc(collection(db, 'users', selectedEvent.organizers[0], 'notifications'), {
          type: 'post',
          message: `${currentUser.displayName || 'A user'} posted in ${selectedEvent.title || 'an event'}`,
          eventId: selectedEvent.id,
          postId: postDoc.id,
          createdAt: new Date().toISOString(),
        });
      }

      setNewMessage('');
      setMediaFile(null);
      setOverlayText('');
      setDescription('');
      setShowMediaEditor(false);
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
    } catch (err: unknown) {
      console.error('Failed to send message:', err);
      setError(`Failed to send message: ${(err as Error).message}`);
      toast.error('Failed to send message.');
    }
  };

  const handleLike = async (messageId: string) => {
    if (!currentUser || !selectedEvent) return;
    const message = messages.find((msg) => msg.id === messageId);
    if (!message) return;
    const messageRef = doc(db, 'events', selectedEvent.id, 'chat', messageId);
    const likes = message.likes?.includes(currentUser.uid)
      ? message.likes.filter((id) => id !== currentUser.uid)
      : [...(message.likes || []), currentUser.uid];
    await updateDoc(messageRef, { likes });
    if (likes.includes(currentUser.uid)) {
      await addDoc(collection(db, 'users', message.userId, 'notifications'), {
        type: 'like',
        message: `${currentUser.displayName || 'A user'} liked your post in ${selectedEvent.title || 'an event'}`,
        eventId: selectedEvent.id,
        postId: messageId,
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleComment = async (messageId: string, commentText: string) => {
    if (!currentUser || !selectedEvent || !commentText.trim()) return;
    const message = messages.find((msg) => msg.id === messageId);
    if (!message) return;
    const messageRef = doc(db, 'events', selectedEvent.id, 'chat', messageId);
    const comments = [...(message.comments || []), { userId: currentUser.uid, text: commentText }];
    await updateDoc(messageRef, { comments });
    await addDoc(collection(db, 'users', message.userId, 'notifications'), {
      type: 'comment',
      message: `${currentUser.displayName || 'A user'} commented on your post in ${selectedEvent.title || 'an event'}`,
      eventId: selectedEvent.id,
      postId: messageId,
      createdAt: new Date().toISOString(),
    });
  };

  const addCollaborator = async (userId: string) => {
    if (!currentUser || !selectedEvent?.organizers?.includes(currentUser.uid)) return;
    const eventRef = doc(db, 'events', selectedEvent.id);
    await updateDoc(eventRef, { organizers: [...selectedEvent.organizers, userId] });
    await addDoc(collection(db, 'events', selectedEvent.id, 'chat'), {
      text: `${userId} has been added as a collaborator.`,
      userId: currentUser.uid,
      createdAt: new Date().toISOString(),
      visibility: 'private',
    });
  };

  const toggleAdminsOnlyTalk = async () => {
    if (!currentUser || !selectedEvent?.organizers?.includes(currentUser.uid)) return;
    setAdminsOnlyTalk(!adminsOnlyTalk);
    await addDoc(collection(db, 'events', selectedEvent.id, 'chat'), {
      text: `Chat mode: ${!adminsOnlyTalk ? 'Admins only' : 'All members'}`,
      userId: currentUser.uid,
      createdAt: new Date().toISOString(),
      visibility: 'private',
    });
  };

  const deleteChat = async () => {
    if (!currentUser || selectedEvent?.userId !== currentUser.uid) return;
    setEvents(events.filter((e) => e.id !== selectedEvent.id));
    setSelectedEvent(null);
    navigate('/events');
  };

  const leaveGroup = async () => {
    if (!currentUser || !selectedEvent) return;
    const eventRef = doc(db, 'events', selectedEvent.id);
    await updateDoc(eventRef, {
      organizers: selectedEvent.organizers.filter((id: string) => id !== currentUser.uid),
      invitedUsers: selectedEvent.invitedUsers.filter((id: string) => id !== currentUser.uid),
    });
    setEvents(events.filter((e) => e.id !== selectedEvent.id));
    setSelectedEvent(null);
    navigate('/events');
  };

  const archiveChat = async () => {
    if (!currentUser || !selectedEvent?.organizers?.includes(currentUser.uid)) return;
    const eventRef = doc(db, 'events', selectedEvent.id);
    await updateDoc(eventRef, { archived: true });
    setEvents(events.filter((e) => e.id !== selectedEvent.id));
    setSelectedEvent(null);
    navigate('/events');
  };

  const changeGroupName = async (newName: string) => {
    if (!currentUser || !selectedEvent?.organizers?.includes(currentUser.uid)) return;
    const eventRef = doc(db, 'events', selectedEvent.id);
    await updateDoc(eventRef, { title: newName });
    setSelectedEvent({ ...selectedEvent, title: newName });
  };

  const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const getCroppedImg = async () => {
    if (!croppedAreaPixels) {
      throw new Error('Cropped area is not defined');
    }
    const canvas = document.createElement('canvas');
    const image = new Image();
    image.src = URL.createObjectURL(mediaFile!);
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
    } catch (err: unknown) {
      console.error('Failed to apply media edits:', err);
      setError(`Failed to apply edits: ${(err as Error).message}`);
      toast.error('Failed to apply edits.');
    }
  };

  const toggleNotifications = async () => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, { notificationsEnabled: !notificationsEnabled });
    setNotificationsEnabled(!notificationsEnabled);
  };

  const filteredEvents = events.filter((event) =>
    event?.title?.toLowerCase().includes(searchEventQuery.toLowerCase()) || false
  );

  const filteredMessages = messages.filter((msg) =>
    msg.text?.toLowerCase().includes(searchChatQuery.toLowerCase()) || false
  );

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-accent-gold" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            className="opacity-75"
          />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center">
        <div className="text-center text-neutral-lightGray">
          <h2 className="text-2xl font-semibold text-red-500 mb-2">Error</h2>
          <p>{error}</p>
          <button
            onClick={() => navigate('/events')}
            className="mt-4 bg-accent-gold text-white p-3 rounded-xl hover:bg-opacity-90 transition-all"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-darkGray flex">
      {/* Sidebar */}
      <div className="w-64 bg-primary-navy p-4 shadow-lg overflow-y-auto rounded-r-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-accent-gold">Event Chats</h2>
          <button
            onClick={() => navigate('/events')}
            className="text-accent-gold hover:text-secondary-deepRed"
            aria-label="Add New Event"
            title="Add New Event"
          >
            <FaPlus size={20} />
          </button>
        </div>
        <div className="mb-4">
          <input
            type="text"
            value={searchEventQuery}
            onChange={(e) => setSearchEventQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full p-3 rounded-xl bg-neutral-offWhite text-neutral-darkGray focus:outline-none focus:ring-2 focus:ring-accent-gold"
          />
        </div>
        {filteredEvents.map((event) => (
          <div
            key={event?.id || Math.random()}
            onClick={() => navigate(`/chat/${event.id}`)}
            className={`p-3 mb-2 rounded-xl cursor-pointer flex items-center space-x-2 ${
              selectedEvent?.id === event?.id
                ? 'bg-secondary-deepRed text-neutral-lightGray'
                : 'bg-neutral-offWhite text-neutral-darkGray'
            } hover:bg-secondary-darkRed transition-colors`}
          >
            <img
              src={event?.image || 'https://placehold.co/40x40?text=Event'}
              alt={event?.title || 'Event'}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <p className="font-semibold">{event?.title || 'Untitled Event'}</p>
              <p className="text-sm opacity-75">
                {new Date(event?.date || event?.createdAt || Date.now()).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Chat Area */}
      <motion.div className="flex-1 p-6 flex flex-col" initial="hidden" animate="visible" variants={fadeIn}>
        {selectedEvent ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-accent-gold">
                <Link to={`/events?search=${selectedEvent.title}`} className="hover:underline">
                  {selectedEvent.title || 'Untitled Event'}
                </Link>{' '}
                Chat
              </h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowQRCode(true)}
                  className="text-accent-gold hover:text-secondary-deepRed"
                  title="Share Invite Link"
                >
                  Share Invite
                </button>
                <button
                  onClick={() => setShowNotifications(true)}
                  className="relative"
                  aria-label="View Notifications"
                  title="View Notifications"
                >
                  <FaBell size={20} className="text-accent-gold" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-secondary-deepRed text-neutral-lightGray text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  aria-label="Chat Settings"
                  title="Chat Settings"
                >
                  <FaCog size={20} className="text-accent-gold" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="bg-primary-navy h-[calc(100vh-16rem)] rounded-xl p-4 overflow-y-auto shadow-inner">
              <input
                type="text"
                value={searchChatQuery}
                onChange={(e) => setSearchChatQuery(e.target.value)}
                placeholder="Search chat..."
                className="w-full p-3 mb-4 rounded-xl bg-neutral-offWhite text-neutral-darkGray focus:outline-none focus:ring-2 focus:ring-accent-gold"
              />
              {filteredMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={`mb-4 flex ${msg.userId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div
                    className={`max-w-xs p-3 rounded-xl ${
                      msg.userId === currentUser?.uid
                        ? 'bg-secondary-deepRed text-neutral-lightGray'
                        : 'bg-neutral-offWhite text-neutral-darkGray'
                    }`}
                  >
                    {msg.text && <p>{msg.text}</p>}
                    {msg.overlayText && <p className="font-semibold">{msg.overlayText}</p>}
                    {msg.mediaUrl &&
                      (msg.type === 'photo' ? (
                        <img src={msg.mediaUrl} alt="Chat media" className="chat-media rounded-xl" />
                      ) : (
                        <video src={msg.mediaUrl} controls className="max-w-full h-32 rounded-xl mt-2" />
                      ))}
                    {msg.description && <p className="text-sm mt-2">{msg.description}</p>}
                    <p className="text-xs opacity-75 mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                    {msg.visibility === 'public' && (
                      <div className="mt-2">
                        <button onClick={() => handleLike(msg.id)} className="text-sm mr-2">
                          {msg.likes?.includes(currentUser?.uid || '') ? 'Unlike' : 'Like'} ({msg.likes?.length || 0})
                        </button>
                        <button
                          onClick={() => {
                            const text = prompt('Enter comment:', '');
                            if (text) handleComment(msg.id, text);
                          }}
                          className="text-sm"
                        >
                          Comment ({msg.comments?.length || 0})
                        </button>
                        {msg.comments?.map((comment, idx) => (
                          <p key={idx} className="text-xs mt-1">{comment.userId}: {comment.text}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Message Input */}
            <div className="mt-4 flex items-center space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 p-3 rounded-xl bg-neutral-offWhite text-neutral-darkGray focus:outline-none focus:ring-2 focus:ring-accent-gold"
                placeholder="Your message"
                onKeyPress={(e) => e.key === 'Enter' && sendMessage(visibility)}
                disabled={adminsOnlyTalk && !selectedEvent?.organizers?.includes(currentUser?.uid)}
              />
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setMediaFile(file);
                  if (file) setShowMediaEditor(true);
                }}
                className="hidden"
                id="media-upload"
              />
              <label htmlFor="media-upload" className="p-3 bg-secondary-deepRed text-neutral-lightGray hover:bg-secondary-darkRed cursor-pointer rounded-xl">
                {mediaFile?.type.startsWith('video') ? <FaVideo size={20} /> : <FaImage size={20} />}
              </label>
              <button
                onClick={() => {
                  if (mediaFile) setShowMediaEditor(true);
                  else sendMessage(visibility);
                }}
                className="p-3 rounded-xl bg-secondary-deepRed hover:bg-secondary-darkRed transition-colors"
                aria-label="Send Message"
                title="Send Message"
              >
                <FaPaperPlane size={20} className="text-neutral-lightGray" />
                <span className="sr-only">Send Message</span>
              </button>
            </div>
          </>
        ) : (
          <p className="text-neutral-lightGray text-center mt-20">Select an event to start chatting.</p>
        )}
      </motion.div>

      {/* Media Editor Modal */}
      {showMediaEditor && mediaFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-neutral-offWhite p-6 rounded-3xl shadow-lg max-w-lg w-full">
            <h2 className="text-xl font-semibold text-neutral-darkGray mb-4">Edit Media</h2>
            <div className="relative w-full h-64 mb-4 rounded-xl overflow-hidden">
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
              <label htmlFor="brightness" className="block text-neutral-darkGray">Brightness</label>
              <Slider
                min={0}
                max={200}
                value={brightness}
                onChange={(value: number | number[]) => {
                  if (typeof value === 'number') setBrightness(value);
                }}
              />
              <label htmlFor="contrast" className="block text-neutral-darkGray">Contrast</label>
              <Slider
                min={0}
                max={200}
                value={contrast}
                onChange={(value: number | number[]) => {
                  if (typeof value === 'number') setContrast(value);
                }}
              />
              <label htmlFor="saturation" className="block text-neutral-darkGray">Saturation</label>
              <Slider
                min={0}
                max={200}
                value={saturation}
                onChange={(value: number | number[]) => {
                  if (typeof value === 'number') setSaturation(value);
                }}
              />
              <label htmlFor="overlay-text" className="block text-neutral-darkGray">Overlay Text</label>
              <input
                id="overlay-text"
                type="text"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                className="w-full p-3 rounded-xl bg-neutral-offWhite text-neutral-darkGray border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold"
              />
              <label htmlFor="description" className="block text-neutral-darkGray">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 rounded-xl bg-neutral-offWhite text-neutral-darkGray border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold"
                rows={3}
              />
            </div>
            <div className="flex space-x-2 mt-4">
              <button
                onClick={applyMediaEdits}
                className="w-full bg-accent-gold text-neutral-lightGray p-3 rounded-xl hover:bg-opacity-90 transition-all"
                aria-label="Apply Edits"
              >
                Apply Edits
              </button>
              <button
                onClick={() => {
                  setShowMediaEditor(false);
                  setMediaFile(null);
                }}
                className="w-full bg-gray-500 text-neutral-lightGray p-3 rounded-xl hover:bg-opacity-90 transition-all"
                aria-label="Cancel"
              >
                Cancel
              </button>
            </div>
            <div className="mt-4">
              <label htmlFor="visibility" className="block text-neutral-darkGray">Post Visibility:</label>
              <select
                id="visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}
                className="w-full p-3 rounded-xl bg-neutral-offWhite text-neutral-darkGray border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold"
              >
                <option value="private">Private (Chat Only)</option>
                <option value="public">Public (Chat & Feed)</option>
              </select>
              <button
                onClick={() => sendMessage(visibility)}
                className="w-full bg-accent-gold text-neutral-lightGray p-3 rounded-xl hover:bg-opacity-90 transition-all mt-2"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRCode && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-primary-navy text-neutral-lightGray p-6 rounded-3xl shadow-lg max-w-sm w-full">
            <h2 className="text-xl font-semibold mb-4">{selectedEvent.title || 'Untitled Event'}</h2>
            <CustomQRCode
              value={inviteLink}
              size={200}
              ariaLabel={`QR code for ${selectedEvent.title || 'event'} invite`}
            />
            <p className="mt-4">
              Time: {new Date(selectedEvent.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p>Date: {new Date(selectedEvent.date || Date.now()).toLocaleDateString()}</p>
            <button
              onClick={() => setShowQRCode(false)}
              className="w-full bg-secondary-deepRed text-neutral-lightGray p-3 rounded-xl hover:bg-opacity-90 transition-all mt-4"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <div className="fixed top-16 right-4 bg-neutral-offWhite p-4 rounded-3xl shadow-lg max-w-sm w-full">
          <h2 className="text-xl font-semibold text-neutral-darkGray mb-4">Notifications</h2>
          <button onClick={toggleNotifications} className="text-sm text-accent-gold mb-2">
            {notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications'}
          </button>
          {notifications.map((notif) => (
            <div key={notif.id} className={`p-2 mb-2 rounded-xl ${notificationsEnabled ? 'bg-gray-100' : 'bg-gray-50 opacity-50'}`}>
              <p className="text-neutral-darkGray">{notif.message}</p>
              <p className="text-xs text-neutral-darkGray">{new Date(notif.createdAt).toLocaleString()}</p>
            </div>
          ))}
          <button onClick={() => setShowNotifications(false)} className="w-full bg-accent-gold text-neutral-lightGray p-3 rounded-xl hover:bg-opacity-90 transition-all mt-2">
            Close
          </button>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && selectedEvent && (
        <div className="fixed top-16 right-4 bg-neutral-offWhite p-4 rounded-3xl shadow-lg max-w-sm w-full">
          <h2 className="text-xl font-semibold text-neutral-darkGray mb-4">Chat Settings</h2>
          {selectedEvent.organizers?.includes(currentUser?.uid) && (
            <>
              <button onClick={toggleAdminsOnlyTalk} className="w-full flex items-center space-x-2 p-3 bg-gray-100 rounded-xl mb-2">
                {adminsOnlyTalk ? <FaUnlock /> : <FaLock />}
                <span className="text-neutral-darkGray">{adminsOnlyTalk ? 'Allow All to Talk' : 'Admins Only Talk'}</span>
              </button>
              <button
                onClick={() => {
                  const userId = prompt('Enter user ID to add as collaborator:', '');
                  if (userId) addCollaborator(userId);
                }}
                className="w-full p-3 bg-gray-100 rounded-xl mb-2 text-neutral-darkGray"
                aria-label="Add Collaborator"
                title="Add Collaborator"
              >
                Add Collaborator
              </button>
              <button
                onClick={() => {
                  const newName = prompt('Enter new group name:', selectedEvent.title || 'Untitled Event');
                  if (newName) changeGroupName(newName);
                }}
                className="w-full p-3 bg-gray-100 rounded-xl mb-2 text-neutral-darkGray"
              >
                Change Group Name
              </button>
              <button onClick={archiveChat} className="w-full flex items-center space-x-2 p-3 bg-gray-100 rounded-xl mb-2">
                <FaArchive /> <span className="text-neutral-darkGray">Archive Chat</span>
              </button>
            </>
          )}
          {selectedEvent.userId === currentUser?.uid && (
            <button onClick={deleteChat} className="w-full flex items-center space-x-2 p-3 bg-secondary-deepRed text-neutral-lightGray rounded-xl mb-2">
              <FaTrash /> <span>Delete Chat</span>
            </button>
          )}
          <button onClick={leaveGroup} className="w-full flex items-center space-x-2 p-3 bg-gray-100 rounded-xl mb-2">
            <FaSignOutAlt /> <span className="text-neutral-darkGray">Leave Group</span>
          </button>
          <button onClick={() => setShowSettings(false)} className="w-full bg-accent-gold text-neutral-lightGray p-3 rounded-xl hover:bg-opacity-90 transition-all mt-2">
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default Chat;