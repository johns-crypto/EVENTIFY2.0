// src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
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
  limit,
  startAfter,
  deleteDoc,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { EventData, NormalizedEventData, UserData, PostData, BusinessData, ChatData } from '../types';
import { normalizeEventData } from '../utils/normalizeEvent';

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

// Google Sign-In Provider
const googleProvider = new GoogleAuthProvider();

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

export const loginWithGoogle = async (): Promise<User> => {
  try {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const user = userCredential.user;

    // Check if user document exists in Firestore, if not create one
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        displayName: user.displayName || 'Anonymous',
        email: user.email || '',
        createdAt: new Date().toISOString(),
        bio: '',
        location: '',
        photoURL: user.photoURL || '',
        contactEmail: user.email || '',
        contactPhone: '',
        followers: [],
        following: [],
        notificationsEnabled: true,
        role: 'user', // Default role for Google Sign-In users
      });
    }

    return user;
  } catch (error: any) {
    console.error('Google Sign-In error:', error);
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup blocked by browser. Please allow popups and try again.');
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Popup closed before completing authentication.');
    }
    throw new Error(`Google Sign-In failed: ${error.message}`);
  }
};

export const registerUser = async (
  email: string,
  password: string,
  displayName?: string,
  role: string = 'user' // Add role parameter with default value
): Promise<User> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const userDisplayName = displayName || 'Anonymous';
    await updateProfile(user, { displayName: userDisplayName });
    await setDoc(doc(db, 'users', user.uid), {
      displayName: userDisplayName,
      email,
      createdAt: new Date().toISOString(),
      bio: '',
      location: '',
      photoURL: user.photoURL || '',
      contactEmail: email,
      contactPhone: '',
      followers: [],
      following: [],
      notificationsEnabled: true,
      role, // Use the provided role
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

// Firestore Functions
export const getEvents = async (): Promise<NormalizedEventData[]> => {
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
        const event = {
          id: doc.id,
          title: data.title || 'Untitled Event',
          userId: data.userId || data.organizerId || 'unknown',
          createdAt: data.createdAt || new Date().toISOString(),
          date: data.date || '',
          location: data.location || '',
          image: data.image || data.imageUrl || '',
          category: data.category || 'General',
          organizerId: data.organizerId || undefined,
          organizers: data.organizers || [],
          visibility: data.visibility || 'public',
          inviteLink: data.inviteLink || '',
          invitedUsers: data.invitedUsers || [],
          pendingInvites: data.pendingInvites || [],
          description: data.description || '',
          creatorName: data.creatorName || 'Unknown User',
          archived: data.archived ?? false,
        } as EventData;
        return normalizeEventData(event);
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

    const eventMap = new Map<string, NormalizedEventData>();
    [publicSnapshot, organizerSnapshot, invitedSnapshot, followingSnapshot].forEach((snapshot) => {
      snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        const event = {
          id: doc.id,
          title: data.title || 'Untitled Event',
          userId: data.userId || data.organizerId || 'unknown',
          createdAt: data.createdAt || new Date().toISOString(),
          date: data.date || '',
          location: data.location || '',
          image: data.image || data.imageUrl || '',
          category: data.category || 'General',
          organizerId: data.organizerId || undefined,
          organizers: data.organizers || [],
          visibility: data.visibility || 'public',
          inviteLink: data.inviteLink || '',
          invitedUsers: data.invitedUsers || [],
          pendingInvites: data.pendingInvites || [],
          description: data.description || '',
          creatorName: data.creatorName || 'Unknown User',
          archived: data.archived ?? false,
        } as EventData;
        eventMap.set(doc.id, normalizeEventData(event));
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

export const getUserEvents = async (userId: string): Promise<NormalizedEventData[]> => {
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

    const eventMap = new Map<string, NormalizedEventData>();
    [publicSnapshot, organizerSnapshot, invitedSnapshot, followingSnapshot].forEach((snapshot) => {
      snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        const event = {
          id: doc.id,
          title: data.title || 'Untitled Event',
          userId: data.userId || data.organizerId || 'unknown',
          createdAt: data.createdAt || new Date().toISOString(),
          date: data.date || '',
          location: data.location || '',
          image: data.image || data.imageUrl || '',
          category: data.category || 'General',
          organizerId: data.organizerId || undefined,
          organizers: data.organizers || [],
          visibility: data.visibility || 'public',
          inviteLink: data.inviteLink || '',
          invitedUsers: data.invitedUsers || [],
          pendingInvites: data.pendingInvites || [],
          description: data.description || '',
          creatorName: data.creatorName || 'Unknown User',
          archived: data.archived ?? false,
        } as EventData;
        eventMap.set(doc.id, normalizeEventData(event));
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
      const defaultUserData: UserData = {
        displayName: 'Anonymous',
        email: '',
        createdAt: new Date().toISOString(),
        bio: '',
        location: '',
        photoURL: '',
        contactEmail: '',
        contactPhone: '',
        followers: [],
        following: [],
        notificationsEnabled: true,
        role: 'user', // Add default role
      };
      await setDoc(userDocRef, defaultUserData);
      console.log(`Created default user document for UID: ${userId}`);
      return defaultUserData;
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
      role: data.role || 'user', // Ensure role is always present
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
        photoURL: data.photoURL || '',
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
  limit,
  startAfter,
  deleteDoc,
};