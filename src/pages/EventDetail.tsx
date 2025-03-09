// src/pages/EventDetail.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db, EventData, getUserData } from '../services/firebase';
import { toast } from 'react-toastify';

function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ title: '', date: '', location: '' });

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      try {
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (eventDoc.exists()) {
          const eventData = { id: eventDoc.id, ...eventDoc.data() } as EventData;
          setEvent(eventData);
          setFormData({
            title: eventData.title,
            date: eventData.date || '',
            location: eventData.location || '',
          });

          // Fetch creator's displayName
          const userData = await getUserData(eventData.userId);
          setCreatorName(userData?.displayName || 'Unknown User');
        } else {
          toast.error('Event not found.');
        }
      } catch (error) {
        console.error('Error fetching event:', error);
        toast.error('Failed to load event.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !currentUser || currentUser.uid !== event?.userId) return;

    try {
      await updateDoc(doc(db, 'events', eventId), {
        title: formData.title,
        date: formData.date,
        location: formData.location,
      });
      setEvent((prev) => prev ? { ...prev, ...formData } : null);
      setEditing(false);
      toast.success('Event updated successfully!');
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event.');
    }
  };

  const handleDelete = async () => {
    if (!eventId || !currentUser || currentUser.uid !== event?.userId) return;

    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteDoc(doc(db, 'events', eventId));
        toast.success('Event deleted successfully!');
        navigate('/');
      } catch (error) {
        console.error('Error deleting event:', error);
        toast.error('Failed to delete event.');
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center">
        <div className="flex items-center space-x-2">
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
          <span className="text-neutral-lightGray text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center">
        <p className="text-neutral-lightGray text-lg">Event not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-darkGray py-12 px-4">
      <motion.div
        className="max-w-4xl mx-auto bg-primary-navy p-8 rounded-lg shadow-lg text-neutral-lightGray"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <img
          src={event.image || 'https://via.placeholder.com/600x300?text=Event'}
          alt={event.title}
          className="w-full h-64 object-cover rounded-t mb-6"
        />
        {editing ? (
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-sm">Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm">Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded"
              />
            </div>
            <div>
              <label className="block text-sm">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="w-full p-2 mt-1 bg-neutral-offWhite text-neutral-darkGray rounded"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-accent-gold hover:text-neutral-darkGray hover:bg-accent-gold rounded"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="text-4xl font-bold text-accent-gold mb-4">{event.title}</h1>
            <p className="text-lg mb-2">
              <strong>Date:</strong> {event.date || event.createdAt}
            </p>
            <p className="text-lg mb-2">
              <strong>Location:</strong> {event.location || 'TBD'}
            </p>
            <p className="text-lg mb-4">
              <strong>Created by:</strong> {creatorName}
            </p>
            {currentUser?.uid === event.userId && (
              <div className="flex space-x-4">
                <button
                  onClick={() => setEditing(true)}
                  className="btn-primary"
                >
                  Edit Event
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-secondary-deepRed text-neutral-lightGray rounded hover:bg-secondary-darkRed"
                >
                  Delete Event
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

export default EventDetail;