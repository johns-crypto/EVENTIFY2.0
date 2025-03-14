import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage, getUserEvents } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion } from 'framer-motion';
import { FaPaperPlane, FaImage, FaVideo } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

interface Message {
  id: string;
  text?: string;
  mediaUrl?: string;
  type?: 'photo' | 'video';
  userId: string;
  createdAt: string;
  visibility: 'private' | 'public';
}

function Chat() {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    getUserEvents(currentUser.uid)
      .then((userEvents) => {
        const accessibleEvents = userEvents.filter(
          (e) => e.organizers.includes(currentUser.uid) || e.invitedUsers.includes(currentUser.uid)
        );
        setEvents(accessibleEvents);
        if (accessibleEvents.length > 0) setSelectedEvent(accessibleEvents[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentUser]);

  useEffect(() => {
    if (!selectedEvent) return;
    const q = query(collection(db, 'events', selectedEvent.id, 'chat'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Message)));
      },
      (err) => toast.error('Failed to load chat: ' + err.message)
    );
    return () => unsubscribe();
  }, [selectedEvent]);

  const sendMessage = async () => {
    if (!selectedEvent || !currentUser || (!newMessage.trim() && !mediaFile)) return;
    try {
      let mediaUrl = '';
      if (mediaFile) {
        const storageRef = ref(storage, `chat/${selectedEvent.id}/${mediaFile.name}`);
        await uploadBytes(storageRef, mediaFile);
        mediaUrl = await getDownloadURL(storageRef);
        if (visibility === 'public') {
          await addDoc(collection(db, 'events', selectedEvent.id, 'posts'), {
            userId: currentUser.uid,
            mediaUrl,
            type: mediaFile.type.startsWith('image') ? 'photo' : 'video',
            visibility: 'public',
            likes: [],
            comments: [],
            createdAt: new Date().toISOString(),
          });
        }
      }
      await addDoc(collection(db, 'events', selectedEvent.id, 'chat'), {
        text: newMessage || '',
        mediaUrl,
        type: mediaFile?.type.startsWith('image')
          ? 'photo'
          : mediaFile?.type.startsWith('video')
          ? 'video'
          : undefined,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        visibility,
      });
      setNewMessage('');
      setMediaFile(null);
      setVisibility('private');
    } catch (err: any) {
      toast.error('Failed to send message: ' + err.message);
    }
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  if (loading)
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

  return (
    <div className="min-h-screen bg-neutral-darkGray flex">
      <div className="w-64 bg-primary-navy p-4 shadow-lg overflow-y-auto">
        <h2 className="text-xl font-semibold text-accent-gold mb-4">Event Chats</h2>
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => setSelectedEvent(event)}
            className={`p-3 mb-2 rounded-lg cursor-pointer ${
              selectedEvent?.id === event.id
                ? 'bg-secondary-deepRed text-neutral-lightGray'
                : 'bg-neutral-offWhite text-neutral-darkGray'
            } hover:bg-secondary-darkRed transition-colors`}
          >
            {event.title}
          </div>
        ))}
      </div>
      <motion.div className="flex-1 p-6" initial="hidden" animate="visible" variants={fadeIn}>
        {selectedEvent ? (
          <>
            <h2 className="text-2xl font-semibold text-accent-gold mb-4">
              <Link to={`/events?search=${selectedEvent.title}`} className="hover:underline">
                {selectedEvent.title}
              </Link>{' '}
              Chat
            </h2>
            <div className="bg-primary-navy h-[calc(100vh-16rem)] rounded-lg p-4 overflow-y-auto shadow-inner">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={`mb-4 flex ${msg.userId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div
                    className={`max-w-xs p-3 rounded-lg ${
                      msg.userId === currentUser?.uid
                        ? 'bg-secondary-deepRed text-neutral-lightGray'
                        : 'bg-neutral-offWhite text-neutral-darkGray'
                    }`}
                  >
                    {msg.text && <p>{msg.text}</p>}
                    {msg.mediaUrl &&
                      (msg.type === 'photo' ? (
                        <img src={msg.mediaUrl} alt="Chat media" className="max-w-full h-auto rounded mt-2" />
                      ) : (
                        <video src={msg.mediaUrl} controls className="max-w-full h-32 rounded mt-2" />
                      ))}
                    <p className="text-xs opacity-75 mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 flex items-center space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 p-3 rounded-l-lg bg-neutral-offWhite text-neutral-darkGray focus:outline-none focus:ring-2 focus:ring-accent-gold"
                placeholder="Type a message..."
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                className="hidden"
                id="media-upload"
              />
              <label
                htmlFor="media-upload"
                className="p-3 bg-secondary-deepRed text-neutral-lightGray hover:bg-secondary-darkRed cursor-pointer"
              >
                {mediaFile?.type.startsWith('video') ? <FaVideo size={20} /> : <FaImage size={20} />}
              </label>
              <div>
                <label htmlFor="visibilitySelect" className="sr-only">
                  Message Visibility
                </label>
                <select
                  id="visibilitySelect"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}
                  className="p-3 bg-neutral-offWhite text-neutral-darkGray"
                  disabled={selectedEvent.visibility === 'private'}
                >
                  <option value="private">Private</option>
                  <option value="public" disabled={selectedEvent.visibility === 'private'}>
                    Public
                  </option>
                </select>
              </div>
              <button
                onClick={sendMessage}
                className="p-3 rounded-r-lg bg-secondary-deepRed hover:bg-secondary-darkRed transition-colors"
                aria-label="Send Message"
              >
                <FaPaperPlane size={20} className="text-neutral-lightGray" />
              </button>
            </div>
            {mediaFile && (
              <Link to="/media-editor" className="mt-2 text-accent-gold hover:underline">
                Edit Media Before Posting
              </Link>
            )}
          </>
        ) : (
          <p className="text-neutral-lightGray text-center mt-20">Select an event to start chatting.</p>
        )}
      </motion.div>
    </div>
  );
}

export default Chat;