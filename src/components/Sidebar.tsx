import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { FaSearch, FaCalendarAlt, FaInfoCircle, FaSignOutAlt, FaChevronLeft, FaChevronRight, FaUser, FaBars, FaHome } from 'react-icons/fa';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { motion } from 'framer-motion';

interface Business {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  photoURL?: string;
}

interface SidebarProps {
  children?: React.ReactNode;
}

function Sidebar({ children }: SidebarProps) {
  const { logout, userProfile } = useAuth();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false); // Default to collapsed
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const businessSnapshot = await getDocs(collection(db, 'businesses'));
        const businessList = businessSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Business[];
        setBusinesses(businessList.slice(0, 5));
      } catch (error) {
        toast.error('Failed to load businesses.');
      }
    };
    fetchBusinesses();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    if (loadingLogout) return;
    setLoadingLogout(true);
    try {
      await logout();
      navigate('/');
    } catch (error) {
      toast.error('Failed to log out.');
    } finally {
      setLoadingLogout(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 3) {
      toast.error('Search query must be at least 3 characters.');
      return;
    }
    navigate(`/search?query=${encodeURIComponent(searchQuery)}`);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    setIsExpanded(!isMobileMenuOpen); // Expand fully when opening, collapse when closing
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const headingFade = {
    hidden: { opacity: 0, y: -30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut', type: 'spring', bounce: 0.3 },
    },
  };

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray flex flex-col relative">
      {/* Mobile Menu Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-30">
        <motion.button
          onClick={toggleMobileMenu}
          className="bg-primary-navy/80 p-2 rounded-full text-accent-gold"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          <FaBars size={20} />
        </motion.button>
      </div>

      {/* Sidebar (Extended to Bottom with Island Design) */}
      <motion.div
        ref={sidebarRef}
        className={`fixed top-4 left-4 bg-gradient-to-b from-primary-navy/90 to-primary-navy/60 backdrop-blur-sm transition-all duration-300 ${
          isExpanded ? 'w-72' : 'w-16'
        } rounded-2xl shadow-xl border border-accent-gold/20 z-20 h-[calc(100vh-2rem)] flex flex-col justify-between overflow-hidden ${
          isMobileMenuOpen ? 'flex' : 'hidden md:flex'
        }`}
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <motion.div
            className="flex items-center p-4 cursor-pointer"
            onClick={toggleSidebar}
            onKeyDown={(e) => handleKeyDown(e, toggleSidebar)}
            tabIndex={0}
            role="button"
            aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            variants={headingFade}
            initial="hidden"
            animate="visible"
          >
            <div className="text-2xl font-bold text-accent-gold">{isExpanded ? 'Eventify' : 'E'}</div>
            {isExpanded && (
              <motion.div className="ml-auto text-neutral-lightGray" variants={itemVariants}>
                {isExpanded ? <FaChevronLeft size={16} /> : <FaChevronRight size={16} />}
              </motion.div>
            )}
          </motion.div>

          <motion.div className="flex-1 overflow-y-auto px-2" variants={itemVariants} initial="hidden" animate="visible">
            {/* Home Icon */}
            <Link
              to="/"
              className="flex items-center p-2 hover:bg-secondary-deepRed/50 transition-colors rounded-lg mx-1 my-1"
              onClick={() => setIsExpanded(false)}
            >
              <FaHome size={16} className="text-accent-gold" />
              {isExpanded && <span className="ml-4 text-neutral-lightGray">Home</span>}
            </Link>

            {/* Search Icon */}
            <motion.div
              className="flex items-center p-2 hover:bg-secondary-deepRed/50 cursor-pointer transition-colors rounded-lg mx-1 my-1"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              onKeyDown={(e) => handleKeyDown(e, () => setIsSearchOpen(!isSearchOpen))}
              tabIndex={0}
              role="button"
              aria-label={isSearchOpen ? 'Close search' : 'Open search'}
              variants={itemVariants}
            >
              <FaSearch size={16} className="text-accent-gold" />
              {isExpanded && <span className="ml-4 text-neutral-lightGray">Search</span>}
            </motion.div>
            {isSearchOpen && isExpanded && (
              <motion.form
                onSubmit={handleSearch}
                className="p-2 mx-2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users & events..."
                  className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold shadow-md"
                  autoFocus
                />
              </motion.form>
            )}

            {/* Manage Events Icon */}
            <Link
              to="/events"
              className="flex items-center p-2 hover:bg-secondary-deepRed/50 transition-colors rounded-lg mx-1 my-1"
              onClick={() => setIsExpanded(false)}
            >
              <FaCalendarAlt size={16} className="text-accent-gold" />
              {isExpanded && <span className="ml-4 text-neutral-lightGray">Manage Events</span>}
            </Link>

            {/* Updates & FAQs Icon */}
            <Link
              to="/about"
              className="flex items-center p-2 hover:bg-secondary-deepRed/50 transition-colors rounded-lg mx-1 my-1"
              onClick={() => setIsExpanded(false)}
            >
              <FaInfoCircle size={16} className="text-accent-gold" />
              {isExpanded && <span className="ml-4 text-neutral-lightGray">Updates & FAQs</span>}
            </Link>

            {/* Business List (Middle) */}
            {isExpanded && (
              <motion.div className="p-2 mx-2 mt-4" variants={itemVariants} initial="hidden" animate="visible">
                <div className="text-neutral-lightGray font-semibold mb-2">Businesses</div>
                <div className="max-h-48 overflow-y-auto">
                  {businesses.map((business) => (
                    <motion.div
                      key={business.id}
                      initial="hidden"
                      animate="visible"
                      variants={itemVariants}
                    >
                      <Link
                        to={`/business-profile/${business.id}`}
                        className="flex items-center p-2 hover:bg-secondary-deepRed/50 rounded transition-colors"
                        onClick={() => setIsExpanded(false)}
                      >
                        <div className="w-8 h-8 rounded-full mr-2 overflow-hidden">
                          <img
                            src={business.photoURL || 'https://placehold.co/32x32?text=B'}
                            alt={business.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="text-neutral-lightGray">{business.name}</div>
                          <div className="text-sm text-neutral-darkGray">{business.description}</div>
                        </div>
                        <span className="ml-auto text-green-500 text-xs">Online</span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Profile and Logout Section (Bottom) */}
        <div className="p-2 mx-2 mb-4">
          {/* Profile Icon (Links to Profile Page) */}
          <Link
            to="/profile"
            className="flex items-center p-2 hover:bg-secondary-deepRed/50 transition-colors rounded-lg mx-1 my-1"
            onClick={() => setIsExpanded(false)}
          >
            <FaUser size={16} className="text-accent-gold" />
            {isExpanded && <span className="ml-4 text-neutral-lightGray">{userProfile?.name || 'User'}</span>}
          </Link>

          {/* Logout Button */}
          <motion.div
            className="flex items-center p-2 hover:bg-secondary-deepRed/50 transition-colors rounded-lg mx-1 my-1 cursor-pointer"
            onClick={handleLogout}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            <FaSignOutAlt size={16} className="text-accent-gold" />
            {isExpanded && (
              <span className="ml-4 text-neutral-lightGray">
                {loadingLogout ? 'Logging out...' : 'Log out'}
              </span>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* Main Content with Adjusted Padding for Gap */}
      <div
        className={`flex-1 overflow-y-auto p-6 pt-4 transition-all duration-300 ${
          isExpanded ? 'md:pl-6' : 'md:pl-[79px]'
        }`}
      >
        {children}
        <Outlet />
      </div>
    </div>
  );
}

export default Sidebar;