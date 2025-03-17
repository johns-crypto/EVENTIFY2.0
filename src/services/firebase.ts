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
  onSnapshot,
  QuerySnapshot,
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
    await updateProfile(user, { displayName: displayName || 'Anonymous' });
    await setDoc(doc(db, 'users', user.uid), {
      displayName: displayName || 'Anonymous',
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
  description?: string;
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
  photoURL?: string; // Added photoURL field
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

export interface ChatData {
  id: string;
  title: string;
  admins: string[];
  members: string[];
  createdAt: string;
  messages?: { userId: string; text: string; timestamp: string }[];
}

// Firestore Functions
export const getEvents = async (): Promise<EventData[]> => {
  try {
    const eventsCol = collection(db, 'events');

    if (!auth.currentUser) {
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
          description: data.description || '',
        } as EventData;
      });
    }

    const userId = auth.currentUser.uid;
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data() as UserData | undefined;
    const following = userData?.following || [];

    const publicQuery = query(
      eventsCol,
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc')
    );
    const organizerQuery = query(
      eventsCol,
      where('organizers', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );
    const invitedQuery = query(
      eventsCol,
      where('invitedUsers', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );
    const followingQuery = following.length > 0
      ? query(
          eventsCol,
          where('organizers', 'array-contains-any', following),
          orderBy('createdAt', 'desc')
        )
      : null;

    const [publicSnapshot, organizerSnapshot, invitedSnapshot, followingSnapshot] = await Promise.all([
      getDocs(publicQuery),
      getDocs(organizerQuery),
      getDocs(invitedQuery),
      followingQuery ? getDocs(followingQuery) : Promise.resolve({ docs: [] } as any),
    ]);

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
          description: data.description || '',
        } as EventData);
      });
    });

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

    const publicQuery = query(
      eventsCol,
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc')
    );
    const organizerQuery = query(
      eventsCol,
      where('organizers', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );
    const invitedQuery = query(
      eventsCol,
      where('invitedUsers', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );
    const followingQuery = following.length > 0
      ? query(
          eventsCol,
          where('organizers', 'array-contains-any', following),
          orderBy('createdAt', 'desc')
        )
      : null;

    const [publicSnapshot, organizerSnapshot, invitedSnapshot, followingSnapshot] = await Promise.all([
      getDocs(publicQuery),
      getDocs(organizerQuery),
      getDocs(invitedQuery),
      followingQuery ? getDocs(followingQuery) : Promise.resolve({ docs: [] } as any),
    ]);

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
          description: data.description || '',
        } as EventData);
      });
    });

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
        photoURL: data.photoURL || '', // Added photoURL
      } as BusinessData;
    });
    return businessList;
  } catch (error: any) {
    console.error('Error fetching businesses:', error);
    throw new Error(`Failed to fetch businesses: ${error.message}`);
  }
};

export const createGroupChat = async (chatId: string, title: string, admins: string[], members: string[]): Promise<void> => {
  try {
    const chatData: ChatData = {
      id: chatId,
      title,
      admins,
      members,
      createdAt: new Date().toISOString(),
      messages: [],
    };
    await setDoc(doc(db, 'chats', chatId), chatData);
    console.log(`Group chat created with ID: ${chatId}`);
  } catch (error: any) {
    console.error('Error creating group chat:', error);
    throw new Error(`Failed to create group chat: ${error.message}`);
  }
};

// Export types separately
export type {
  QuerySnapshot,
  QueryDocumentSnapshot,
  DocumentData,
};

// Export values (functions and instances)
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
  onSnapshot,
  ref,
  uploadBytes,
  getDownloadURL,
};