import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FaEnvelope, FaLock, FaGoogle, FaFacebook } from 'react-icons/fa'; // Icons
import { sendPasswordResetEmail, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../services/firebase';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({ email: '', password: '', general: '' });
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = { email: '', password: '', general: '' };

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

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrors({ email: '', password: '', general: '' });

    try {
      await login(formData.email, formData.password);
      navigate('/events');
    } catch (err: any) {
      setErrors({
        email: '',
        password: '',
        general: err.message || 'Login failed. Please check your credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!formData.email) {
      setErrors({ ...errors, email: 'Please enter your email to reset your password' });
      return;
    }
    setLoading(true);
    setErrors({ email: '', password: '', general: '' });
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000); // Hide message after 5s
    } catch (err: any) {
      setErrors({ ...errors, general: err.message || 'Failed to send reset email.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (providerType: 'google' | 'facebook') => {
    setLoading(true);
    setErrors({ email: '', password: '', general: '' });
    try {
      const provider =
        providerType === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/events');
    } catch (err: any) {
      setErrors({ ...errors, general: err.message || `Failed to login with ${providerType}.` });
    } finally {
      setLoading(false);
    }
  };

  // Animation variants
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
          Login to Eventify
        </motion.h2>
        <motion.p className="text-center text-neutral-lightGray mb-8" variants={fadeIn}>
          Access your events and moments.
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

          {/* General Error or Reset Success */}
          {errors.general && (
            <motion.p className="text-center text-red-500" variants={fadeIn}>
              {errors.general}
            </motion.p>
          )}
          {resetSent && (
            <motion.p className="text-center text-green-500" variants={fadeIn}>
              Password reset email sent! Check your inbox.
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
                'Login'
              )}
            </button>
          </motion.div>
        </form>

        {/* Social Login Buttons */}
        <motion.div className="mt-6 space-y-4" variants={fadeIn}>
          <button
            onClick={() => handleSocialLogin('google')}
            className="w-full bg-white text-neutral-darkGray px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-deepRed disabled:opacity-50 flex items-center justify-center"
            disabled={loading}
          >
            <FaGoogle className="mr-2 text-red-600" />
            Login with Google
          </button>
          <button
            onClick={() => handleSocialLogin('facebook')}
            className="w-full bg-[#3b5998] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#2d4373] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-deepRed disabled:opacity-50 flex items-center justify-center"
            disabled={loading}
          >
            <FaFacebook className="mr-2" />
            Login with Facebook
          </button>
        </motion.div>

        {/* Additional Links */}
        <motion.div className="mt-6 text-center space-y-2" variants={fadeIn}>
          <p className="text-sm text-neutral-lightGray">
            Don’t have an account?{' '}
            <Link to="/register" className="text-accent-gold hover:underline font-semibold">
              Register
            </Link>
          </p>
          <p className="text-sm text-neutral-lightGray">
            Forgot your password?{' '}
            <button
              onClick={handleResetPassword}
              className="text-accent-gold hover:underline font-semibold focus:outline-none"
              disabled={loading}
            >
              Reset it
            </button>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Login;