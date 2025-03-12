import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

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
    }
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

          {/* Search Input (Small and to the right) */}
          <form onSubmit={handleSearch} className="flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-32 p-1 rounded bg-neutral-offWhite text-neutral-darkGray text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold"
            />
          </form>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;