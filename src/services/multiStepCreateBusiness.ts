// src/services/multiStepCreateBusiness.ts
import { useState, useCallback } from 'react';
import { db } from './firebase';
import { addDoc, collection } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { uploadImageToCloudinary } from '../utils/cloudinary';

interface BusinessData {
  id: string;
  name: string;
  services: string[];
  description: string;
  contact: string;
  location: string;
  imageUrl?: string;
  ownerId: string;
  products: { name: string; description: string; imageUrl?: string; inStock: boolean }[];
}

interface MultiStepBusinessData {
  name: string;
  services: string[];
  description: string;
  contact: string;
  location: string;
  imageUrl?: string;
}

interface MultiStepCreateBusinessProps {
  userId: string;
  onSuccess: (newBusiness: BusinessData) => void;
  onError: (message: string) => void;
}

export const multiStepCreateBusiness = ({ userId, onSuccess, onError }: MultiStepCreateBusinessProps) => {
  const [step, setStep] = useState(1);
  const [newBusiness, setNewBusiness] = useState<MultiStepBusinessData>({
    name: '',
    services: [],
    description: '',
    contact: '',
    location: '',
    imageUrl: '',
  });
  const [loading, setLoading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setLoading(true);
        const imageUrl = await uploadImageToCloudinary(file);
        setNewBusiness((prev) => ({ ...prev, imageUrl }));
        toast.success('Image uploaded successfully!');
      } catch (error) {
        onError((error as Error).message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNextStep = useCallback(() => {
    if (step === 1) {
      if (!newBusiness.name.trim()) {
        onError('Business name is required.');
        return;
      }
      if (newBusiness.services.length === 0) {
        onError('Please select at least one service.');
        return;
      }
    } else if (step === 2) {
      if (!newBusiness.contact.trim()) {
        onError('Contact information is required.');
        return;
      }
    }
    setStep((prev) => prev + 1);
  }, [step, newBusiness, onError]);

  const handlePrevStep = useCallback(() => {
    setStep((prev) => prev - 1);
  }, []);

  const handleCreateBusiness = useCallback(async () => {
    if (!userId) {
      onError('User not authenticated.');
      return;
    }

    setLoading(true);
    try {
      const businessData: Omit<BusinessData, 'id' | 'products'> = {
        name: newBusiness.name,
        services: newBusiness.services,
        description: newBusiness.description,
        contact: newBusiness.contact,
        location: newBusiness.location,
        imageUrl: newBusiness.imageUrl,
        ownerId: userId,
      };

      const docRef = await addDoc(collection(db, 'businesses'), {
        ...businessData,
        products: [], // Initialize products as an empty array
      });
      onSuccess({ ...businessData, id: docRef.id, products: [] });
    } catch (error) {
      onError('Failed to create business: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [newBusiness, userId, onSuccess, onError]);

  return {
    step,
    newBusiness,
    setNewBusiness,
    handleNextStep,
    handlePrevStep,
    handleCreateBusiness,
    handleImageUpload,
    loading,
  };
};