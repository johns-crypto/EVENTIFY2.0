// src/pages/BusinessLogin.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { FaTimes } from 'react-icons/fa';

function BusinessLogin() {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (currentUser && userRole === 'serviceProvider') {
      navigate('/business-profiles');
    }
  }, [currentUser, userRole, navigate]);

  const handleLogin = () => {
    if (!currentUser) {
      setError('Please sign in as a regular user first.');
      toast.error('Please sign in as a regular user first.');
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (userRole !== 'serviceProvider') {
        navigate('/business-register');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to proceed with login.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    navigate('/');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="w-full max-w-md bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-700 relative">
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 focus:outline-none"
          aria-label="Close login modal"
        >
          <FaTimes size={20} />
        </button>
        {loading && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center rounded-2xl">
            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-yellow-400 mb-3">
          Business Login
        </h2>
        <p className="text-center text-gray-400 mb-6 text-sm sm:text-base">
          You must be logged in as a regular user to access business features.
        </p>

        {error && (
          <p className="text-center text-red-500 text-sm mb-4">
            {error.includes('sign in') ? (
              <>
                {error}{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="text-yellow-400 hover:underline font-semibold focus:outline-none"
                >
                  Sign in now
                </button>
              </>
            ) : (
              error
            )}
          </p>
        )}

        <button
          onClick={handleLogin}
          className="w-full px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 rounded-lg font-semibold hover:from-yellow-300 hover:to-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-md"
          disabled={loading}
        >
          Continue to Business Profile
        </button>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-400">
            Not a service provider yet?{' '}
            <button
              onClick={() => navigate('/business-register')}
              className="text-yellow-400 hover:underline font-semibold focus:outline-none"
              disabled={loading}
            >
              Register
            </button>
          </p>
          <p className="text-sm text-gray-400">
            By logging in, you agree to our{' '}
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

export default BusinessLogin;