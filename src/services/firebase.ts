import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User, 
  updateProfile 
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
  setDoc 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
    throw new Error(`Login failed: ${error.message}`);
  }
};

export const registerUser = async (email: string, password: string, displayName?: string): Promise<User> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    if (displayName) {
      await updateProfile(user, { displayName });
      await setDoc(doc(db, 'users', user.uid), {
        displayName,
        email,
        createdAt: new Date().toISOString(),
      });
    }
    return user;
  } catch (error: any) {
    throw new Error(`Registration failed: ${error.message}`);
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(`Logout failed: ${error.message}`);
  }
};

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
  organizers?: string[];
  visibility?: 'public' | 'private';
  inviteLink?: string;
  invitedUsers?: string[];
  pendingInvites?: string[];
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

export const getEvents = async (): Promise<EventData[]> => {
  const eventsCol = collection(db, 'events');
  const q = query(eventsCol, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    title: doc.data().title,
    userId: doc.data().userId || doc.data().organizerId || '',
    createdAt: doc.data().createdAt,
    date: doc.data().date,
    location: doc.data().location,
    image: doc.data().image || doc.data().imageUrl,
    category: doc.data().category,
    organizerId: doc.data().organizerId,
    organizers: doc.data().organizers || [],
    visibility: doc.data().visibility || 'public',
    inviteLink: doc.data().inviteLink,
    invitedUsers: doc.data().invitedUsers || [],
    pendingInvites: doc.data().pendingInvites || [],
  })) as EventData[];
};

export const getUserEvents = async (userId: string): Promise<EventData[]> => {
  const eventsCol = collection(db, 'events');
  const q = query(
    eventsCol,
    where('organizers', 'array-contains', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    title: doc.data().title,
    userId: doc.data().userId || doc.data().organizerId || '',
    createdAt: doc.data().createdAt,
    date: doc.data().date,
    location: doc.data().location,
    image: doc.data().image || doc.data().imageUrl,
    category: doc.data().category,
    organizerId: doc.data().organizerId,
    organizers: doc.data().organizers || [],
    visibility: doc.data().visibility || 'public',
    inviteLink: doc.data().inviteLink,
    invitedUsers: doc.data().invitedUsers || [],
    pendingInvites: doc.data().pendingInvites || [],
  })) as EventData[];
};

export const getUserData = async (userId: string): Promise<DocumentData | null> => {
  const userDoc = doc(db, 'users', userId);
  const userSnapshot = await getDoc(userDoc);
  return userSnapshot.exists() ? userSnapshot.data() : null;
};

export const getFeedPosts = async (): Promise<PostData[]> => {
  const eventsSnapshot = await getDocs(collection(db, 'events'));
  const posts: PostData[] = [];
  for (const eventDoc of eventsSnapshot.docs) {
    const postsCol = collection(db, 'events', eventDoc.id, 'posts');
    const q = query(postsCol, where('visibility', '==', 'public'), orderBy('createdAt', 'desc'));
    const postsSnapshot = await getDocs(q);
    postsSnapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        eventId: eventDoc.id,
        userId: doc.data().userId,
        mediaUrl: doc.data().mediaUrl,
        type: doc.data().type,
        visibility: doc.data().visibility,
        likes: doc.data().likes || [],
        comments: doc.data().comments || [],
        createdAt: doc.data().createdAt,
      });
    });
  }
  return posts;
};

export const getBusinesses = async (): Promise<BusinessData[]> => {
  const businessCol = collection(db, 'businesses');
  const snapshot = await getDocs(businessCol);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
    category: doc.data().category,
    description: doc.data().description,
    ownerId: doc.data().ownerId,
    products: doc.data().products || [],
  })) as BusinessData[];
};