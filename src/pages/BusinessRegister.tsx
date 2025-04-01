// src/pages/BusinessRegister.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createBusiness } from '../services/businessService';
import { uploadImageToCloudinary } from '../utils/cloudinary';
import { toast } from 'react-toastify';
import { FaUser, FaCamera, FaTimes } from 'react-icons/fa';

function BusinessRegister() {
  const { currentUser, userRole, updateUserRole } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    displayName: currentUser?.displayName || '',
    bio: '',
    location: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(currentUser?.photoURL || null);
  const [errors, setErrors] = useState({
    displayName: '',
    general: '',
  });
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const displayNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser && userRole === 'serviceProvider') {
      navigate('/business-profiles');
    }
  }, [currentUser, userRole, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const validateForm = () => {
    const newErrors = { displayName: '', general: '' };
    let isValid = true;

    if (!formData.displayName) {
      newErrors.displayName = 'Business Name is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!currentUser) {
      setErrors((prev) => ({ ...prev, general: 'Please sign in as a regular user first.' }));
      toast.error('Please sign in as a regular user first.');
      navigate('/login');
      return;
    }

    setLoading(true);
    setErrors({ displayName: '', general: '' });

    try {
      let photoURL = currentUser.photoURL || '';
      if (photoFile) {
        photoURL = await uploadImageToCloudinary(photoFile);
      }

      // Update user role to serviceProvider
      await updateUserRole('serviceProvider');

      // Create a business for the user
      await createBusiness(
        currentUser.uid,
        formData.displayName,
        formData.bio,
        formData.location,
        photoURL,
        currentUser.email || ''
      );

      toast.success('Successfully registered as a service provider!');
      navigate('/business-profiles');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to register as a service provider.';
      setErrors((prev) => ({ ...prev, general: errorMessage }));
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      if (photoPreview && photoFile) {
        URL.revokeObjectURL(photoPreview);
        setPhotoPreview(null);
      }
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    navigate('/');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="w-full max-w-md bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-700 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 focus:outline-none"
          aria-label="Close registration modal"
        >
          <FaTimes size={20} />
        </button>
        {loading && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center rounded-2xl">
            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-yellow-400 mb-3">
          Register as a Service Provider
        </h2>
        <p className="text-center text-gray-400 mb-6 text-sm sm:text-base">
          You must be logged in as a regular user to register as a service provider.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-300">
              Business Name
            </label>
            <div className="relative mt-1">
              <FaUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="displayName"
                name="displayName"
                type="text"
                value={formData.displayName}
                onChange={handleInputChange}
                ref={displayNameInputRef}
                className={`w-full pl-12 pr-4 py-3 rounded-lg bg-gray-700 border ${
                  errors.displayName ? 'border-red-500' : 'border-gray-600'
                } text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md`}
                placeholder="Your Business Name"
                disabled={loading}
              />
            </div>
            {errors.displayName && <p className="mt-1 text-sm text-red-500">{errors.displayName}</p>}
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-300">
              Business Bio (Optional)
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              className="w-full mt-1 p-4 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              placeholder="Tell us about your business"
              rows={3}
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-300">
              Business Location (Optional)
            </label>
            <input
              id="location"
              name="location"
              type="text"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full mt-1 p-4 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              placeholder="e.g., New York, NY"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="photoUpload" className="block text-sm font-medium text-gray-300">
              Business Profile Photo (Optional)
            </label>
            <div className="relative mt-1">
              <FaCamera className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="photoUpload"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="w-full pl-12 pr-4 py-3 text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-400 file:text-gray-900 hover:file:bg-yellow-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                disabled={loading}
              />
            </div>
            {photoPreview && (
              <div className="mt-3 flex justify-center">
                <img
                  src={photoPreview}
                  alt="Business profile preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-yellow-400 shadow-sm"
                />
              </div>
            )}
          </div>

          {errors.general && (
            <p className="text-center text-red-500 text-sm">
              {errors.general.includes('sign in') ? (
                <>
                  {errors.general}{' '}
                  <button
                    onClick={() => navigate('/login')}
                    className="text-yellow-400 hover:underline font-semibold focus:outline-none"
                    disabled={loading}
                  >
                    Sign in now
                  </button>
                </>
              ) : (
                errors.general
              )}
            </p>
          )}

          <button
            type="submit"
            className="w-full px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 rounded-lg font-semibold hover:from-yellow-300 hover:to-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:opacity-50 flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-md"
            disabled={loading || !currentUser}
          >
            {loading ? 'Registering...' : 'Register as Service Provider'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-400">
            Already a service provider?{' '}
            <button
              onClick={() => navigate('/business-login')}
              className="text-yellow-400 hover:underline font-semibold focus:outline-none"
              disabled={loading}
            >
              Login
            </button>
          </p>
          <p className="text-sm text-gray-400">
            By registering, you agree to our{' '}
            <a href="/terms" className="text-yellow-400 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-yellow-400 hover:underline">
              Privacy Policy
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default BusinessRegister;