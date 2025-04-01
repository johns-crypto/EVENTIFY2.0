// src/pages/Businesses.tsx
import { useState, useEffect, useCallback, memo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDocs, limit } from '../services/firebase';
import { getBusinesses } from '../services/businessService';
import { motion } from 'framer-motion';
import { FaPlus, FaTrash, FaCheckCircle, FaTimesCircle, FaCalendarPlus, FaEllipsisV, FaSearch, FaFilter, FaRedo, FaHome, FaSignOutAlt, FaArrowLeft, FaArrowUp, FaBuilding } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

// Interface Definitions
interface Product {
  name: string;
  description: string;
  imageUrl?: string;
  inStock: boolean;
  businessId: string;
}

interface Business {
  id: string;
  name: string;
  products: Product[];
  ownerId: string;
  category?: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
  ownerId: string;
  products?: { name: string; businessId: string }[];
}

interface Notification {
  id?: string;
  businessId: string;
  productName: string;
  eventId: string;
  eventTitle: string;
  timestamp: string;
  read: boolean;
}

// LazyImage Component for optimized image loading
const LazyImage = memo(({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} opacity-0 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : ''}`}
      onLoad={() => setIsLoaded(true)}
      loading="lazy"
    />
  );
});

// Memoized Product Card Component to display individual products
const ProductCard = memo(
  ({
    product,
    index,
    businesses,
    setSelectedProduct,
    setShowAddToEventModal,
    showMenu,
    setShowMenu,
    navigate,
  }: {
    product: Product;
    index: number;
    businesses: Business[];
    setSelectedProduct: (product: Product | null) => void;
    setShowAddToEventModal: (show: boolean) => void;
    showMenu: number | null;
    setShowMenu: (index: number | null) => void;
    navigate: (path: string) => void;
  }) => {
    const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
    const business = businesses.find((b) => b.id === product.businessId);

    return (
      <motion.div
        className="relative bg-gray-700/50 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-600/30 h-64"
        variants={fadeIn}
      >
        {/* Product Image */}
        <LazyImage
          src={product.imageUrl || 'https://via.placeholder.com/300'}
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent"></div>

        {/* Three-Dot Menu */}
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setShowMenu(index === showMenu ? null : index)}
            className="text-gray-200 hover:text-yellow-400 transition-colors"
            aria-label="More options"
          >
            <FaEllipsisV size={20} />
          </button>
          {showMenu === index && (
            <motion.div
              className="absolute right-0 mt-2 w-48 bg-gray-800/90 backdrop-blur-md rounded-lg shadow-lg border border-gray-700/30 z-10"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="p-2">
                <p className="text-gray-300 text-sm px-2 py-1">
                  <strong>Business:</strong> {business?.name || 'Unknown Business'}
                </p>
                <button
                  onClick={() => {
                    if (business?.id) {
                      navigate(`/business-profiles/${business.id}`);
                    } else {
                      toast.error('Business ID not found.');
                    }
                  }}
                  className="w-full text-left px-2 py-1 text-gray-300 hover:bg-gray-700/50 rounded transition-colors text-sm"
                >
                  View Business
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Product Info Overlay */}
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-xl sm:text-2xl font-semibold text-white">{product.name}</h3>
          <p className="text-gray-400 text-sm">by {business?.name || 'Unknown Business'}</p>
          <p className="text-gray-300 text-sm line-clamp-2">{product.description}</p>
          <p className="text-gray-400 text-sm mt-1">
            {product.inStock ? (
              <span className="text-green-400 flex items-center">
                <FaCheckCircle className="mr-1" /> In Stock
              </span>
            ) : (
              <span className="text-red-400 flex items-center">
                <FaTimesCircle className="mr-1" /> Out of Stock
              </span>
            )}
          </p>
        </div>

        {/* Add to Event Button */}
        <div className="absolute bottom-4 right-4">
          <button
            onClick={() => {
              setSelectedProduct(product);
              setShowAddToEventModal(true);
            }}
            className="px-3 py-1 bg-gradient-to-r from-gray-600 to-gray-700 text-yellow-400 rounded-full hover:from-gray-500 hover:to-gray-600 transition-all shadow-sm hover:shadow-md flex items-center text-sm disabled:opacity-50"
            disabled={!product.inStock}
          >
            <FaCalendarPlus className="mr-1" size={14} /> Add to Event
          </button>
        </div>
      </motion.div>
    );
  }
);

function Businesses() {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState<boolean>(true);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddToEventModal, setShowAddToEventModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showMenu, setShowMenu] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const productsPerPage = 6;

  // Parse query parameters from the URL
  const queryParams = new URLSearchParams(location.search);
  const eventIdFromQuery = queryParams.get('eventId');
  const categoryFromQuery = queryParams.get('category') || 'All';

  // Normalize category from query to match our fixed categories
  const normalizeCategory = (category: string): string => {
    if (category === 'Catering/Food') return 'Food/Catering';
    if (category === 'Refreshments') return 'Refreshments';
    if (category === 'Venue Provider') return 'Venue Provider';
    return 'All'; // Default to 'All' if the category doesn't match
  };

  // Fixed category options for the filter dropdown
  const categoryOptions = ['All', 'Food/Catering', 'Refreshments', 'Venue Provider'];

  // Handle scroll for "Back to Top" button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch all businesses and user events in parallel
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const fetchInitialData = async () => {
      try {
        // Fetch all businesses using the getBusinesses function from businessService.ts
        const businessesData = await getBusinesses(currentUser.uid, userRole);
        const mappedBusinesses = businessesData.map((business) => ({
          id: business.id,
          name: business.name || 'Unnamed Business',
          products: business.products || [],
          ownerId: business.ownerId,
          category: normalizeCategory(business.category || 'Venue Provider'), // Normalize category
        })) as Business[];

        // Flatten products from all businesses and add businessId to each product
        const productsWithBusinessId = mappedBusinesses.flatMap((business) =>
          (business.products || []).map((product: Product) => ({
            ...product,
            businessId: business.id,
          }))
        );
        setBusinesses(mappedBusinesses);
        setAllProducts(productsWithBusinessId);
        setFilteredProducts(productsWithBusinessId);
        setLoadingBusinesses(false);

        // Fetch user's events with a limit of 10
        const eventsQuery = query(
          collection(db, 'events'),
          where('ownerId', '==', currentUser.uid),
          limit(10)
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        const eventsData = eventsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Event[];
        setEvents(eventsData);

        // If an eventId is provided in the query, preselect that event
        if (eventIdFromQuery) {
          const event = eventsData.find((ev) => ev.id === eventIdFromQuery);
          if (event) {
            setSelectedEvent(event);
          }
        }
        setLoadingEvents(false);

        // Set up real-time listener for businesses
        const businessesQuery = query(collection(db, 'businesses'));
        const unsubscribeBusinesses = onSnapshot(businessesQuery, (snapshot) => {
          const updatedBusinesses = snapshot.docs.map((doc) => ({
            id: doc.id,
            name: (doc.data().name as string) || 'Unnamed Business',
            products: doc.data().products || [],
            ownerId: doc.data().ownerId || 'unknown',
            category: normalizeCategory(doc.data().category || 'Venue Provider'),
          })) as Business[];
          const updatedProducts = updatedBusinesses.flatMap((business) =>
            (business.products || []).map((product: Product) => ({
              ...product,
              businessId: business.id,
            }))
          );
          setBusinesses(updatedBusinesses);
          setAllProducts(updatedProducts);
          // Reapply filters after update
          handleFilterChange(searchQuery, categoryFilter, updatedProducts, updatedBusinesses);
        }, (err) => {
          console.error('Error listening to businesses updates:', err);
          toast.error('Failed to listen to businesses updates: ' + err.message);
        });

        // Set up real-time listener for events
        const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
          const updatedEvents = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Event[];
          setEvents(updatedEvents);
          // Update selected event if it still exists
          if (eventIdFromQuery) {
            const event = updatedEvents.find((ev) => ev.id === eventIdFromQuery);
            setSelectedEvent(event || null);
          }
        }, (err) => {
          console.error('Error listening to events updates:', err);
          toast.error('Failed to listen to events updates: ' + err.message);
        });

        // Cleanup listeners on unmount
        return () => {
          unsubscribeBusinesses();
          unsubscribeEvents();
        };
      } catch (err: any) {
        console.error('Error fetching initial data:', err);
        setError('Failed to load data. Please try again.');
        toast.error('Failed to load data: ' + err.message);
        setLoadingBusinesses(false);
        setLoadingEvents(false);
      }
    };

    fetchInitialData();
  }, [currentUser, navigate, userRole, eventIdFromQuery]);

  // Apply category filter from query parameters on initial load
  useEffect(() => {
    const normalizedCategory = normalizeCategory(categoryFromQuery);
    if (normalizedCategory !== 'All') {
      setCategoryFilter(normalizedCategory);
      handleFilterChange(searchQuery, normalizedCategory);
    }
  }, [categoryFromQuery, allProducts, businesses]);

  // Handle filtering of products
  const handleFilterChange = (
    search: string,
    category: string,
    products: Product[] = allProducts,
    businessList: Business[] = businesses
  ) => {
    let filtered = products;
    if (search) {
      filtered = filtered.filter((product) => {
        const business = businessList.find((b: Business) => b.id === product.businessId);
        const businessName = business?.name || 'Unknown Business';
        return (
          businessName.toLowerCase().includes(search.toLowerCase()) ||
          product.name.toLowerCase().includes(search.toLowerCase())
        );
      });
    }
    if (category !== 'All') {
      filtered = filtered.filter((product) => {
        const business = businessList.find((b: Business) => b.id === product.businessId);
        const normalizedBusinessCategory = normalizeCategory(business?.category || 'Venue Provider');
        return normalizedBusinessCategory === category;
      });
    }
    setFilteredProducts(filtered);
    setCurrentPage(1);
  };

  // Handle adding a product to an event
  const handleAddToEvent = useCallback(async () => {
    if (!selectedProduct || !selectedEvent) return;

    try {
      // Update event with the new product and service
      const eventRef = doc(db, 'events', selectedEvent.id);
      const updatedProducts = [
        ...(selectedEvent.products || []),
        { name: selectedProduct.name, businessId: selectedProduct.businessId },
      ];
      const business = businesses.find((b) => b.id === selectedProduct.businessId);
      await updateDoc(eventRef, {
        products: updatedProducts,
        service: {
          type: normalizeCategory(business?.category || 'Venue Provider').toLowerCase(),
          businessId: selectedProduct.businessId,
          businessName: business?.name || 'Unknown Business',
        },
      });

      // Send notification to the business
      const notification: Notification = {
        businessId: selectedProduct.businessId,
        productName: selectedProduct.name,
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        timestamp: new Date().toISOString(),
        read: false,
      };
      await addDoc(collection(db, 'notifications'), notification);

      toast.success(`${selectedProduct.name} added to ${selectedEvent.title}!`);
      setShowConfirmModal(false);
      setShowAddToEventModal(false);
      setSelectedProduct(null);
      setSelectedEvent(null);
      // Navigate back to the event details page
      navigate(`/events/${selectedEvent.id}`);
    } catch (err: any) {
      console.error('Error adding product to event:', err);
      toast.error('Failed to add product to event: ' + err.message);
    }
  }, [selectedProduct, selectedEvent, businesses, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err: any) {
      toast.error('Failed to logout: ' + err.message);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pagination logic
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const stagger = { visible: { transition: { staggerChildren: 0.1 } } };
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="bg-red-500 text-white p-4 rounded-lg flex items-center gap-3">
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white text-red-500 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Retry loading businesses"
          >
            <FaRedo size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-gray-900/90 backdrop-blur-md shadow-md z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-300 hover:text-yellow-400 transition-colors flex items-center"
              aria-label="Go back"
            >
              <FaArrowLeft className="mr-2" /> Back
            </button>
            <button
              onClick={() => navigate('/')}
              className="text-gray-300 hover:text-yellow-400 transition-colors flex items-center"
              aria-label="Go to home"
            >
              <FaHome className="mr-2" /> Home
            </button>
            <button
              onClick={() => navigate('/business-profiles')}
              className="text-gray-300 hover:text-yellow-400 transition-colors flex items-center"
              aria-label="Go to business profiles"
            >
              <FaBuilding className="mr-2" /> Business Profiles
            </button>
          </div>
          {currentUser && (
            <button
              onClick={handleLogout}
              className="text-gray-300 hover:text-red-400 transition-colors flex items-center"
              aria-label="Logout"
            >
              <FaSignOutAlt className="mr-2" /> Logout
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-20 pb-8 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-5xl mx-auto bg-gray-800/70 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-700/30"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <div className="p-6 sm:p-8">
            {loadingBusinesses ? (
              <div className="h-8 bg-gray-700 rounded w-3/5 mx-auto animate-pulse mb-8"></div>
            ) : (
              <h1 className="text-3xl sm:text-4xl font-bold text-yellow-400 mb-8">All Products</h1>
            )}

            {/* Filter Section */}
            <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center w-full sm:w-auto">
                <FaSearch className="text-yellow-400 mr-3" size={20} />
                <label htmlFor="searchInput" className="sr-only">
                  Search products or businesses
                </label>
                <input
                  id="searchInput"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleFilterChange(e.target.value, categoryFilter);
                  }}
                  placeholder="Search products or businesses..."
                  className="w-full sm:w-64 px-4 py-3 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300"
                />
              </div>
              <div className="flex items-center w-full sm:w-auto">
                <FaFilter className="text-yellow-400 mr-3" size={20} />
                <label htmlFor="categoryFilterSelect" className="sr-only">
                  Filter by Category
                </label>
                <select
                  id="categoryFilterSelect"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    handleFilterChange(searchQuery, e.target.value);
                  }}
                  className="w-full sm:w-48 px-4 py-3 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all duration-300"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingBusinesses ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(productsPerPage)].map((_, idx) => (
                  <div key={idx} className="h-64 bg-gray-700 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <>
                <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" variants={stagger}>
                  {currentProducts.map((product, index) => (
                    <ProductCard
                      key={index}
                      product={product}
                      index={index}
                      businesses={businesses}
                      setSelectedProduct={setSelectedProduct}
                      setShowAddToEventModal={setShowAddToEventModal}
                      showMenu={showMenu}
                      setShowMenu={setShowMenu}
                      navigate={navigate}
                    />
                  ))}
                </motion.div>
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center mt-6 space-x-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-gray-600 text-white rounded-full hover:bg-gray-500 disabled:opacity-50 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-gray-300">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-gray-600 text-white rounded-full hover:bg-gray-500 disabled:opacity-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-400 text-center text-lg">
                No products found matching your criteria.
              </p>
            )}
          </div>
        </motion.div>

        {/* Add to Event Modal */}
        {showAddToEventModal && selectedProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800/90 backdrop-blur-md rounded-2xl max-w-md w-full p-6 sm:p-8 relative border border-gray-700/30 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <button
                onClick={() => {
                  setShowAddToEventModal(false);
                  setSelectedProduct(null);
                  setSelectedEvent(null);
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Close modal"
              >
                <FaTrash size={20} />
              </button>
              <h3 className="text-xl sm:text-2xl font-bold text-yellow-400 mb-6">
                Add {selectedProduct.name} to Event
              </h3>
              {loadingEvents ? (
                <div className="text-gray-400 text-center">Loading events...</div>
              ) : events.length > 0 ? (
                <div className="space-y-4">
                  <label htmlFor="event-select" className="block text-sm font-medium text-gray-300">
                    Select an Event
                  </label>
                  <select
                    id="event-select"
                    value={selectedEvent?.id || ''}
                    onChange={(e) => {
                      const event = events.find((ev) => ev.id === e.target.value);
                      setSelectedEvent(event || null);
                    }}
                    className="w-full px-4 py-2 sm:py-3 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all duration-300 text-sm sm:text-base"
                  >
                    <option value="">Select an event</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title} ({new Date(event.date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="w-full px-4 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all font-semibold shadow-sm hover:shadow-md disabled:opacity-50"
                    disabled={!selectedEvent}
                  >
                    <FaPlus className="inline mr-2" /> Add to Event
                  </button>
                </div>
              ) : (
                <p className="text-gray-400 text-center">
                  No events found. Create an event first.
                </p>
              )}
              <button
                onClick={() => {
                  setShowAddToEventModal(false);
                  setSelectedProduct(null);
                  setSelectedEvent(null);
                }}
                className="w-full mt-4 px-4 py-2 sm:py-3 bg-gray-600/50 text-gray-200 rounded-lg hover:bg-gray-500/50 transition-all font-semibold shadow-sm hover:shadow-md"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && selectedProduct && selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800/90 backdrop-blur-md rounded-2xl max-w-md w-full p-6 sm:p-8 relative border border-gray-700/30 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <h3 className="text-xl sm:text-2xl font-bold text-yellow-400 mb-4">
                Confirm Addition
              </h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to add <strong>{selectedProduct.name}</strong> to{' '}
                <strong>{selectedEvent.title}</strong>?
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleAddToEvent}
                  className="w-full px-4 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all font-semibold shadow-sm hover:shadow-md"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full px-4 py-2 sm:py-3 bg-gray-600/50 text-gray-200 rounded-lg hover:bg-gray-500/50 transition-all font-semibold shadow-sm hover:shadow-md"
                >
                  No
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Back to Top Button */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 p-4 bg-yellow-400 text-gray-900 rounded-full shadow-lg hover:bg-yellow-300 transition-all"
            aria-label="Scroll to top"
          >
            <FaArrowUp size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

export default Businesses;