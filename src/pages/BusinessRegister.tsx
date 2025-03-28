// src/pages/BusinessRegister.tsx
import { useState, useEffect, useRef } from 'react'; // Add useRef
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { updateProfile, GoogleAuthProvider, FacebookAuthProvider, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { uploadImageToCloudinary } from '../utils/cloudinary';
import { toast } from 'react-toastify';
import { FaEnvelope, FaLock, FaUser, FaGoogle, FaFacebook, FaCamera, FaEye, FaEyeSlash, FaTimes } from 'react-icons/fa';

function BusinessRegister() {
  const { register, currentUser } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    bio: '',
    location: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    displayName: '',
    general: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [isSocialLoginRedirect, setIsSocialLoginRedirect] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null); // Add ref for email input

  useEffect(() => {
    if (!isSocialLoginRedirect) return;

    const handleRedirectResult = async () => {
      try {
        console.log('Checking for redirect result...');
        const result = await getRedirectResult(auth);
        if (result) {
          console.log('Redirect result received:', result);
          const user = result.user;
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            console.log('Creating new user document for UID:', user.uid);
            await setDoc(doc(db, 'users', user.uid), {
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
              role: 'serviceProvider',
            });
          } else {
            console.log('User document already exists:', userDoc.data());
          }

          const redirectUrl = localStorage.getItem('redirectAfterAuth');
          console.log('Redirect URL from local storage:', redirectUrl);
          if (redirectUrl) {
            localStorage.removeItem('redirectAfterAuth');
            navigate(redirectUrl);
          } else {
            navigate('/business-profiles');
          }
        } else {
          console.log('No redirect result found.');
        }
      } catch (err: any) {
        console.error('Error handling redirect result:', err);
        let errorMessage = err.message || 'Failed to complete registration. Please try again.';
        if (err.message.includes('network')) {
          errorMessage = 'Failed to connect to the authentication provider. Please disable ad blockers or privacy extensions and try again.';
        }
        setErrors((prev) => ({
          ...prev,
          general: errorMessage,
        }));
        toast.error(errorMessage);
      } finally {
        setLoading(false);
        setIsSocialLoginRedirect(false);
      }
    };

    handleRedirectResult();
  }, [isSocialLoginRedirect, navigate]);

  useEffect(() => {
    // If the user is already logged in and has the correct role, redirect them
    if (currentUser) {
      const checkUserRole = async () => {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists() && userDoc.data().role === 'serviceProvider') {
          navigate('/business-profiles');
        }
      };
      checkUserRole();
    }
  }, [currentUser, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));

    if (name === 'password') {
      let strength = 0;
      if (value.length > 5) strength += 25;
      if (value.match(/[A-Z]/)) strength += 25;
      if (value.match(/[0-9]/)) strength += 25;
      if (value.match(/[^A-Za-z0-9]/)) strength += 25;
      setPasswordStrength(strength);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const validateForm = () => {
    const newErrors = { email: '', password: '', displayName: '', general: '' };
    let isValid = true;

    if (!formData.email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

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

    setLoading(true);
    setErrors({ email: '', password: '', displayName: '', general: '' });

    try {
      console.log('Registering user with email:', formData.email);
      await register(formData.email, formData.password, formData.displayName);
      const user = auth.currentUser;
      if (!user) throw new Error('User not found after registration');

      let photoURL = '';
      if (photoFile) {
        console.log('Uploading photo to Cloudinary...');
        photoURL = await uploadImageToCloudinary(photoFile);
        await updateProfile(user, { photoURL });
      }

      console.log('Creating user document for UID:', user.uid);
      await setDoc(doc(db, 'users', user.uid), {
        displayName: formData.displayName,
        email: formData.email,
        createdAt: new Date().toISOString(),
        bio: formData.bio || '',
        location: formData.location || '',
        photoURL: photoURL || '',
        contactEmail: formData.email,
        contactPhone: '',
        followers: [],
        following: [],
        notificationsEnabled: true,
        role: 'serviceProvider',
      });

      console.log('Registration successful, navigating to /business-profiles');
      navigate('/business-profiles');
    } catch (err: any) {
      console.error('Error during registration:', err);
      let errorMessage;
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use. Try logging in or resetting your password.';
        setFormData((prev) => ({ ...prev, email: '' })); // Clear the email field
        if (emailInputRef.current) {
          emailInputRef.current.focus(); // Focus the email input
        }
      } else if (err.message.includes('network')) {
        errorMessage = 'Failed to connect to the authentication provider. Please disable ad blockers or privacy extensions and try again.';
      } else {
        errorMessage = err.message || 'Registration failed.';
      }
      setErrors((prev) => ({
        ...prev,
        general: errorMessage,
      }));
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
        setPhotoPreview(null);
      }
    }
  };

  const handleSocialLogin = async (providerType: 'google' | 'facebook') => {
    setLoading(true);
    setIsSocialLoginRedirect(true);
    try {
      console.log(`Initiating ${providerType} social login...`);
      const provider = providerType === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
      localStorage.setItem('redirectAfterAuth', '/business-profiles');
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error(`Error during ${providerType} registration:`, err);
      let errorMessage = err.message || `Failed to initiate registration with ${providerType}. Please try again.`;
      if (err.message.includes('network')) {
        errorMessage = `Failed to connect to ${providerType}. Please disable ad blockers or privacy extensions and try again.`;
      }
      setErrors((prev) => ({
        ...prev,
        general: errorMessage,
      }));
      toast.error(errorMessage);
      setLoading(false);
      setIsSocialLoginRedirect(false);
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    navigate('/');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-200 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 focus:outline-none"
        >
          <FaTimes size={20} />
        </button>
        {loading && (
          <div className="absolute inset-0 bg-gray-200 bg-opacity-50 flex items-center justify-center rounded-2xl">
            <svg
              className="animate-spin h-8 w-8 text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-indigo-900 mb-3">
          Join Eventify as a Service Provider
        </h2>
        <p className="text-center text-gray-600 mb-6 text-sm sm:text-base">
          Create a business account to offer your services
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Business Email Address
            </label>
            <div className="relative mt-1">
              <FaEnvelope className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                ref={emailInputRef} // Add ref to the email input
                className={`w-full pl-12 pr-4 py-3 rounded-lg bg-gray-50 border ${
                  errors.email || errors.general.includes('email is already in use') ? 'border-red-500' : 'border-gray-200'
                } text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md`}
                placeholder="business@example.com"
                disabled={loading}
              />
            </div>
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative mt-1">
              <FaLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full pl-12 pr-12 py-3 rounded-lg bg-gray-50 border ${
                  errors.password ? 'border-red-500' : 'border-gray-200'
                } text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md`}
                placeholder="••••••"
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
            {formData.password && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      passwordStrength <= 25
                        ? 'bg-red-500'
                        : passwordStrength <= 50
                        ? 'bg-yellow-500'
                        : passwordStrength <= 75
                        ? 'bg-blue-500'
                        : 'bg-green-500'
                    } strength-bar-${passwordStrength}`}
                    style={{ width: `${passwordStrength}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Password Strength:{' '}
                  {passwordStrength <= 25
                    ? 'Weak'
                    : passwordStrength <= 50
                    ? 'Fair'
                    : passwordStrength <= 75
                    ? 'Good'
                    : 'Strong'}
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
              Business Name
            </label>
            <div className="relative mt-1">
              <FaUser className="absolute left-4 top-1/2 transform -translate-y-1/2 thext-gray-400" size={18} />
              <input
                id="displayName"
                name="displayName"
                type="text"
                value={formData.displayName}
                onChange={handleInputChange}
                className={`w-full pl-12 pr-4 py-3 rounded-lg bg-gray-50 border ${
                  errors.displayName ? 'border-red-500' : 'border-gray-200'
                } text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md`}
                placeholder="Your Business Name"
                disabled={loading}
              />
            </div>
            {errors.displayName && <p className="mt-1 text-sm text-red-500">{errors.displayName}</p>}
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
              Business Bio (Optional)
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              className="w-full mt-1 p-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              placeholder="Tell us about your business"
              rows={3}
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700">
              Business Location (Optional)
            </label>
            <input
              id="location"
              name="location"
              type="text"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full mt-1 p-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              placeholder="e.g., New York, NY"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="photoUpload" className="block text-sm font-medium text-gray-700">
              Business Profile Photo (Optional)
            </label>
            <div className="relative mt-1">
              <FaCamera className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="photoUpload"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="w-full pl-12 pr-4 py-3 text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-600 hover:file:bg-indigo-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                disabled={loading}
              />
            </div>
            {photoPreview && (
              <div className="mt-3 flex justify-center">
                <img
                  src={photoPreview}
                  alt="Business profile preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-indigo-300 shadow-sm"
                />
              </div>
            )}
          </div>

          {errors.general && (
            <p className="text-center text-red-500 text-sm">
              {errors.general.includes('email is already in use') ? (
                <>
                  This email is already in use. Try{' '}
                  <button
                    onClick={() => navigate('/business-login')}
                    className="text-indigo-600 hover:underline font-semibold focus:outline-none"
                    disabled={loading}
                  >
                    logging in
                  </button>{' '}
                  or{' '}
                  <button
                    onClick={() => navigate('/forgot-password')}
                    className="text-indigo-600 hover:underline font-semibold focus:outline-none"
                    disabled={loading}
                  >
                    resetting your password
                  </button>.
                </>
              ) : (
                errors.general
              )}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-indigo-500 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-md"
            disabled={loading}
          >
            Register Business
          </button>
        </form>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => handleSocialLogin('google')}
            className="w-full bg-white text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center justify-center border border-gray-200 transition-all duration-300 hover:scale-105 shadow-sm"
            disabled={loading}
          >
            <FaGoogle className="mr-2 text-red-600" size={18} />
            Register with Google
          </button>
          <button
            onClick={() => handleSocialLogin('facebook')}
            className="w-full bg-[#3b5998] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#2d4373] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-sm"
            disabled={loading}
          >
            <FaFacebook className="mr-2" size={18} />
            Register with Facebook
          </button>
        </div>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Already have a business account?{' '}
            <button
              onClick={() => navigate('/business-login')}
              className="text-indigo-600 hover:underline font-semibold focus:outline-none"
              disabled={loading}
            >
              Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default BusinessRegister;