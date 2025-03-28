// src/pages/BusinessFormModal.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, addDoc, updateDoc, doc, collection } from '../services/firebase';
import { motion } from 'framer-motion';
import { FaBuilding, FaPhone, FaEnvelope, FaMapMarkerAlt, FaImage, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { uploadImageToCloudinary } from '../utils/cloudinary';

interface Business {
  id: string;
  name: string;
  services: string[];
  description: string;
  contact: { phoneNumber: string; email?: string };
  location: string;
  imageUrl?: string;
  ownerId: string;
  products: { name: string; description: string; imageUrl?: string; inStock: boolean; category?: string }[];
}

interface FormErrors {
  name?: string;
  services?: string;
  description?: string;
  phoneNumber?: string;
  email?: string;
  location?: string;
}

interface BusinessFormModalProps {
  editingBusiness: Business | null;
  onClose: () => void;
  onSave: (business: Business) => void;
}

const LazyImage = ({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      onLoad={() => setIsLoaded(true)}
      loading="lazy"
    />
  );
};

function BusinessFormModal({ editingBusiness, onClose, onSave }: BusinessFormModalProps) {
  const { currentUser, userRole } = useAuth();
  const [formData, setFormData] = useState({
    name: editingBusiness?.name || '',
    services: editingBusiness?.services || [],
    description: editingBusiness?.description || '',
    contact: { phoneNumber: editingBusiness?.contact.phoneNumber || '', email: editingBusiness?.contact.email || '' },
    location: editingBusiness?.location || '',
    imageUrl: editingBusiness?.imageUrl || '',
    products: editingBusiness?.products || [],
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [imageUploading, setImageUploading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const serviceOptions = ['Catering', 'Refreshments', 'Venue Provider'];

  useEffect(() => {
    if (modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      firstElement?.focus();
    }
  }, []);

  const validateForm = () => {
    const errors: FormErrors = {};
    if (!formData.name.trim()) errors.name = 'Business name is required.';
    if (formData.services.length === 0)
      errors.services = 'Please select at least one service.';
    if (!formData.description.trim())
      errors.description = 'Description is required.';
    if (!formData.contact.phoneNumber.trim())
      errors.phoneNumber = 'Phone number is required.';
    else if (!/^\+?[1-9]\d{1,14}$/.test(formData.contact.phoneNumber))
      errors.phoneNumber = 'Please enter a valid phone number (e.g., +1234567890).';
    if (formData.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact.email))
      errors.email = 'Please enter a valid email address.';
    if (!formData.location.trim()) errors.location = 'Location is required.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber' || name === 'email') {
      setFormData((prev) => ({
        ...prev,
        contact: { ...prev.contact, [name]: value },
      }));
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleServiceChange = (service: string) => {
    setFormData((prev) => {
      const services = prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service];
      return { ...prev, services };
    });
    setFormErrors((prev) => ({ ...prev, services: undefined }));
  };

  const handleImageUploadLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageUploading(true);
      try {
        const imageUrl = await uploadImageToCloudinary(file);
        setFormData((prev) => ({ ...prev, imageUrl }));
        toast.success('Image uploaded successfully!');
      } catch (error) {
        toast.error('Failed to upload image: ' + (error as Error).message);
      } finally {
        setImageUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!currentUser || userRole !== 'serviceProvider') {
      toast.error('You must be a registered service provider to perform this action.');
      return;
    }

    try {
      if (editingBusiness) {
        const businessRef = doc(db, 'businesses', editingBusiness.id);
        await updateDoc(businessRef, {
          ...formData,
          ownerId: currentUser.uid,
          products: formData.products,
        });
        onSave({ ...formData, id: editingBusiness.id, ownerId: currentUser.uid });
        toast.success('Business updated successfully!');
      } else {
        const docRef = await addDoc(collection(db, 'businesses'), {
          ...formData,
          ownerId: currentUser.uid,
          products: [],
        });
        onSave({ ...formData, id: docRef.id, ownerId: currentUser.uid, products: [] });
        toast.success('Business created successfully!');
      }
      onClose();
    } catch (error) {
      toast.error('Failed to save business: ' + (error as Error).message);
    }
  };

  const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <motion.div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-md w-full bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700/30 flex flex-col max-h-[90vh] sm:max-h-[80vh]"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b border-gray-700">
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-yellow-400">
            {editingBusiness ? 'Edit Business' : 'Create Business'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <FaTimes size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div variants={fadeIn}>
              <label htmlFor="nameInput" className="block text-sm font-medium text-yellow-400">
                Business Name <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <FaBuilding className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="nameInput"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 rounded-lg bg-gray-700/50 text-gray-200 border ${formErrors.name ? 'border-red-500' : 'border-gray-600/50'} focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 text-sm sm:text-base`}
                  placeholder="Business Name"
                  aria-describedby={formErrors.name ? 'name-error' : undefined}
                />
              </div>
              {formErrors.name && (
                <p id="name-error" className="mt-1 text-xs text-red-500">
                  {formErrors.name}
                </p>
              )}
            </motion.div>

            <motion.div variants={fadeIn}>
              <label className="block text-sm font-medium text-yellow-400">
                Services <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                {serviceOptions.map((service) => (
                  <label key={service} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.services.includes(service)}
                      onChange={() => handleServiceChange(service)}
                      className="mr-1 accent-yellow-400 h-4 w-4"
                    />
                    <span className="text-xs sm:text-sm text-gray-300">{service}</span>
                  </label>
                ))}
              </div>
              {formErrors.services && (
                <p className="mt-1 text-xs text-red-500">{formErrors.services}</p>
              )}
            </motion.div>

            <motion.div variants={fadeIn}>
              <label htmlFor="descriptionTextarea" className="block text-sm font-medium text-yellow-400">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="descriptionTextarea"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className={`w-full mt-1 p-2 sm:p-3 rounded-lg bg-gray-700/50 text-gray-200 border ${formErrors.description ? 'border-red-500' : 'border-gray-600/50'} focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 text-sm sm:text-base`}
                rows={2}
                placeholder="Describe your business"
                aria-describedby={formErrors.description ? 'description-error' : undefined}
              />
              {formErrors.description && (
                <p id="description-error" className="mt-1 text-xs text-red-500">
                  {formErrors.description}
                </p>
              )}
            </motion.div>

            <motion.div variants={fadeIn}>
              <label htmlFor="phoneNumberInput" className="block text-sm font-medium text-yellow-400">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <FaPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="phoneNumberInput"
                  name="phoneNumber"
                  value={formData.contact.phoneNumber}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 rounded-lg bg-gray-700/50 text-gray-200 border ${formErrors.phoneNumber ? 'border-red-500' : 'border-gray-600/50'} focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 text-sm sm:text-base`}
                  placeholder="+1234567890"
                  aria-describedby={formErrors.phoneNumber ? 'phoneNumber-error' : undefined}
                />
              </div>
              {formErrors.phoneNumber && (
                <p id="phoneNumber-error" className="mt-1 text-xs text-red-500">
                  {formErrors.phoneNumber}
                </p>
              )}
            </motion.div>

            <motion.div variants={fadeIn}>
              <label htmlFor="emailInput" className="block text-sm font-medium text-yellow-400">
                Email (Optional)
              </label>
              <div className="relative mt-1">
                <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="emailInput"
                  name="email"
                  value={formData.contact.email}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 rounded-lg bg-gray-700/50 text-gray-200 border ${formErrors.email ? 'border-red-500' : 'border-gray-600/50'} focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 text-sm sm:text-base`}
                  placeholder="business@example.com"
                  aria-describedby={formErrors.email ? 'email-error' : undefined}
                />
              </div>
              {formErrors.email && (
                <p id="email-error" className="mt-1 text-xs text-red-500">
                  {formErrors.email}
                </p>
              )}
            </motion.div>

            <motion.div variants={fadeIn}>
              <label htmlFor="locationInput" className="block text-sm font-medium text-yellow-400">
                Location <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <FaMapMarkerAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="locationInput"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 rounded-lg bg-gray-700/50 text-gray-200 border ${formErrors.location ? 'border-red-500' : 'border-gray-600/50'} focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 text-sm sm:text-base`}
                  placeholder="e.g., New York, NY"
                  aria-describedby={formErrors.location ? 'location-error' : undefined}
                />
              </div>
              {formErrors.location && (
                <p id="location-error" className="mt-1 text-xs text-red-500">
                  {formErrors.location}
                </p>
              )}
            </motion.div>

            <motion.div variants={fadeIn}>
              <label htmlFor="imageInput" className="block text-sm font-medium text-yellow-400">
                Business Image (Optional)
              </label>
              <div className="relative mt-1">
                <FaImage className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="imageInput"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUploadLocal}
                  className="w-full pl-10 pr-3 py-2 text-gray-200 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-400 file:text-gray-900 hover:file:bg-yellow-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  disabled={imageUploading}
                />
                {imageUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-700/80 rounded-lg">
                    <svg
                      className="animate-spin h-5 w-5 text-yellow-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                )}
              </div>
              {formData.imageUrl && !imageUploading && (
                <div className="mt-2 flex justify-center">
                  <LazyImage
                    src={formData.imageUrl}
                    alt="Business Preview"
                    className="w-16 h-16 rounded-lg object-cover border-2 border-gray-600"
                  />
                </div>
              )}
            </motion.div>
          </form>
        </div>

        <div className="p-3 sm:p-4 lg:p-5 border-t border-gray-700 bg-gray-800/90">
          <motion.div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-2" variants={fadeIn}>
            <button
              type="submit"
              onClick={handleSubmit}
              className="w-full px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 rounded-lg font-semibold hover:from-yellow-300 hover:to-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:opacity-50 transition-all duration-300 hover:scale-105 text-sm sm:text-base"
              disabled={imageUploading}
            >
              {editingBusiness ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-600/50 text-gray-200 rounded-lg font-semibold hover:bg-gray-500/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all duration-300 hover:scale-105 text-sm sm:text-base"
              disabled={imageUploading}
            >
              Cancel
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default BusinessFormModal;