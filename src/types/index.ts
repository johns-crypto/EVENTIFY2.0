// src/types/index.ts
import { Timestamp } from 'firebase/firestore';

// Define a reusable EventCategory type
export type EventCategory =
  | 'General'
  | 'Music'
  | 'Food'
  | 'Tech'
  | 'Refreshments'
  | 'Catering/Food'
  | 'Venue Provider';

// Interface for service data
export interface ServiceData {
  type: 'refreshments' | 'venue' | 'catering';
  businessId: string;
  businessName: string;
}

export interface EventData {
  id: string;
  title: string;
  userId: string;
  createdAt: string | Timestamp;
  date: string | Timestamp;
  location: string;
  image?: string;
  category: EventCategory;
  organizerId?: string;
  organizers: string[];
  visibility: 'public' | 'private';
  inviteLink?: string;
  invitedUsers: string[];
  pendingInvites: string[];
  description?: string;
  creatorName: string; // Required by security rules
  archived: boolean; // Required by security rules
  service?: ServiceData; // Add service field
}

export type NormalizedEventData = Omit<EventData, 'createdAt' | 'date'> & {
  createdAt: string; // Enforce string type
  date: string; // Enforce string type
  service?: ServiceData; // Ensure it's included in NormalizedEventData
};

export interface MultiStepEventData {
  title: string;
  location: string;
  date: string;
  visibility: 'public' | 'private';
  category: EventCategory;
  organizers: string[];
  selectedImage: string | null;
  description: string;
  inviteLink: string;
  searchedImages: string[];
}

// Raw comment data as stored in Firestore (without id)
export interface RawComment {
  eventId: string;
  userId: string;
  content: string;
  createdAt: string | Timestamp;
  userName?: string;
  userPhotoURL?: string;
}

export interface Comment extends RawComment {
  id: string;
}

export type NormalizedComment = Omit<Comment, 'createdAt'> & {
  createdAt: string;
};

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
  category: 'Entertainment' | 'Services' | 'Technology';
  description: string;
  ownerId: string;
  products: ProductData[];
  photoURL?: string;
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
  role: string; // Add role property
}

export interface ChatData {
  id: string;
  title: string;
  admins: string[];
  members: string[];
  createdAt: string;
  messages?: { userId: string; text: string; timestamp: string }[];
}