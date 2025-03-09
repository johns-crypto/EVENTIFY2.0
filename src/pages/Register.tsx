import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FaEnvelope, FaLock, FaUser, FaGoogle, FaFacebook, FaCamera } from 'react-icons/fa';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../services/firebase';

function Register() {
  const { register } = useAuth(); // Assumes register method in context
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    bio: '',
    location: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    displayName: '',
    general: '',
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhotoFile(e.target.files[0]);
    }
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = { email: '', password: '', displayName: '', general: '' };

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
      newErrors.displayName = 'Name is required';
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
      // Register user with email/password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      // Upload photo if provided
      let photoURL = '';
      if (photoFile) {
        const storageRef = ref(storage, `profilePhotos/${user.uid}/${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
        photoURL = await getDownloadURL(storageRef);
      }

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: formData.displayName,
        photoURL: photoURL || '',
      });

      // Save additional data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        displayName: formData.displayName,
        bio: formData.bio || '',
        location: formData.location || '',
        photoURL: photoURL || '',
      });

      // Optionally call register from context if it does additional setup
      await register(formData.email, formData.password);

      navigate('/events');
    } catch (err: any) {
      setErrors({
        email: '',
        password: '',
        displayName: '',
        general: err.message || 'Registration failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (providerType: 'google' | 'facebook') => {
    setLoading(true);
    setErrors({ email: '', password: '', displayName: '', general: '' });
    try {
      const provider =
        providerType === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Save user data to Firestore (only if new user)
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          displayName: user.displayName || 'Anonymous',
          bio: '',
          location: '',
          photoURL: user.photoURL || '',
        });
      }

      navigate('/events');
    } catch (err: any) {
      setErrors({
        email: '',
        password: '',
        displayName: '',
        general: err.message || `Failed to register with ${providerType}.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-md w-full bg-primary-navy p-8 rounded-lg shadow-lg"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <motion.h2 className="text-3xl font-bold text-center text-accent-gold mb-6" variants={fadeIn}>
          Register for Eventify
        </motion.h2>
        <motion.p className="text-center text-neutral-lightGray mb-8" variants={fadeIn}>
          Create an account to start planning and sharing events.
        </motion.p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <motion.div variants={fadeIn}>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-lightGray">
              Email
            </label>
            <div className="relative mt-1">
              <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-darkGray" />
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full pl-10 p-3 rounded bg-neutral-offWhite text-neutral-darkGray focus:outline-none focus:ring-2 focus:ring-secondary-deepRed"
                placeholder="you@example.com"
                disabled={loading}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
            </div>
            {errors.email && (
              <p id="email-error" className="mt-2 text-sm text-red-500">
                {errors.email}
              </p>
            )}
          </motion.div>

          {/* Password Field */}
          <motion.div variants={fadeIn}>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-lightGray">
              Password
            </label>
            <div className="relative mt-1">
              <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-darkGray" />
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full pl-10 p-3 rounded bg-neutral-offWhite text-neutral-darkGray focus:outline-none focus:ring-2 focus:ring-secondary-deepRed"
                placeholder="••••••"
                disabled={loading}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
            </div>
            {errors.password && (
              <p id="password-error" className="mt-2 text-sm text-red-500">
                {errors.password}
              </p>
            )}
          </motion.div>

          {/* Display Name Field */}
          <motion.div variants={fadeIn}>
            <label htmlFor="displayName" className="block text-sm font-medium text-neutral-lightGray">
              Name
            </label>
            <div className="relative mt-1">
              <FaUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-darkGray" />
              <input
                id="displayName"
                name="displayName"
                type="text"
                value={formData.displayName}
                onChange={handleInputChange}
                className="w-full pl-10 p-3 rounded bg-neutral-offWhite text-neutral-darkGray focus:outline-none focus:ring-2 focus:ring-secondary-deepRed"
                placeholder="Your Name"
                disabled={loading}
                aria-describedby={errors.displayName ? 'name-error' : undefined}
              />
            </div>
            {errors.displayName && (
              <p id="name-error" className="mt-2 text-sm text-red-500">
                {errors.displayName}
              </p>
            )}
          </motion.div>

          {/* Bio Field */}
          <motion.div variants={fadeIn}>
            <label htmlFor="bio" className="block text-sm font-medium text-neutral-lightGray">
              Bio (Optional)
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              className="w-full mt-1 p-3 rounded bg-neutral-offWhite text-neutral-darkGray focus:outline-none focus:ring-2 focus:ring-secondary-deepRed"
              placeholder="Tell us about yourself"
              rows={3}
              disabled={loading}
            />
          </motion.div>

          {/* Location Field */}
          <motion.div variants={fadeIn}>
            <label htmlFor="location" className="block text-sm font-medium text-neutral-lightGray">
              Location (Optional)
            </label>
            <input
              id="location"
              name="location"
              type="text"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full mt-1 p-3 rounded bg-neutral-offWhite text-neutral-darkGray focus:outline-none focus:ring-2 focus:ring-secondary-deepRed"
              placeholder="e.g., New York, NY"
              disabled={loading}
            />
          </motion.div>

          {/* Photo Upload */}
          <motion.div variants={fadeIn}>
            <label htmlFor="photoUpload" className="block text-sm font-medium text-neutral-lightGray">
              Profile Photo (Optional)
            </label>
            <div className="relative mt-1">
              <FaCamera className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-darkGray" />
              <input
                id="photoUpload"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="w-full pl-10 p-3 text-neutral-darkGray"
                disabled={loading}
              />
            </div>
            {photoFile && <p className="mt-2 text-sm text-neutral-lightGray">Photo selected</p>}
          </motion.div>

          {/* General Error */}
          {errors.general && (
            <motion.p className="text-center text-red-500" variants={fadeIn}>
              {errors.general}
            </motion.p>
          )}

          {/* Submit Button */}
          <motion.div variants={fadeIn}>
            <button
              type="submit"
              className="w-full bg-secondary-deepRed text-neutral-lightGray px-6 py-3 rounded-lg font-semibold hover:bg-secondary-darkRed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-deepRed disabled:opacity-50 flex items-center justify-center"
              disabled={loading}
            >
              {loading ? (
                <svg
                  className="animate-spin h-5 w-5 mx-auto text-neutral-lightGray"
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
              ) : (
                'Register'
              )}
            </button>
          </motion.div>
        </form>

        {/* Social Login */}
        <motion.div className="mt-6 space-y-4" variants={fadeIn}>
          <button
            onClick={() => handleSocialLogin('google')}
            className="w-full bg-white text-neutral-darkGray px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-deepRed disabled:opacity-50 flex items-center justify-center"
            disabled={loading}
          >
            <FaGoogle className="mr-2 text-red-600" />
            Register with Google
          </button>
          <button
            onClick={() => handleSocialLogin('facebook')}
            className="w-full bg-[#3b5998] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#2d4373] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-deepRed disabled:opacity-50 flex items-center justify-center"
            disabled={loading}
          >
            <FaFacebook className="mr-2" />
            Register with Facebook
          </button>
        </motion.div>

        {/* Login Link */}
        <motion.div className="mt-6 text-center" variants={fadeIn}>
          <p className="text-sm text-neutral-lightGray">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-gold hover:underline font-semibold">
              Login
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Register;