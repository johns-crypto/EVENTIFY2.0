import { useState, useEffect, useCallback } from 'react';
import { doc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { db, getUserData, createGroupChat } from '../services/firebase';
import { EventData, NormalizedEventData } from '../types';
import { normalizeEventData } from '../utils/normalizeEvent';

interface UnsplashResponse {
  results: { urls: { regular: string }; description?: string }[];
}

interface CachedImage {
  urls: string[];
  expiry: number;
}

export interface MultiStepEventData {
  title: string;
  location: string;
  date: string;
  visibility: 'public' | 'private';
  organizers: string[];
  inviteLink: string;
  description: string;
  selectedImage: string | null;
  searchedImages: string[];
  category: 'General' | 'Music' | 'Food' | 'Tech' | 'Refreshments' | 'Catering/Food' | 'Venue Provider';
}

export const multiStepCreateEvent = ({
  userId,
  onSuccess,
  onError,
}: {
  userId: string;
  onSuccess: (event: NormalizedEventData) => void;
  onError: (message: string) => void;
}) => {
  const [step, setStep] = useState(1);
  const [newEvent, setNewEvent] = useState<MultiStepEventData>({
    title: '',
    location: '',
    date: '',
    visibility: 'public',
    organizers: [userId],
    inviteLink: '',
    description: '',
    selectedImage: null,
    searchedImages: [],
    category: 'General',
  });
  const [loading, setLoading] = useState(false);
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>('Anonymous');
  const [cachedImages, setCachedImages] = useState<{ [key: string]: CachedImage }>({});
  const [followers, setFollowers] = useState<string[]>([]);
  const [followerNames, setFollowerNames] = useState<{ [key: string]: string }>({});
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchFollowersAndNames = async () => {
      try {
        if (!userId) {
          throw new Error('User ID is required to fetch followers');
        }
        const userData = await getUserData(userId);
        if (!userData) {
          throw new Error('User data not found for the current user');
        }
        setFollowers(userData.followers || []);
        setUserPhotoURL(userData.photoURL || 'https://picsum.photos/300/200');
        setUserDisplayName(userData.displayName || 'Anonymous');
        const names: { [key: string]: string } = {};
        for (const followerId of userData.followers || []) {
          const followerData = await getUserData(followerId);
          if (followerData) {
            names[followerId] = followerData.displayName || followerId;
          }
        }
        setFollowerNames(names);
      } catch (err: any) {
        console.error('Error fetching followers and names:', err);
        onError(`Failed to fetch followers: ${err.message}`);
      }
    };
    fetchFollowersAndNames();
  }, [userId, onError]);

  useEffect(() => {
    const cached = localStorage.getItem('eventImagesCache');
    if (cached) {
      const parsedCache = JSON.parse(cached);
      const now = Date.now();
      const validCache = Object.fromEntries(
        Object.entries(parsedCache).filter(([_, data]: [string, any]) => now < (data as CachedImage).expiry)
      ) as { [key: string]: CachedImage };
      setCachedImages(validCache);
      localStorage.setItem('eventImagesCache', JSON.stringify(validCache));
    }
  }, []);

  const searchImages = useCallback(async (query: string) => {
    if (!query.trim()) {
      setNewEvent((prev) => ({ ...prev, searchedImages: [] }));
      return;
    }
    if (cachedImages[query] && Date.now() < cachedImages[query].expiry) {
      setNewEvent((prev) => ({ ...prev, searchedImages: cachedImages[query].urls }));
      return;
    }

    try {
      console.log('Searching images for query:', query);
      let allImages: string[] = [];
      let page = 1;
      const perPage = 9;

      while (allImages.length < 3 && page <= 3) {
        const response = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape&client_id=${import.meta.env.VITE_UNSPLASH_API_KEY}`
        );
        if (!response.ok) throw new Error(`Failed to fetch images: ${response.statusText}`);
        const data = (await response.json()) as UnsplashResponse;
        const images = data.results
          .filter((result) => !result.description?.toLowerCase().includes('people') && !result.description?.toLowerCase().includes('portrait'))
          .map((result) => result.urls.regular);
        allImages = [...allImages, ...images];
        page++;
      }

      const filteredImages = allImages.slice(0, 3);
      console.log('Filtered images:', filteredImages);
      if (filteredImages.length < 3) {
        console.warn('Not enough images without people, using available:', filteredImages);
      }
      setNewEvent((prev) => ({ ...prev, searchedImages: filteredImages }));
      setCachedImages((prev) => ({
        ...prev,
        [query]: { urls: filteredImages, expiry: Date.now() + 24 * 60 * 60 * 1000 },
      }));
      localStorage.setItem(
        'eventImagesCache',
        JSON.stringify({
          ...cachedImages,
          [query]: { urls: filteredImages, expiry: Date.now() + 24 * 60 * 60 * 1000 },
        })
      );
    } catch (err: any) {
      console.error('Image search error:', err);
      onError(`Failed to search images: ${err.message}`);
      setNewEvent((prev) => ({ ...prev, searchedImages: [] }));
    }
  }, [cachedImages, onError]);

  const handleNextStep = useCallback(() => setStep((prev) => prev + 1), []);
  const handlePrevStep = useCallback(() => setStep((prev) => prev - 1), []);

  const createShareLink = useCallback(() => {
    const link = `https://eventify.com/invite/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setNewEvent((prev) => ({ ...prev, inviteLink: link }));
    return link;
  }, []);

  const handleCreateEvent = useCallback(async () => {
    setLoading(true);
    try {
      if (!newEvent.title || !newEvent.location || !newEvent.date) {
        throw new Error('Title, location, and date are required');
      }

      const eventDate = new Date(newEvent.date);
      if (isNaN(eventDate.getTime())) {
        throw new Error('Invalid event date');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (eventDate < today) {
        throw new Error('Event date must be in the future');
      }

      if (!userId) {
        throw new Error('User ID is required to create an event');
      }

      const imageUrl = newEvent.selectedImage || userPhotoURL || newEvent.searchedImages[0] || 'https://picsum.photos/300/200';

      if (!newEvent.inviteLink) {
        createShareLink();
      }

      const eventId = doc(collection(db, 'events')).id;
      const createdAtTimestamp = Timestamp.fromDate(new Date());
      const dateTimestamp = Timestamp.fromDate(eventDate);

      const eventDataForFirestore: Omit<EventData, 'id'> = {
        title: newEvent.title,
        userId,
        createdAt: createdAtTimestamp,
        date: dateTimestamp,
        location: newEvent.location,
        image: imageUrl,
        visibility: newEvent.visibility,
        organizers: [userId, ...newEvent.organizers.filter((id) => id !== userId)],
        invitedUsers: [],
        pendingInvites: [],
        inviteLink: newEvent.inviteLink || `https://eventify.com/invite/${eventId}`,
        description: newEvent.description || '',
        category: newEvent.category || 'General',
        creatorName: userDisplayName,
        archived: false,
      };

      console.log('Event data being written to Firestore:', eventDataForFirestore);
      const docRef = await addDoc(collection(db, 'events'), eventDataForFirestore);
      await createGroupChat(docRef.id, newEvent.title, [userId, ...newEvent.organizers], eventDataForFirestore.invitedUsers);

      const eventDataForCallback: EventData = {
        id: docRef.id,
        ...eventDataForFirestore,
      };

      onSuccess(normalizeEventData(eventDataForCallback));
    } catch (err: any) {
      console.error('Create event error:', err);
      onError(`Failed to create event: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [newEvent, userId, userPhotoURL, userDisplayName, onSuccess, onError, createShareLink]);

  return {
    step,
    newEvent,
    setNewEvent,
    handleNextStep,
    handlePrevStep,
    handleCreateEvent,
    loading,
    searchedImages: newEvent.searchedImages,
    followers,
    followerNames,
    createShareLink,
    userPhotoURL,
    selectedImageIndex,
    setSelectedImageIndex,
    searchImages,
  };
};