import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { FaSearch, FaBars, FaTimes } from 'react-icons/fa';

function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      setIsMenuOpen(false);
    } catch (error) {
      toast.error('Failed to log out.');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/events?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setIsSearchOpen(false);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-primary-navy p-4 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand on the left */}
        <Link to="/" className="text-2xl font-bold text-accent-gold">
          Eventify
        </Link>

        {/* Right side: Links, Search, and Hamburger menu */}
        <div className="flex items-center space-x-4">
          {/* Always Visible Links */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-neutral-lightGray hover:text-accent-gold">
              Home
            </Link>
            <Link to="/feed" className="text-neutral-lightGray hover:text-accent-gold">
              Feed
            </Link>
            <Link to="/chat" className="text-neutral-lightGray hover:text-accent-gold">
              Chat
            </Link>
          </div>

          {/* Search Icon and Input */}
          <div className="relative flex items-center">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="text-neutral-lightGray hover:text-accent-gold focus:outline-none"
              aria-label={isSearchOpen ? 'Close search' : 'Open search'}
            >
              <FaSearch size={20} />
            </button>
            {isSearchOpen && (
              <form onSubmit={handleSearch} className="absolute right-0 top-10 z-10">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events..."
                  className="w-48 p-2 rounded bg-neutral-offWhite text-neutral-darkGray text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold shadow-md"
                  autoFocus
                  onBlur={() => setTimeout(() => setIsSearchOpen(false), 100)}
                />
              </form>
            )}
          </div>

          {/* Hamburger Menu */}
          <div className="relative">
            <button
              onClick={toggleMenu}
              className="text-neutral-lightGray hover:text-accent-gold focus:outline-none"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
            </button>

            {/* Dropdown Menu (Mobile and Desktop) */}
            {isMenuOpen && (
              <div className="absolute right-0 top-12 w-48 bg-primary-navy rounded-md shadow-lg z-20">
                <div className="flex flex-col p-2">
                  {/* Mobile-only Home, Feed, and Chat */}
                  <div className="md:hidden">
                    <Link
                      to="/"
                      className="py-2 px-4 text-neutral-lightGray hover:text-accent-gold"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Home
                    </Link>
                    <Link
                      to="/feed"
                      className="py-2 px-4 text-neutral-lightGray hover:text-accent-gold"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Feed
                    </Link>
                    <Link
                      to="/chat"
                      className="py-2 px-4 text-neutral-lightGray hover:text-accent-gold"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Chat
                    </Link>
                  </div>
                  {/* Dropdown Items */}
                  <Link
                    to="/profile"
                    className="py-2 px-4 text-neutral-lightGray hover:text-accent-gold"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="py-2 px-4 text-neutral-lightGray hover:text-accent-gold"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  {currentUser && (
                    <>
                      <Link
                        to="/business"
                        className="py-2 px-4 text-neutral-lightGray hover:text-accent-gold"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Register Business
                      </Link>
                      <Link
                        to="/business-profile"
                        className="py-2 px-4 text-neutral-lightGray hover:text-accent-gold"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Business Profile
                      </Link>
                      <Link
                        to="/media-editor"
                        className="py-2 px-4 text-neutral-lightGray hover:text-accent-gold"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Media Editor
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="py-2 px-4 text-neutral-lightGray hover:text-accent-gold text-left"
                      >
                        Logout
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;