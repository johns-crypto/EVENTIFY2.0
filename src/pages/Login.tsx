// src/pages/Login.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendPasswordResetEmail, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../services/firebase';
import { toast } from 'react-toastify';
import { FaEnvelope, FaLock, FaGoogle, FaFacebook, FaEye, FaEyeSlash } from 'react-icons/fa';

function Login() {
  const { login, userRole } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({ email: '', password: '', general: '' });
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = { email: '', password: '', general: '' };
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
      navigate(userRole === 'serviceProvider' ? '/business-profiles' : '/events');
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, general: err.message || 'Login failed. Please check your credentials.' }));
      toast.error('Login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!formData.email) {
      setErrors((prev) => ({ ...prev, email: 'Please enter your email to reset your password' }));
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, general: err.message || 'Failed to send reset email.' }));
      toast.error('Failed to send reset email: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (providerType: 'google' | 'facebook') => {
    setLoading(true);
    try {
      const provider = providerType === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
      await signInWithPopup(auth, provider);
      navigate(userRole === 'serviceProvider' ? '/business-profiles' : '/events');
    } catch (err: any) {
      console.error(`Error during ${providerType} login:`, err);
      setErrors((prev) => ({
        ...prev,
        general:
          err.message ||
          `Failed to login with ${providerType}. Please disable any ad blockers or privacy extensions and try again.`,
      }));
      toast.error(
        `Failed to login with ${providerType}. Please disable any ad blockers or privacy extensions and try again.`
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-100 via-white to-blue-100">
      <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-200 relative">
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
          Welcome Back
        </h2>
        <p className="text-center text-gray-600 mb-6 text-sm sm:text-base">
          Login to Eventify and explore your events
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <div className="relative mt-1">
              <FaEnvelope className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full pl-12 pr-4 py-3 rounded-lg bg-gray-50 border ${
                  errors.email ? 'border-red-500' : 'border-gray-200'
                } text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md`}
                placeholder="you@example.com"
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
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
          </div>

          {errors.general && <p className="text-center text-red-500 text-sm">{errors.general}</p>}
          {resetSent && (
            <p className="text-center text-green-500 text-sm">
              Password reset email sent! Check your inbox.
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-indigo-500 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-md"
            disabled={loading}
          >
            Login
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          <p>
            Note: If you have an ad blocker or privacy extension enabled, you may need to disable it to use Google or
            Facebook login.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => handleSocialLogin('google')}
            className="w-full bg-white text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center justify-center border border-gray-200 transition-all duration-300 hover:scale-105 shadow-sm"
            disabled={loading}
          >
            <FaGoogle className="mr-2 text-red-600" size={18} />
            Login with Google
          </button>
          <button
            onClick={() => handleSocialLogin('facebook')}
            className="w-full bg-[#3b5998] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#2d4373] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-sm"
            disabled={loading}
          >
            <FaFacebook className="mr-2" size={18} />
            Login with Facebook
          </button>
        </div>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Don’t have an account?{' '}
            <Link to="/register" className="text-indigo-600 hover:underline font-semibold">
              Register
            </Link>
          </p>
          <p className="text-sm text-gray-600">
            Forgot your password?{' '}
            <button
              onClick={handleResetPassword}
              className="text-indigo-600 hover:underline font-semibold focus:outline-none"
              disabled={loading}
            >
              Reset it
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;