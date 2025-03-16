import { useState, useEffect } from 'react';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, getEvents, EventData, getUserData } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaCheck } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import { createGroupChat } from '../services/firebase';

interface UserData {
  displayName: string;
  email: string;
  photoURL: string;
  followers: string[];
}

function Events() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventData[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [step, setStep] = useState(1);
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    location: '',
    date: '',
    visibility: 'public' as 'public' | 'private',
    organizers: [] as string[],
    inviteLink: '',
    image: null as File | null,
    description: '',
    croppedImage: null as string | null,
  });
  const [followers, setFollowers] = useState<UserData[]>([]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
  const stagger = { visible: { transition: { staggerChildren: 0.2 } } };
  const headingFade = {
    hidden: { opacity: 0, y: -30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut', type: 'spring', bounce: 0.3 } },
  };
  const textVariants = {
    hidden: { opacity: 0, x: -10, width: 0 },
    visible: { opacity: 1, x: 0, width: 'auto', transition: { duration: 0.3, ease: 'easeInOut' } },
    exit: { opacity: 0, x: -10, width: 0, transition: { duration: 0.3, ease: 'easeInOut' } },
  };

  useEffect(() => {
    fetchEvents();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      getUserData(currentUser.uid).then((user) => {
        if (user) {
          setUserPhotoURL(user.photoURL || 'https://picsum.photos/300/200');
          setFollowers(user.followers.map((uid) => ({ displayName: uid, email: '', photoURL: '', followers: [] })));
        }
      });
    }
  }, [currentUser]);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const eventsData = await getEvents();
      setEvents(eventsData);
      filterEvents(eventsData);
    } catch (err: any) {
      setError('Failed to fetch events: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterEvents = (eventsData: EventData[]) => {
    let result = [...eventsData];
    if (searchQuery) {
      result = result.filter((e) => e.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (searchDate) {
      const [month, day] = searchDate.split('-');
      result = result.filter((e) => {
        const eventDate = new Date(e.date || e.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
        return eventDate === `${month}-${day}`;
      });
    }
    setFilteredEvents(result);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    filterEvents(events);
  };

  const handleDateSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setSearchDate(date);
    filterEvents(events);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchDate('');
    filterEvents(events);
  };

  const requestInvite = async (eventId: string) => {
    if (!currentUser) return setError('Please log in to request an invite.');
    try {
      const eventRef = doc(db, 'events', eventId);
      const event = events.find((e) => e.id === eventId);
      if (event && !event.pendingInvites.includes(currentUser.uid)) {
        await updateDoc(eventRef, { pendingInvites: [...event.pendingInvites, currentUser.uid] });
        fetchEvents();
      }
    } catch (err) {
      setError('Failed to request invite.');
    }
  };

  const handleNextStep = () => setStep((prev) => prev + 1);
  const handlePrevStep = () => setStep((prev) => prev - 1);

  const handleCreateEvent = async () => {
    if (!currentUser) return setError('Please log in to create an event.');
    setLoading(true);
    try {
      let imageUrl = newEvent.croppedImage || userPhotoURL || '';
      if (newEvent.image && !newEvent.croppedImage) {
        const storageRef = ref(storage, `events/${newEvent.image.name}-${Date.now()}`);
        await uploadBytes(storageRef, newEvent.image);
        imageUrl = await getDownloadURL(storageRef);
      }
      const eventData = {
        title: newEvent.title,
        location: newEvent.location,
        date: newEvent.date,
        description: newEvent.description,
        category: 'Refreshments',
        userId: currentUser.uid,
        organizers: [currentUser.uid, ...newEvent.organizers],
        visibility: newEvent.visibility,
        inviteLink: `https://eventify.com/invite/${Date.now()}`,
        invitedUsers: [],
        pendingInvites: [],
        image: imageUrl,
        createdAt: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, 'events'), eventData);
      await createGroupChat(docRef.id, newEvent.title, [currentUser.uid, ...newEvent.organizers], eventData.invitedUsers);
      setNewEvent({
        title: '',
        location: '',
        date: '',
        visibility: 'public',
        organizers: [],
        inviteLink: '',
        image: null,
        description: '',
        croppedImage: null,
      });
      setStep(1);
      setShowCreateEventModal(false);
      fetchEvents();
    } catch (err: any) {
      console.error('Detailed error in handleCreateEvent:', err);
      setError(`Failed to create event: ${err.message}`);
    } finally {
      setLoading(false);
    }
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
    image.src = URL.createObjectURL(newEvent.image!);
    await new Promise((resolve) => (image.onload = resolve));
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(
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
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg'));
  };

  const handleCropImage = async () => {
    try {
      const croppedBlob = await getCroppedImg();
      const croppedFile = new File([croppedBlob as Blob], 'cropped.jpg', { type: 'image/jpeg' });
      const storageRef = ref(storage, `events/cropped-${Date.now()}.jpg`);
      await uploadBytes(storageRef, croppedFile);
      const url = await getDownloadURL(storageRef);
      setNewEvent((prev) => ({ ...prev, croppedImage: url }));
      handleNextStep();
    } catch (err: any) {
      setError('Failed to crop image: ' + err.message);
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
            <div className="relative flex items-center group">
              <button
                onClick={() => setShowCreateEventModal(true)}
                className="text-accent-gold hover:text-secondary-deepRed transition-colors"
                aria-label="Create Event"
              >
                <FaPlus size={24} />
              </button>
              <AnimatePresence>
                <motion.span
                  variants={textVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="ml-2 text-accent-gold text-lg overflow-hidden whitespace-nowrap"
                >
                  Create Event
                </motion.span>
              </AnimatePresence>
            </div>
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
          <input
            type="date"
            value={searchDate}
            onChange={handleDateSearch}
            placeholder="Search by date (MM-DD)..."
            className="w-full p-3 mt-2 rounded bg-primary-navy text-neutral-lightGray border border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold"
          />
          {searchQuery || searchDate ? (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-accent-gold hover:text-secondary-deepRed"
              aria-label="Clear search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </motion.div>

        <motion.p className="text-center text-neutral-lightGray mb-6" initial="hidden" animate="visible" variants={fadeIn}>
          {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'} found
        </motion.p>

        {loading && (
          <div className="text-center">
            <svg className="animate-spin h-8 w-8 text-accent-gold mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p>Loading events...</p>
          </div>
        )}
        {error && <p className="text-red-500 text-center">{error}</p>}
        {!loading && !error && (
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" initial="hidden" animate="visible" variants={stagger}>
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event) => (
                <motion.div key={event.id} className="bg-neutral-offWhite text-neutral-darkGray rounded shadow" variants={fadeIn}>
                  <div className="relative w-full h-64">
                    <img src={event.image || 'https://picsum.photos/300/200'} alt={event.title} className="w-full h-full object-cover rounded-t" />
                    <span className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded">
                      {event.visibility === 'public' ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-xl font-semibold">{event.title}</h3>
                    <p className="text-sm text-accent-gold">{event.date || event.createdAt}</p>
                    <p className="mt-2">{event.location || 'No location'}</p>
                  </div>
                  {currentUser && event.visibility === 'public' && !event.invitedUsers.includes(currentUser.uid) && !event.organizers.includes(currentUser.uid) ? (
                    <button
                      className="w-full bg-secondary-deepRed text-neutral-lightGray px-4 py-2 rounded hover:bg-secondary-darkRed"
                      onClick={() => requestInvite(event.id)}
                    >
                      Request Invite
                    </button>
                  ) : currentUser && (event.invitedUsers.includes(currentUser.uid) || event.organizers.includes(currentUser.uid)) && event.visibility === 'private' ? (
                    <button
                      className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                      onClick={() => navigate(`/chat/${event.id}`)}
                    >
                      Go to Event Chat
                    </button>
                  ) : null}
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

      {showCreateEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-neutral-offWhite text-neutral-darkGray p-6 rounded-3xl shadow-lg max-w-md w-full">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="relative flex items-center justify-between">
                {[1, 2, 3, 4].map((stepNum, index) => (
                  <div key={stepNum} className="flex flex-col items-center relative">
                    {/* Step Circle */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                        stepNum <= step
                          ? 'bg-secondary-deepRed text-white'
                          : 'bg-gray-300 text-gray-500'
                      }`}
                    >
                      {stepNum < step ? <FaCheck size={14} /> : stepNum}
                    </div>
                    {/* Step Label (Number Only) */}
                    <span className="text-xs mt-1 text-neutral-darkGray">{stepNum}</span>
                    {/* Progress Line Between Steps */}
                    {index < 3 && (
                      <div
                        className={`absolute top-4 left-1/2 w-[calc(100%+16px)] h-1 transform translate-x-4 ${
                          stepNum < step ? 'bg-secondary-deepRed' : 'bg-gray-300'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-bold">
                {step === 1 && ': Event Details'}
                {step === 2 && ': Collaborators'}
                {step === 3 && ': Image & Description'}
                {step === 4 && ': Confirmation'}
              </h2>
            </div>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            {step === 1 && (
              <form className="space-y-4">
                <label htmlFor="title" className="block text-neutral-darkGray">Event Title:</label>
                <input
                  id="title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white text-neutral-darkGray border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  required
                />
                <label htmlFor="location" className="block text-neutral-darkGray">Location:</label>
                <input
                  id="location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white text-neutral-darkGray border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  required
                />
                <label htmlFor="date" className="block text-neutral-darkGray">Date:</label>
                <input
                  id="date"
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white text-neutral-darkGray border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  required
                />
                <label htmlFor="visibility" className="block text-neutral-darkGray">Visibility:</label>
                <select
                  id="visibility"
                  value={newEvent.visibility}
                  onChange={(e) => setNewEvent({ ...newEvent, visibility: e.target.value as 'public' | 'private' })}
                  className="w-full p-3 rounded-xl bg-white text-neutral-darkGray border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <button type="button" onClick={handleNextStep} className="w-full bg-accent-gold text-white p-3 rounded-xl hover:bg-opacity-90 transition-all">
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="w-full bg-gray-500 text-white p-3 rounded-xl hover:bg-opacity-90 transition-all mt-2"
                >
                  Cancel
                </button>
              </form>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-neutral-darkGray">Would you like to invite collaborators?</p>
                <button
                  onClick={() => {
                    setNewEvent({ ...newEvent, organizers: newEvent.organizers });
                    handleNextStep();
                  }}
                  className="w-full bg-gray-500 text-white p-3 rounded-xl hover:bg-opacity-90 transition-all"
                >
                  No
                </button>
                <button
                  onClick={handleNextStep}
                  className="w-full bg-accent-gold text-white p-3 rounded-xl hover:bg-opacity-90 transition-all"
                >
                  Yes
                </button>
                {followers.length > 0 && (
                  <div>
                    <h3 className="text-neutral-darkGray">Followers:</h3>
                    {followers.map((follower) => (
                      <div key={follower.displayName} className="flex items-center justify-between py-2">
                        <span>{follower.displayName}</span>
                        <FaPlus
                          className="cursor-pointer text-accent-gold"
                          onClick={() => setNewEvent((prev) => ({ ...prev, organizers: [...prev.organizers, follower.displayName] }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {/* Implement share link logic */}}
                  className="w-full bg-accent-gold text-white p-3 rounded-xl hover:bg-opacity-90 transition-all mt-4"
                >
                  Create Share Link
                </button>
                <button type="button" onClick={handlePrevStep} className="w-full bg-gray-500 text-white p-3 rounded-xl hover:bg-opacity-90 transition-all mt-4">
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="w-full bg-gray-500 text-white p-3 rounded-xl hover:bg-opacity-90 transition-all mt-2"
                >
                  Cancel
                </button>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-neutral-darkGray">Upload and crop an image (optional):</p>
                <label htmlFor="image-upload" className="block text-neutral-darkGray mb-1">
                  Choose an image:
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewEvent({ ...newEvent, image: e.target.files?.[0] || null })}
                  className="w-full p-3 rounded-xl border border-gray-300"
                />
                {newEvent.image && (
                  <div className="relative w-full h-64 rounded-xl overflow-hidden">
                    <Cropper
                      image={URL.createObjectURL(newEvent.image)}
                      crop={crop}
                      zoom={zoom}
                      aspect={4 / 3}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  </div>
                )}
                <button
                  onClick={handleCropImage}
                  className="w-full bg-accent-gold text-white p-3 rounded-xl hover:bg-opacity-90 transition-all"
                  disabled={!newEvent.image}
                >
                  Crop and Next
                </button>
                <label htmlFor="description" className="block text-neutral-darkGray">Description (optional):</label>
                <textarea
                  id="description"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white text-neutral-darkGray border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  rows={3}
                />
                <button type="button" onClick={() => { handleNextStep(); }} className="w-full bg-gray-500 text-white p-3 rounded-xl hover:bg-opacity-90 transition-all mt-2">
                  Skip for Now
                </button>
                <button type="button" onClick={handlePrevStep} className="w-full bg-gray-500 text-white p-3 rounded-xl hover:bg-opacity-90 transition-all mt-2">
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="w-full bg-gray-500 text-white p-3 rounded-xl hover:bg-opacity-90 transition-all mt-2"
                >
                  Cancel
                </button>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-4">
                <div className="relative w-full h-64 bg-neutral-offWhite rounded-xl overflow-hidden">
                  <img
                    src={newEvent.croppedImage || userPhotoURL || 'https://picsum.photos/300/200'}
                    alt="Event Preview"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded-xl">
                    {newEvent.visibility === 'public' ? 'Public' : 'Private'}
                  </span>
                </div>
                <h3 className="text-xl font-semibold">{newEvent.title}</h3>
                <p className="text-sm text-accent-gold">{newEvent.date}</p>
                <p>{newEvent.location}</p>
                <p>{newEvent.description || 'No description'}</p>
                <button onClick={handleCreateEvent} className="w-full bg-accent-gold text-white p-3 rounded-xl hover:bg-opacity-90 transition-all" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Event'}
                </button>
                <button type="button" onClick={handlePrevStep} className="w-full bg-gray-500 text-white p-3 rounded-xl hover:bg-opacity-90 transition-all mt-2">
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="w-full bg-gray-500 text-white p-3 rounded-xl hover:bg-opacity-90 transition-all mt-2"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Events;