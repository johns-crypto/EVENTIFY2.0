// src/components/Sidebar.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
  FaSearch,
  FaCalendarAlt,
  FaInfoCircle,
  FaSignOutAlt,
  FaChevronLeft,
  FaChevronRight,
  FaUser,
  FaHome,
  FaBell,
  FaRss,
  FaBars,
  FaBuilding,
  FaCog,
  FaImage,
} from 'react-icons/fa';
import { MdBusiness } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
import { onSnapshot, query, where, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Tooltip } from 'react-tooltip';

// Constants for routes
const ROUTES = {
  HOME: '/',
  FEED: '/feed',
  EVENTS: '/events',
  BUSINESSES: '/businesses',
  BUSINESS_PROFILES: '/business-profiles',
  NOTIFICATIONS: '/notifications',
  ABOUT: '/about',
  PROFILE: '/profile',
  SEARCH: '/search',
  SETTINGS: '/settings',
  MEDIA_EDITOR: '/media-editor',
};

// Interface for props
interface SidebarProps {
  children: React.ReactNode;
}

// NavLink Component
const NavLink = ({
  to,
  icon: Icon,
  label,
  isActive,
  onClick,
  notificationCount = 0,
  isExpanded,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  notificationCount?: number;
  isExpanded: boolean;
}) => (
  <div className="relative">
    <Link
      to={to}
      className={`flex items-center p-2 transition-colors rounded-lg mx-1 my-1 focus:outline-none focus:ring-2 focus:ring-accent-gold ${
        isActive ? 'bg-secondary-deepRed/70' : 'hover:bg-secondary-deepRed/50'
      }`}
      onClick={onClick}
      aria-label={`Go to ${label} page${notificationCount > 0 ? `, ${notificationCount} new notifications` : ''}`}
      data-tooltip-id={`nav-tooltip-${label}`}
      data-tooltip-content={label}
    >
      <Icon size={16} className={`text-accent-gold ${isExpanded ? '' : 'mx-auto'}`} />
      {isExpanded && <span className="ml-4 text-neutral-lightGray">{label}</span>}
      {notificationCount > 0 && (
        <motion.span
          className="absolute top-1 right-1 bg-secondary-deepRed text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          {notificationCount}
        </motion.span>
      )}
    </Link>
    {!isExpanded && <Tooltip id={`nav-tooltip-${label}`} place="right" />}
  </div>
);

// MobileNavLink Component
const MobileNavLink = ({
  to,
  icon: Icon,
  label,
  isActive,
  notificationCount = 0,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  notificationCount?: number;
}) => (
  <motion.div whileTap={{ scale: 0.9 }}>
    <Link
      to={to}
      className={`relative flex items-center justify-center p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-accent-gold ${
        isActive ? 'text-accent-gold bg-neutral-mediumGray/70' : 'text-neutral-lightGray hover:text-accent-gold'
      }`}
      aria-label={`${label}${notificationCount > 0 ? `, ${notificationCount} new notifications` : ''}`}
    >
      <Icon size={24} />
      <span className="sr-only">{label}</span>
      {notificationCount > 0 && (
        <motion.span
          className="absolute top-1 right-1 bg-secondary-deepRed text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          {notificationCount}
        </motion.span>
      )}
    </Link>
  </motion.div>
);

// Hamburger Menu Modal Component
const HamburgerMenuModal = ({
  onClose,
  handleLogout,
  loadingLogout,
  navigate,
}: {
  onClose: () => void;
  handleLogout: () => void;
  loadingLogout: boolean;
  navigate: (path: string) => void;
}) => (
  <motion.div
    className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
  >
    <motion.div
      className="bg-neutral-mediumGray/50 backdrop-blur-lg rounded-lg p-6 w-11/12 max-w-sm border border-neutral-mediumGray/50 shadow-md"
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0.9 }}
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold text-accent-gold mb-4">More Options</h3>
      <div className="space-y-3">
        <button
          onClick={() => {
            navigate(ROUTES.ABOUT);
            onClose();
          }}
          className="w-full flex items-center p-2 text-neutral-lightGray hover:bg-secondary-deepRed/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
          aria-label="Go to Updates & FAQs page"
        >
          <FaInfoCircle size={16} className="text-accent-gold mr-3" />
          Updates & FAQs
        </button>
        <button
          onClick={() => {
            navigate(ROUTES.SETTINGS);
            onClose();
          }}
          className="w-full flex items-center p-2 text-neutral-lightGray hover:bg-secondary-deepRed/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
          aria-label="Go to Settings page"
        >
          <FaCog size={16} className="text-accent-gold mr-3" />
          Settings
        </button>
        <button
          onClick={() => {
            navigate(ROUTES.MEDIA_EDITOR);
            onClose();
          }}
          className="w-full flex items-center p-2 text-neutral/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
          aria-label="Go to Media Editor page"
        >
          <FaImage size={16} className="text-accent-gold mr-3" />
          Media Editor
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center p-2 text-neutral-lightGray hover:bg-secondary-deepRed/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
          disabled={loadingLogout}
          aria-label="Log out"
        >
          <FaSignOutAlt size={16} className="text-accent-gold mr-3" />
          {loadingLogout ? 'Logging out...' : 'Log out'}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

function Sidebar({ children }: SidebarProps) {
  const { logout, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationCount, setNotificationCount] = useState(0);
  const [loadingLogout, setLoadingLogout] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setNotificationCount(0);
      return;
    }

    const q = query(
      collection(db, 'users', currentUser.uid, 'notifications'),
      where('type', '==', 'join_request'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotificationCount(snapshot.docs.length);
      },
      (err) => {
        console.error('Notification count error:', err);
        toast.error('Failed to load notification count.');
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const handleLogout = useCallback(async () => {
    if (loadingLogout) return;
    setLoadingLogout(true);
    try {
      await logout();
      navigate(ROUTES.HOME);
    } catch (error) {
      toast.error('Failed to log out.');
    } finally {
      setLoadingLogout(false);
    }
  }, [logout, navigate, loadingLogout]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim().length < 3) {
        toast.error('Search query must be at least 3 characters.');
        return;
      }
      navigate(`${ROUTES.SEARCH}?query=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setIsSearchOpen(false);
    },
    [searchQuery, navigate]
  );

  const toggleSidebar = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  }, []);

  const headingFade = {
    hidden: { opacity: 0, y: -30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut', type: 'spring', bounce: 0.3 },
    },
  };

  const isActiveRoute = useCallback((path: string) => location.pathname === path, [location.pathname]);

  const navLinks = useMemo(
    () => [
      { to: ROUTES.HOME, icon: FaHome, label: 'Home' },
      { to: ROUTES.FEED, icon: FaRss, label: 'Feed' },
      { to: ROUTES.EVENTS, icon: FaCalendarAlt, label: 'Manage Events' },
      { to: ROUTES.BUSINESSES, icon: MdBusiness, label: 'Businesses' },
      { to: ROUTES.BUSINESS_PROFILES, icon: FaBuilding, label: 'Business Profiles' },
      {
        to: ROUTES.NOTIFICATIONS,
        icon: FaBell,
        label: 'Notifications',
        notificationCount,
      },
      { to: ROUTES.PROFILE, icon: FaUser, label: currentUser?.displayName || 'User' },
      { to: ROUTES.SETTINGS, icon: FaCog, label: 'Settings' },
      { to: ROUTES.MEDIA_EDITOR, icon: FaImage, label: 'Media Editor' },
    ],
    [notificationCount, currentUser]
  );

  const mobileNavLinks = useMemo(
    () => [
      { to: ROUTES.HOME, icon: FaHome, label: 'Home' },
      { to: ROUTES.FEED, icon: FaRss, label: 'Feed' },
      { to: ROUTES.EVENTS, icon: FaCalendarAlt, label: 'Events' },
      { to: ROUTES.BUSINESSES, icon: MdBusiness, label: 'Businesses' },
      { to: ROUTES.NOTIFICATIONS, icon: FaBell, label: 'Notifications', notificationCount },
      { to: ROUTES.PROFILE, icon: FaUser, label: 'Profile' },
    ],
    [notificationCount]
  );

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray flex flex-col relative">
      {/* Mobile Top Navigation */}
      <motion.div
        className="md:hidden fixed top-0 left-0 w-full bg-neutral-mediumGray/50 backdrop-blur-lg border-b border-neutral-mediumGray/50 z-40 shadow-md flex items-center justify-between px-4 py-3"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-xl font-bold text-accent-gold">Eventify</div>
        <motion.div
          whileTap={{ scale: 0.9 }}
          className="relative flex items-center justify-center p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-accent-gold text-neutral-lightGray hover:text-accent-gold"
          onClick={() => setIsHamburgerOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => handleKeyDown(e, () => setIsHamburgerOpen(true))}
          aria-label="Open more options"
        >
          <FaBars size={24} />
        </motion.div>
      </motion.div>

      {/* Desktop Sidebar */}
      <motion.div
        className={`hidden md:flex fixed top-4 left-4 bg-neutral-mediumGray/50 backdrop-blur-lg transition-all duration-300 ${
          isExpanded ? 'w-72' : 'w-16'
        } rounded-2xl shadow-md border border-neutral-mediumGray/50 z-20 h-[calc(100vh-2rem)] flex flex-col justify-between overflow-hidden`}
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <motion.div
            className="flex items-center p-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-gold"
            onClick={toggleSidebar}
            onKeyDown={(e) => handleKeyDown(e, toggleSidebar)}
            tabIndex={0}
            role="button"
            aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            variants={headingFade}
            initial="hidden"
            animate="visible"
          >
            <div className={`text-2xl font-bold text-accent-gold ${isExpanded ? '' : 'mx-auto'}`}>
              {isExpanded ? 'Eventify' : 'E'}
            </div>
            {isExpanded && (
              <motion.div className="ml-auto text-neutral-lightGray">
                {isExpanded ? <FaChevronLeft size={16} /> : <FaChevronRight size={16} />}
              </motion.div>
            )}
          </motion.div>

          <div className="flex-1 overflow-y-auto px-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                icon={link.icon}
                label={link.label}
                isActive={isActiveRoute(link.to)}
                onClick={() => setIsExpanded(false)}
                notificationCount={link.notificationCount}
                isExpanded={isExpanded}
              />
            ))}

            <motion.div
              className={`flex items-center p-2 hover:bg-secondary-deepRed/50 cursor-pointer transition-colors rounded-lg mx-1 my-1 focus:outline-none focus:ring-2 focus:ring-accent-gold ${
                isExpanded ? '' : 'justify-center'
              }`}
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              onKeyDown={(e) => handleKeyDown(e, () => setIsSearchOpen(!isSearchOpen))}
              tabIndex={0}
              role="button"
              aria-label={isSearchOpen ? 'Close search' : 'Open search'}
              data-tooltip-id="nav-tooltip-search"
              data-tooltip-content="Search"
            >
              <FaSearch size={16} className="text-accent-gold" />
              {isExpanded && <span className="ml-4 text-neutral-lightGray">Search</span>}
            </motion.div>
            {!isExpanded && <Tooltip id="nav-tooltip-search" place="right" />}
            {isSearchOpen && (
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
                  className="w-full p-2 rounded-lg bg-neutral-mediumGray text-gray-900 border border-neutral-mediumGray focus:outline-none focus:ring-2 focus:ring-accent-gold shadow-md text-sm placeholder-gray-500"
                  autoFocus
                />
              </motion.form>
            )}
          </div>
        </div>

        <div className="p-2 mx-2 mb-4">
          <motion.div
            className={`flex items-center p-2 hover:bg-secondary-deepRed/50 transition-colors rounded-lg mx-1 my-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-gold ${
              isExpanded ? '' : 'justify-center'
            }`}
            onClick={handleLogout}
            onKeyDown={(e) => handleKeyDown(e, handleLogout)}
            tabIndex={0}
            role="button"
            aria-label="Log out"
            data-tooltip-id="nav-tooltip-logout"
            data-tooltip-content="Log out"
          >
            <FaSignOutAlt size={16} className="text-accent-gold" />
            {isExpanded && (
              <span className="ml-4 text-neutral-lightGray">
                {loadingLogout ? 'Logging out...' : 'Log out'}
              </span>
            )}
          </motion.div>
          {!isExpanded && <Tooltip id="nav-tooltip-logout" place="right" />}
        </div>
      </motion.div>

      {/* Mobile Footer Navigation */}
      <motion.div
        className="md:hidden fixed bottom-0 left-0 w-full bg-neutral-mediumGray/50 backdrop-blur-lg border-t border-neutral-mediumGray/50 z-30 shadow-md"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-around items-center py-2 px-4">
          {mobileNavLinks.map((link) => (
            <MobileNavLink
              key={link.to}
              to={link.to}
              icon={link.icon}
              label={link.label}
              isActive={isActiveRoute(link.to)}
              notificationCount={link.notificationCount}
            />
          ))}
          <motion.div
            whileTap={{ scale: 0.9 }}
            className="relative flex items-center justify-center p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-accent-gold text-neutral-lightGray hover:text-accent-gold"
            onClick={() => setIsSearchOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => handleKeyDown(e, () => setIsSearchOpen(true))}
            aria-label="Open search"
          >
            <FaSearch size={24} />
          </motion.div>
        </div>
      </motion.div>

      {/* Search Modal for Mobile */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSearchOpen(false)}
          >
            <motion.div
              className="bg-neutral-mediumGray/50 backdrop-blur-lg rounded-lg p-6 w-11/12 max-w-sm border border-neutral-mediumGray/50 shadow-md"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-accent-gold mb-4">Search</h3>
              <form onSubmit={handleSearch}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users & events..."
                  className="w-full p-2 rounded-lg bg-neutral-mediumGray text-gray-900 border border-neutral-mediumGray focus:outline-none focus:ring-2 focus:ring-accent-gold shadow-md text-sm placeholder-gray-500"
                  autoFocus
                />
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hamburger Menu Modal */}
      <AnimatePresence>
        {isHamburgerOpen && (
          <HamburgerMenuModal
            onClose={() => setIsHamburgerOpen(false)}
            handleLogout={handleLogout}
            loadingLogout={loadingLogout}
            navigate={navigate}
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div
        className={`flex-1 overflow-y-auto p-6 pt-16 md:pt-4 transition-all duration-300 ${
          isExpanded ? 'md:pl-80' : 'md:pl-20'
        } pb-20 md:pb-6`}
      >
        {children}
      </div>
    </div>
  );
}

export default Sidebar;