// src/components/Navbar.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';

function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      toast.error('Failed to log out.');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/events?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setIsSearchActive(false);
    }
  };

  // Animation for search input
  const searchVariants = {
    hidden: { opacity: 0, width: 0 },
    visible: { opacity: 1, width: '200px', transition: { duration: 0.3, ease: 'easeInOut' } },
  };

  return (
    <nav className="bg-primary-navy p-4 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand on the left */}
        <Link to="/" className="text-2xl font-bold text-accent-gold">
          Eventify
        </Link>

        {/* Links and Search on the right */}
        <div className="flex items-center space-x-6">
          <Link to="/" className="text-neutral-lightGray hover:text-accent-gold">
            Home
          </Link>
          <Link to="/feed" className="text-neutral-lightGray hover:text-accent-gold">
            Feed
          </Link>
          <Link to="/settings" className="text-neutral-lightGray hover:text-accent-gold">
            Settings
          </Link>
          {currentUser && (
            <button
              onClick={handleLogout}
              className="text-neutral-lightGray hover:text-accent-gold"
            >
              Logout
            </button>
          )}

          {/* Search Icon and Animated Input */}
          <div className="relative flex items-center">
            <button
              onClick={() => setIsSearchActive(!isSearchActive)}
              className="text-accent-gold hover:text-neutral-darkGray focus:outline-none"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
            {isSearchActive && (
              <motion.form
                onSubmit={handleSearch}
                className="absolute right-8 top-1/2 transform -translate-y-1/2"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={searchVariants}
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events..."
                  className="p-2 rounded bg-neutral-offWhite text-neutral-darkGray focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  autoFocus
                  onBlur={() => setIsSearchActive(false)}
                />
              </motion.form>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;