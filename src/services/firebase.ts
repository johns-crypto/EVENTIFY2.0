import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  updateProfile,
  User,
  UserCredential,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  DocumentData,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Authentication Functions
export const registerUser = (email: string, password: string): Promise<UserCredential> =>
  createUserWithEmailAndPassword(auth, email, password);

export const loginUser = (email: string, password: string): Promise<UserCredential> =>
  signInWithEmailAndPassword(auth, email, password);

export const logoutUser = (): Promise<void> => signOut(auth);

export const loginWithGoogle = async (): Promise<UserCredential> => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const loginWithFacebook = async (): Promise<UserCredential> => {
  const provider = new FacebookAuthProvider();
  return signInWithPopup(auth, provider);
};

export const updateUserProfile = async (
  user: User,
  data: { displayName?: string; photoURL?: string }
): Promise<void> => {
  await updateProfile(user, data);
};

export const resetPassword = (email: string): Promise<void> =>
  sendPasswordResetEmail(auth, email);

// Firestore User Functions
export const saveUserData = async (
  userId: string,
  data: { displayName: string; bio: string; location: string; photoURL: string }
): Promise<void> => {
  await setDoc(doc(db, 'users', userId), data);
};

export const getUserData = async (userId: string): Promise<DocumentData | undefined> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.exists() ? userDoc.data() : undefined;
};

export const updateUserData = async (
  userId: string,
  data: Partial<{ displayName: string; bio: string; location: string; photoURL: string }>
): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), data);
};

// Firestore Event Functions
export interface EventData {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  [key: string]: any;
}

export const getEvents = async (): Promise<EventData[]> => {
  const eventsCol = collection(db, 'events');
  const q = query(eventsCol, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as EventData));
};

export const getUserEvents = async (userId: string): Promise<EventData[]> => {
  const eventsCol = collection(db, 'events');
  const q = query(eventsCol, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as EventData));
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  await deleteDoc(doc(db, 'events', eventId));
};

// Firestore Post Functions
export interface PostData {
  id: string;
  eventId: string;
  userId: string;
  mediaUrl: string;
  type: 'photo' | 'video';
  createdAt: string;
  [key: string]: any;
}

export const getFeedPosts = async (): Promise<PostData[]> => {
  const allEventsSnapshot = await getDocs(collection(db, 'events'));
  const posts: PostData[] = [];
  for (const eventDoc of allEventsSnapshot.docs) {
    const postsCol = collection(db, 'events', eventDoc.id, 'posts');
    const q = query(postsCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    snapshot.docs.forEach((doc) =>
      posts.push({ id: doc.id, eventId: eventDoc.id, ...doc.data() } as PostData)
    );
  }
  return posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getUserPosts = async (userId: string): Promise<PostData[]> => {
  const allEventsSnapshot = await getDocs(collection(db, 'events'));
  const posts: PostData[] = [];
  for (const eventDoc of allEventsSnapshot.docs) {
    const postsCol = collection(db, 'events', eventDoc.id, 'posts');
    const q = query(postsCol, where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    snapshot.docs.forEach((doc) =>
      posts.push({ id: doc.id, eventId: eventDoc.id, ...doc.data() } as PostData)
    );
  }
  return posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const deletePost = async (eventId: string, postId: string): Promise<void> => {
  await deleteDoc(doc(db, 'events', eventId, 'posts', postId));
};

// Storage Functions
export const uploadProfilePhoto = async (
  userId: string,
  file: File
): Promise<string> => {
  const storageRef = ref(storage, `profilePhotos/${userId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};