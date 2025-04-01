// src/pages/ServiceProviderProfile.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBusinesses, getNotificationsForServiceProvider, markNotificationAsRead, BusinessData, Notification, updateBusiness } from '../services/businessService';
import { motion } from 'framer-motion';
import { FaBell, FaBuilding, FaEdit, FaTrash, FaPlus, FaCheckCircle, FaSearch, FaUser, FaHome, FaSignOutAlt, FaArrowLeft, FaArrowUp } from 'react-icons/fa';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { toast } from 'react-toastify';
import BusinessFormModal from './BusinessFormModal';
import BusinessDetailsModal from './BusinessDetailsModal';
import { Tooltip } from 'react-tooltip';

interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  role: string;
  photoURL?: string;
}

interface NotificationWithLoading extends Notification {
  loading?: boolean;
}

interface Product {
  name: string;
  description: string;
  imageUrl?: string;
  inStock: boolean;
  category?: string;
}

// Product Form Modal Component
interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => Promise<void>;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({ isOpen, onClose, onSave }) => {
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [inStock, setInStock] = useState(true);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newProduct: Product = {
        name: productName || '',
        description: description || '',
        imageUrl: imageUrl || 'https://via.placeholder.com/300',
        inStock: inStock ?? true,
        category: category || 'General',
      };
      await onSave(newProduct);
      toast.success('Product added successfully!');
      onClose();
    } catch (err: any) {
      toast.error('Failed to add product: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 pt-20">
      <motion.div
        className="bg-gray-800/90 backdrop-blur-md rounded-2xl max-w-md w-full p-6 sm:p-8 relative border border-gray-700/30 shadow-2xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Close modal"
        >
          <FaTrash size={20} />
        </button>
        <h3 className="text-xl sm:text-2xl font-bold text-yellow-400 mb-6">Add New Product</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="productName" className="block text-sm font-medium text-gray-300">
              Product Name
            </label>
            <input
              id="productName"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
              rows={3}
              required
            />
          </div>
          <div>
            <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-300">
              Image URL (optional)
            </label>
            <input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-300">
              Category (optional)
            </label>
            <input
              id="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
            />
          </div>
          <div className="flex items-center">
            <input
              id="inStock"
              type="checkbox"
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
              className="h-4 w-4 text-yellow-400 focus:ring-yellow-400 border-gray-600 rounded"
            />
            <label htmlFor="inStock" className="ml-2 text-sm text-gray-300">
              In Stock
            </label>
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all font-semibold shadow-sm hover:shadow-md disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
            ) : (
              <>
                <FaPlus className="inline mr-2" /> Add Product
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

function ServiceProviderProfile() {
  const { providerId } = useParams<{ providerId: string }>();
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const [providerProfile, setProviderProfile] = useState<UserProfile | null>(null);
  const [businesses, setBusinesses] = useState<BusinessData[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<BusinessData[]>([]);
  const [notifications, setNotifications] = useState<NotificationWithLoading[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<NotificationWithLoading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<BusinessData | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessData | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedBusinessForProduct, setSelectedBusinessForProduct] = useState<string | null>(null);
  const [businessSearch, setBusinessSearch] = useState('');
  const [notificationSearch, setNotificationSearch] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const fetchProviderData = async () => {
      if (!providerId) {
        setError('No provider ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const userDoc = await getDoc(doc(db, 'users', providerId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setProviderProfile({
            id: providerId,
            displayName: userData.displayName || `Service Provider ${providerId}`,
            email: userData.email || `${providerId}@example.com`,
            role: userData.role || 'serviceProvider',
            photoURL: userData.photoURL || '',
          });
        } else {
          setError('Service provider not found.');
          setLoading(false);
          return;
        }

        const providerBusinesses = await getBusinesses(providerId, 'serviceProvider');
        setBusinesses(providerBusinesses);
        setFilteredBusinesses(providerBusinesses);

        const businessIds = providerBusinesses.map((business) => business.id);
        if (businessIds.length > 0) {
          const providerNotifications = await getNotificationsForServiceProvider(businessIds);
          setNotifications(providerNotifications.map((n) => ({ ...n, loading: false })));
          setFilteredNotifications(providerNotifications.map((n) => ({ ...n, loading: false })));
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching provider data:', err);
        setError('Failed to load provider data. Please try again.');
        toast.error('Failed to load provider data: ' + err.message);
        setLoading(false);
      }
    };

    fetchProviderData();
  }, [providerId]);

  // Handle search for businesses
  useEffect(() => {
    const filtered = businesses.filter((business) =>
      business.name.toLowerCase().includes(businessSearch.toLowerCase())
    );
    setFilteredBusinesses(filtered);
  }, [businessSearch, businesses]);

  // Handle search for notifications
  useEffect(() => {
    const filtered = notifications.filter((notification) =>
      notification.eventTitle.toLowerCase().includes(notificationSearch.toLowerCase()) ||
      notification.productName.toLowerCase().includes(notificationSearch.toLowerCase())
    );
    setFilteredNotifications(filtered);
  }, [notificationSearch, notifications]);

  // Handle scroll for "Back to Top" button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSaveBusiness = async (businessData: BusinessData) => {
    try {
      setBusinesses(businesses.map((b) => (b.id === businessData.id ? { ...b, ...businessData } : b)));
      setFilteredBusinesses(filteredBusinesses.map((b) => (b.id === businessData.id ? { ...b, ...businessData } : b)));
      toast.success('Business updated successfully.');
      setShowModal(false);
      setEditingBusiness(null);
    } catch (err: any) {
      toast.error(`Failed to save business: ${err.message}`);
    }
  };

  const handleDeleteBusiness = async (businessId: string) => {
    if (window.confirm('Are you sure you want to delete this business?')) {
      try {
        await (await import('../services/businessService')).deleteBusiness(businessId);
        setBusinesses(businesses.filter((b) => b.id !== businessId));
        setFilteredBusinesses(filteredBusinesses.filter((b) => b.id !== businessId));
        toast.success('Business deleted successfully.');
      } catch (err: any) {
        toast.error(`Failed to delete business: ${err.message}`);
      }
    }
  };

  const handleAddProduct = async (businessId: string, product: Product) => {
    try {
      const business = businesses.find((b) => b.id === businessId);
      if (!business) throw new Error('Business not found.');

      // Create the updated products array
      const updatedProducts = [...(business.products || []), product];

      // Update the business in Firestore (sanitization is handled in businessService.ts)
      await updateBusiness(businessId, { products: updatedProducts });

      // Update local state
      setBusinesses(businesses.map((b) => (b.id === businessId ? { ...b, products: updatedProducts } : b)));
      setFilteredBusinesses(filteredBusinesses.map((b) => (b.id === businessId ? { ...b, products: updatedProducts } : b)));
    } catch (err: any) {
      throw new Error(`Failed to add product: ${err.message}`);
    }
  };

  const handleMarkNotificationAsRead = async (notificationId: string) => {
    setNotifications(notifications.map((n) => (n.id === notificationId ? { ...n, loading: true } : n)));
    setFilteredNotifications(filteredNotifications.map((n) => (n.id === notificationId ? { ...n, loading: true } : n)));
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(notifications.map((n) => (n.id === notificationId ? { ...n, read: true, loading: false } : n)));
      setFilteredNotifications(filteredNotifications.map((n) => (n.id === notificationId ? { ...n, read: true, loading: false } : n)));
      toast.success('Notification marked as read.');
    } catch (err: any) {
      setNotifications(notifications.map((n) => (n.id === notificationId ? { ...n, loading: false } : n)));
      setFilteredNotifications(filteredNotifications.map((n) => (n.id === notificationId ? { ...n, loading: false } : n)));
      toast.error(`Failed to mark notification as read: ${err.message}`);
    }
  };

  const handleViewFullProfile = () => {
    if (selectedBusiness) {
      navigate(`/business-profiles/${selectedBusiness.id}`);
    }
  };

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

  const stagger = { visible: { transition: { staggerChildren: 0.1 } } };
  const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-yellow-400 text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="bg-red-500 text-white p-4 rounded-lg flex items-center gap-3">
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white text-red-500 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Retry loading provider profile"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!providerProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Service provider not found.</div>
      </div>
    );
  }

  const isOwner = currentUser?.uid === providerId && userRole === 'serviceProvider';

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
          {/* Banner */}
          <div className="relative h-40">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-yellow-300 opacity-70"></div>
          </div>

          {/* Profile Header */}
          <div className="p-6 sm:p-8 -mt-20">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
              <div className="flex-shrink-0">
                {providerProfile.photoURL ? (
                  <img
                    src={providerProfile.photoURL}
                    alt="Provider Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-yellow-400 shadow-lg transform transition-transform hover:scale-105"
                  />
                ) : (
                  <FaUser className="w-32 h-32 text-gray-400 rounded-full border-4 border-yellow-400 bg-gray-700 p-4" />
                )}
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl font-bold text-yellow-400">{providerProfile.displayName}</h1>
                <p className="text-gray-400 text-lg">{providerProfile.email}</p>
                <p className="text-gray-300 text-sm capitalize">{providerProfile.role}</p>
              </div>
            </div>

            {/* Action Buttons (for the owner) */}
            {isOwner && (
              <div className="mb-8 flex justify-end space-x-3">
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 rounded-lg font-semibold hover:from-yellow-300 hover:to-yellow-400 transition-all flex items-center shadow-sm hover:shadow-md"
                  data-tooltip-id="create-business-tooltip"
                  data-tooltip-content="Create a new business"
                >
                  <FaPlus className="mr-2" /> Create New Business
                </button>
              </div>
            )}

            {/* Notifications Section */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-yellow-400 flex items-center">
                  <FaBell className="mr-2" /> Notifications
                </h2>
                <div className="relative w-64">
                  <input
                    type="text"
                    value={notificationSearch}
                    onChange={(e) => setNotificationSearch(e.target.value)}
                    placeholder="Search notifications..."
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg py-2 pl-10 pr-4 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  />
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
              </div>
              {filteredNotifications.length > 0 ? (
                <div className="space-y-4">
                  {filteredNotifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      className={`p-4 rounded-lg flex justify-between items-center ${notification.read ? 'bg-gray-700/50' : 'bg-gray-600/80'}`}
                      variants={fadeIn}
                    >
                      <div>
                        <p className="text-gray-200">
                          Product <strong>{notification.productName}</strong> was added to event{' '}
                          <strong>{notification.eventTitle}</strong>.
                        </p>
                        <p className="text-gray-400 text-sm">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <button
                          onClick={() => handleMarkNotificationAsRead(notification.id)}
                          className="text-yellow-400 hover:text-yellow-300 transition-colors"
                          disabled={notification.loading}
                          aria-label={`Mark notification for ${notification.eventTitle} as read`}
                          data-tooltip-id={`mark-read-${notification.id}`}
                          data-tooltip-content="Mark as read"
                        >
                          {notification.loading ? (
                            <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <FaCheckCircle size={20} />
                          )}
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center">No notifications available.</p>
              )}
            </div>

            {/* Businesses Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-yellow-400 flex items-center">
                  <FaBuilding className="mr-2" /> Businesses
                </h2>
                <div className="relative w-64">
                  <input
                    type="text"
                    value={businessSearch}
                    onChange={(e) => setBusinessSearch(e.target.value)}
                    placeholder="Search businesses..."
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg py-2 pl-10 pr-4 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  />
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
              </div>
              {filteredBusinesses.length > 0 ? (
                <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" variants={stagger}>
                  {filteredBusinesses.map((business) => (
                    <motion.div
                      key={business.id}
                      className="relative bg-gray-700/50 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-600/30 h-64"
                      variants={fadeIn}
                    >
                      <img
                        src={business.imageUrl || 'https://via.placeholder.com/300'}
                        alt={business.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent"></div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-xl sm:text-2xl font-semibold text-white">{business.name}</h3>
                        <p className="text-gray-400 text-sm">{business.category}</p>
                        <p className="text-gray-300 text-sm line-clamp-2">{business.description}</p>
                      </div>
                      <div className="absolute top-3 right-3 flex space-x-2">
                        <button
                          onClick={() => setSelectedBusiness(business)}
                          className="text-gray-200 hover:text-yellow-400 transition-colors"
                          aria-label={`View details of ${business.name}`}
                          data-tooltip-id={`view-details-${business.id}`}
                          data-tooltip-content="View business details"
                        >
                          <FaBuilding size={20} />
                        </button>
                        {isOwner && (
                          <>
                            <button
                              onClick={() => {
                                setEditingBusiness(business);
                                setShowModal(true);
                              }}
                              className="text-gray-200 hover:text-yellow-400 transition-colors"
                              aria-label={`Edit ${business.name}`}
                              data-tooltip-id={`edit-business-${business.id}`}
                              data-tooltip-content="Edit this business"
                            >
                              <FaEdit size={20} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBusinessForProduct(business.id);
                                setShowProductModal(true);
                              }}
                              className="text-gray-200 hover:text-yellow-400 transition-colors"
                              aria-label={`Add product to ${business.name}`}
                              data-tooltip-id={`add-product-${business.id}`}
                              data-tooltip-content="Add a product"
                            >
                              <FaPlus size={20} />
                            </button>
                            <button
                              onClick={() => handleDeleteBusiness(business.id)}
                              className="text-gray-200 hover:text-red-400 transition-colors"
                              aria-label={`Delete ${business.name}`}
                              data-tooltip-id={`delete-business-${business.id}`}
                              data-tooltip-content="Delete this business"
                            >
                              <FaTrash size={20} />
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <p className="text-gray-400 text-center">
                  {isOwner ? (
                    <>
                      You haven’t created any businesses yet.{' '}
                      <button
                        onClick={() => setShowModal(true)}
                        className="text-yellow-400 hover:underline"
                      >
                        Create your first business now!
                      </button>
                    </>
                  ) : (
                    'No businesses found for this service provider.'
                  )}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Business Form Modal */}
        {showModal && (
          <BusinessFormModal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              setEditingBusiness(null);
            }}
            onSave={handleSaveBusiness}
            editingBusiness={editingBusiness}
          />
        )}

        {/* Product Form Modal */}
        {showProductModal && selectedBusinessForProduct && (
          <ProductFormModal
            isOpen={showProductModal}
            onClose={() => {
              setShowProductModal(false);
              setSelectedBusinessForProduct(null);
            }}
            onSave={(product) => handleAddProduct(selectedBusinessForProduct, product)}
          />
        )}

        {/* Business Details Modal */}
        {selectedBusiness && (
          <BusinessDetailsModal
            isOpen={!!selectedBusiness}
            business={selectedBusiness}
            onClose={() => setSelectedBusiness(null)}
            onViewFullProfile={handleViewFullProfile}
          />
        )}

        {/* Tooltips */}
        <Tooltip id="create-business-tooltip" place="top" className="bg-gray-700 text-gray-200 rounded-lg" />
        {filteredNotifications.map((notification) => (
          <Tooltip
            key={`mark-read-${notification.id}`}
            id={`mark-read-${notification.id}`}
            place="top"
            className="bg-gray-700 text-gray-200 rounded-lg"
          />
        ))}
        {filteredBusinesses.map((business) => (
          <div key={business.id}>
            <Tooltip
              id={`view-details-${business.id}`}
              place="top"
              className="bg-gray-700 text-gray-200 rounded-lg"
            />
            <Tooltip
              id={`edit-business-${business.id}`}
              place="top"
              className="bg-gray-700 text-gray-200 rounded-lg"
            />
            <Tooltip
              id={`add-product-${business.id}`}
              place="top"
              className="bg-gray-700 text-gray-200 rounded-lg"
            />
            <Tooltip
              id={`delete-business-${business.id}`}
              place="top"
              className="bg-gray-700 text-gray-200 rounded-lg"
            />
          </div>
        ))}
      </div>

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
  );
}

export default ServiceProviderProfile;