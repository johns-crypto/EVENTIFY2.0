// src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  DocumentData,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Authentication Functions
export const loginUser = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    console.error('Login error:', error);
    throw new Error(`Login failed: ${error.message}`);
  }
};

export const registerUser = async (
  email: string,
  password: string,
  displayName?: string
): Promise<User> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    if (displayName) {
      await updateProfile(user, { displayName });
      await setDoc(doc(db, 'users', user.uid), {
        displayName,
        email,
        createdAt: new Date().toISOString(),
        bio: '',
        location: '',
        photoURL: '',
        contactEmail: email,
        contactPhone: '',
        followers: [],
        following: [],
        notificationsEnabled: true,
      });
    }
    return user;
  } catch (error: any) {
    console.error('Registration error:', error);
    throw new Error(`Registration failed: ${error.message}`);
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Logout error:', error);
    throw new Error(`Logout failed: ${error.message}`);
  }
};

// Data Interfaces
export interface EventData {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  date?: string;
  location?: string;
  image?: string;
  category?: 'Refreshments' | 'Catering/Food' | 'Venue Provider';
  organizerId?: string;
  organizers: string[];
  visibility: 'public' | 'private';
  inviteLink?: string;
  invitedUsers: string[];
  pendingInvites: string[];
  description?: string; // Added description field
}

export interface PostData {
  id: string;
  userId: string;
  eventId: string;
  mediaUrl: string;
  type: 'photo' | 'video';
  visibility: 'public' | 'private';
  likes: string[];
  comments: { userId: string; text: string }[];
  createdAt: string;
}

export interface ProductData {
  name: string;
  description: string;
  imageUrl?: string;
  inStock: boolean;
}

export interface BusinessData {
  id: string;
  name: string;
  category: 'Refreshments' | 'Catering/Food' | 'Venue Provider';
  description: string;
  ownerId: string;
  products: ProductData[];
}

export interface UserData {
  displayName: string;
  email: string;
  createdAt: string;
  bio: string;
  location: string;
  photoURL: string;
  contactEmail: string;
  contactPhone: string;
  followers: string[];
  following: string[];
  notificationsEnabled: boolean;
}

// Firestore Functions
export const getEvents = async (): Promise<EventData[]> => {
  try {
    const eventsCol = collection(db, 'events');

    if (!auth.currentUser) {
      // For unauthenticated users, fetch only public events
      const publicQuery = query(
        eventsCol,
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(publicQuery);
      if (snapshot.empty) {
        console.log('No public events found in Firestore.');
        return [];
      }
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'Untitled Event',
          userId: data.userId || data.organizerId || 'unknown',
          createdAt: data.createdAt || new Date().toISOString(),
          date: data.date || '',
          location: data.location || '',
          image: data.image || data.imageUrl || '',
          category: data.category || undefined,
          organizerId: data.organizerId || undefined,
          organizers: data.organizers || [],
          visibility: data.visibility || 'public',
          inviteLink: data.inviteLink || '',
          invitedUsers: data.invitedUsers || [],
          pendingInvites: data.pendingInvites || [],
          description: data.description || '', // Added description
        } as EventData;
      });
    }

    // For authenticated users
    const userId = auth.currentUser.uid;
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data() as UserData | undefined;
    const following = userData?.following || [];

    // Query 1: Public events
    const publicQuery = query(
      eventsCol,
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc')
    );

    // Query 2: Events where user is an organizer
    const organizerQuery = query(
      eventsCol,
      where('organizers', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );

    // Query 3: Events where user is invited
    const invitedQuery = query(
      eventsCol,
      where('invitedUsers', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );

    // Query 4: Events where an organizer is in user's following list
    const followingQuery = following.length > 0
      ? query(
          eventsCol,
          where('organizers', 'array-contains-any', following),
          orderBy('createdAt', 'desc')
        )
      : null;

    // Execute all queries in parallel
    const [publicSnapshot, organizerSnapshot, invitedSnapshot, followingSnapshot] = await Promise.all([
      getDocs(publicQuery),
      getDocs(organizerQuery),
      getDocs(invitedQuery),
      followingQuery ? getDocs(followingQuery) : Promise.resolve({ docs: [] } as any),
    ]);

    // Combine results into a Map to deduplicate by event ID
    const eventMap = new Map<string, EventData>();
    [publicSnapshot, organizerSnapshot, invitedSnapshot, followingSnapshot].forEach((snapshot) => {
      snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        eventMap.set(doc.id, {
          id: doc.id,
          title: data.title || 'Untitled Event',
          userId: data.userId || data.organizerId || 'unknown',
          createdAt: data.createdAt || new Date().toISOString(),
          date: data.date || '',
          location: data.location || '',
          image: data.image || data.imageUrl || '',
          category: data.category || undefined,
          organizerId: data.organizerId || undefined,
          organizers: data.organizers || [],
          visibility: data.visibility || 'public',
          inviteLink: data.inviteLink || '',
          invitedUsers: data.invitedUsers || [],
          pendingInvites: data.pendingInvites || [],
          description: data.description || '', // Added description
        } as EventData);
      });
    });

    // Convert to array and sort by createdAt descending
    const eventsList = Array.from(eventMap.values()).sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (eventsList.length === 0) {
      console.log('No events found for user:', userId);
    }
    return eventsList;
  } catch (error: any) {
    console.error('Error fetching events:', error);
    throw new Error(`Failed to fetch events: ${error.message}`);
  }
};

export const getUserEvents = async (userId: string): Promise<EventData[]> => {
  try {
    const eventsCol = collection(db, 'events');
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data() as UserData | undefined;
    const following = userData?.following || [];

    // Query 1: Public events
    const publicQuery = query(
      eventsCol,
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc')
    );

    // Query 2: Events where user is an organizer
    const organizerQuery = query(
      eventsCol,
      where('organizers', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );

    // Query 3: Events where user is invited
    const invitedQuery = query(
      eventsCol,
      where('invitedUsers', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );

    // Query 4: Events where an organizer is in user's following list
    const followingQuery = following.length > 0
      ? query(
          eventsCol,
          where('organizers', 'array-contains-any', following),
          orderBy('createdAt', 'desc')
        )
      : null;

    // Execute all queries in parallel
    const [publicSnapshot, organizerSnapshot, invitedSnapshot, followingSnapshot] = await Promise.all([
      getDocs(publicQuery),
      getDocs(organizerQuery),
      getDocs(invitedQuery),
      followingQuery ? getDocs(followingQuery) : Promise.resolve({ docs: [] } as any),
    ]);

    // Combine results into a Map to deduplicate by event ID
    const eventMap = new Map<string, EventData>();
    [publicSnapshot, organizerSnapshot, invitedSnapshot, followingSnapshot].forEach((snapshot) => {
      snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        eventMap.set(doc.id, {
          id: doc.id,
          title: data.title || 'Untitled Event',
          userId: data.userId || data.organizerId || 'unknown',
          createdAt: data.createdAt || new Date().toISOString(),
          date: data.date || '',
          location: data.location || '',
          image: data.image || data.imageUrl || '',
          category: data.category || undefined,
          organizerId: data.organizerId || undefined,
          organizers: data.organizers || [],
          visibility: data.visibility || 'public',
          inviteLink: data.inviteLink || '',
          invitedUsers: data.invitedUsers || [],
          pendingInvites: data.pendingInvites || [],
          description: data.description || '', // Added description
        } as EventData);
      });
    });

    // Convert to array and sort by createdAt descending
    const eventsList = Array.from(eventMap.values()).sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (eventsList.length === 0) {
      console.log(`No events found for user: ${userId}`);
    }
    return eventsList;
  } catch (error: any) {
    console.error('Error fetching user events:', error);
    throw new Error(`Failed to fetch user events: ${error.message}`);
  }
};

export const getUserData = async (userId: string): Promise<UserData | null> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userSnapshot = await getDoc(userDocRef);
    if (!userSnapshot.exists()) {
      console.warn(`No user document found for UID: ${userId}`);
      return null;
    }
    const data = userSnapshot.data();
    return {
      displayName: data.displayName || '',
      email: data.email || '',
      createdAt: data.createdAt || '',
      bio: data.bio || '',
      location: data.location || '',
      photoURL: data.photoURL || '',
      contactEmail: data.contactEmail || data.email || '',
      contactPhone: data.contactPhone || '',
      followers: data.followers || [],
      following: data.following || [],
      notificationsEnabled: data.notificationsEnabled ?? true,
    };
  } catch (error: any) {
    console.error('Error fetching user data:', error);
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
};

export const getFeedPosts = async (): Promise<PostData[]> => {
  try {
    const eventsSnapshot = await getDocs(collection(db, 'events'));
    if (eventsSnapshot.empty) {
      console.log('No events found for feed posts.');
      return [];
    }
    const posts: PostData[] = [];
    for (const eventDoc of eventsSnapshot.docs) {
      const postsCol = collection(db, 'events', eventDoc.id, 'posts');
      const q = query(postsCol, where('visibility', '==', 'public'), orderBy('createdAt', 'desc'));
      const postsSnapshot = await getDocs(q);
      if (postsSnapshot.empty) {
        console.log(`No public posts found for event: ${eventDoc.id}`);
      }
      postsSnapshot.forEach((doc) => {
        const data = doc.data();
        posts.push({
          id: doc.id,
          eventId: eventDoc.id,
          userId: data.userId || 'unknown',
          mediaUrl: data.mediaUrl || '',
          type: data.type || 'photo',
          visibility: data.visibility || 'public',
          likes: data.likes || [],
          comments: data.comments || [],
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });
    }
    return posts;
  } catch (error: any) {
    console.error('Error fetching feed posts:', error);
    throw new Error(`Failed to fetch feed posts: ${error.message}`);
  }
};

export const getBusinesses = async (): Promise<BusinessData[]> => {
  try {
    const businessCol = collection(db, 'businesses');
    const snapshot = await getDocs(businessCol);
    if (snapshot.empty) {
      console.log('No businesses found in Firestore.');
      return [];
    }
    const businessList = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unnamed Business',
        category: data.category || 'Venue Provider',
        description: data.description || '',
        ownerId: data.ownerId || 'unknown',
        products: data.products || [],
      } as BusinessData;
    });
    return businessList;
  } catch (error: any) {
    console.error('Error fetching businesses:', error);
    throw new Error(`Failed to fetch businesses: ${error.message}`);
  }
};

// Export all necessary Firestore and Storage functions
export {
  doc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  setDoc,
  addDoc,
  ref,
  uploadBytes,
  getDownloadURL,
};