// src/services/businessService.ts
import {
  db,
  getDoc,
  doc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
} from './firebase';

// Utility function to remove undefined values
const removeUndefined = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item)).filter(item => item !== undefined);
  }
  if (obj && typeof obj === 'object') {
    const cleaned: { [key: string]: any } = {};
    for (const key in obj) {
      const value = obj[key];
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
    return cleaned;
  }
  return obj;
};

// Define the BusinessData interface to match the Business interface across the app
export interface BusinessData {
  id: string;
  name: string;
  services: string[];
  description: string;
  contact: { phoneNumber: string; email?: string };
  location: string;
  imageUrl?: string;
  ownerId: string;
  products: { name: string; description: string; imageUrl?: string; inStock: boolean; category?: string }[];
  category?: string;
}

// Interface for notifications
export interface Notification {
  id: string;
  businessId: string;
  productName: string;
  eventId: string;
  eventTitle: string;
  timestamp: string;
  read: boolean;
}

// Fetch all businesses for a user based on role
export const getBusinesses = async (userId: string, role: string): Promise<BusinessData[]> => {
  try {
    const businessCol = collection(db, 'businesses');
    const snapshot = await getDocs(businessCol);
    if (snapshot.empty) {
      console.log('No businesses found in Firestore.');
      return [];
    }
    const businessList = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const contact = {
          phoneNumber: data.contact?.phoneNumber || '',
          email: data.contact?.email || '',
        };
        // Sanitize the entire business data, including the products array
        const sanitizedData = removeUndefined({
          id: doc.id,
          name: data.name || 'Unnamed Business',
          services: data.services || (data.category ? [data.category] : []),
          description: data.description || '',
          contact,
          location: data.location || '',
          imageUrl: data.imageUrl || data.photoURL || '',
          ownerId: data.ownerId || 'unknown',
          products: data.products || [],
          category: data.category || 'Venue Provider',
        });
        return sanitizedData as BusinessData;
      })
      .filter((business) => business.ownerId === userId || role === 'user');
    return businessList;
  } catch (error: any) {
    console.error('Error fetching businesses:', error);
    throw new Error(`Failed to fetch businesses: ${error.message}`);
  }
};

// Fetch a single business by ID
export const getBusinessById = async (businessId: string): Promise<BusinessData | null> => {
  try {
    const businessDocRef = doc(db, 'businesses', businessId);
    const businessSnapshot = await getDoc(businessDocRef);
    if (!businessSnapshot.exists()) {
      console.warn(`No business document found for ID: ${businessId}`);
      return null;
    }
    const data = businessSnapshot.data();
    const contact = {
      phoneNumber: data.contact?.phoneNumber || '',
      email: data.contact?.email || '',
    };
    const sanitizedData = removeUndefined({
      id: businessSnapshot.id,
      name: data.name || 'Unnamed Business',
      services: data.services || (data.category ? [data.category] : []),
      description: data.description || '',
      contact,
      location: data.location || '',
      imageUrl: data.imageUrl || data.photoURL || '',
      ownerId: data.ownerId || 'unknown',
      products: data.products || [],
      category: data.category || 'Venue Provider',
    });
    return sanitizedData as BusinessData;
  } catch (error: any) {
    console.error('Error fetching business:', error);
    throw new Error(`Failed to fetch business: ${error.message}`);
  }
};

// Create a business for a user
export const createBusiness = async (
  userId: string,
  name: string,
  bio: string,
  location: string,
  imageUrl: string,
  email: string
): Promise<BusinessData> => {
  try {
    const businessData: BusinessData = {
      id: userId,
      name,
      services: [],
      description: bio || '',
      contact: { phoneNumber: '', email },
      location: location || '',
      imageUrl: imageUrl || '',
      ownerId: userId,
      products: [],
      category: 'Venue Provider',
    };
    // Sanitize the data before writing to Firestore
    const sanitizedData = removeUndefined(businessData);
    await setDoc(doc(db, 'businesses', userId), sanitizedData);
    return sanitizedData as BusinessData;
  } catch (error: any) {
    console.error('Error creating business:', error);
    throw new Error(`Failed to create business: ${error.message}`);
  }
};

// Update a business
export const updateBusiness = async (businessId: string, updatedData: Partial<BusinessData>): Promise<void> => {
  try {
    const businessDocRef = doc(db, 'businesses', businessId);
    // Sanitize the data before updating
    const sanitizedData = removeUndefined(updatedData);
    await updateDoc(businessDocRef, sanitizedData);
  } catch (error: any) {
    console.error('Error updating business:', error);
    throw new Error(`Failed to update business: ${error.message}`);
  }
};

// Delete a business
export const deleteBusiness = async (businessId: string): Promise<void> => {
  try {
    const businessDocRef = doc(db, 'businesses', businessId);
    await deleteDoc(businessDocRef);
  } catch (error: any) {
    console.error('Error deleting business:', error);
    throw new Error(`Failed to delete business: ${error.message}`);
  }
};

// Check if a user has a business
export const hasBusiness = async (userId: string): Promise<boolean> => {
  try {
    const businessDocRef = doc(db, 'businesses', userId);
    const businessSnapshot = await getDoc(businessDocRef);
    return businessSnapshot.exists();
  } catch (error: any) {
    console.error('Error checking business existence:', error);
    throw new Error(`Failed to check business existence: ${error.message}`);
  }
};

// Fetch notifications for a service provider's businesses
export const getNotificationsForServiceProvider = async (businessIds: string[]): Promise<Notification[]> => {
  try {
    const notificationsCol = collection(db, 'notifications');
    const notificationsQuery = query(notificationsCol, where('businessId', 'in', businessIds));
    const snapshot = await getDocs(notificationsQuery);
    if (snapshot.empty) {
      console.log('No notifications found.');
      return [];
    }
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Notification[];
    // Sanitize notifications
    return removeUndefined(notifications) as Notification[];
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }
};

// Mark a notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notificationDocRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationDocRef, { read: true });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
};