// src/pages/BusinessProfiles.tsx
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBusinesses, getBusinessById, BusinessData, updateBusiness, deleteBusiness } from '../services/businessService';
import { motion } from 'framer-motion';
import { FaSearch, FaFilter, FaPlus, FaBriefcase, FaUser, FaSignOutAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import BusinessProfileDetails from './BusinessProfileDetails';
import BusinessFormModal from './BusinessFormModal';
import BusinessDetailsModal from './BusinessDetailsModal';
import LazyImage from '../components/LazyImage.tsx';

interface Business extends BusinessData {}

function BusinessProfiles() {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const { id: businessId } = useParams<{ id: string }>();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [filter, setFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBusinessForDetails, setSelectedBusinessForDetails] = useState<Business | null>(null);
  const businessesPerPage = 6;
  const serviceOptions = ['Catering', 'Refreshments', 'Venue Provider'];

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setError('Please sign in to view business profiles.');
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch businesses (all businesses for regular users, owned businesses for service providers)
        const businessData = await getBusinesses(currentUser.uid, userRole || 'user');
        setBusinesses(businessData);
        setFilteredBusinesses(businessData);

        if (businessId) {
          const business = await getBusinessById(businessId);
          if (business) {
            setSelectedBusiness(business);
          } else {
            setError('Business not found.');
          }
        }
      } catch (err: any) {
        setError(`Failed to load data: ${err.message}`);
        toast.error(`Failed to load data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, navigate, businessId, userRole]);

  const handleFilterChange = (value: string, service: string) => {
    let filtered = businesses;
    if (value) {
      filtered = filtered.filter((business) =>
        business.name.toLowerCase().includes(value.toLowerCase())
      );
    }
    if (service !== 'All') {
      filtered = filtered.filter((business) =>
        business.services.includes(service)
      );
    }
    setFilteredBusinesses(filtered);
    setCurrentPage(1);
  };

  const handleEditBusiness = (business: Business) => {
    setEditingBusiness(business);
    setShowModal(true);
  };

  const handleDeleteBusiness = async (businessId: string) => {
    if (window.confirm('Are you sure you want to delete this business?')) {
      try {
        await deleteBusiness(businessId);
        setBusinesses(businesses.filter((business) => business.id !== businessId));
        setFilteredBusinesses(filteredBusinesses.filter((business) => business.id !== businessId));
        toast.success('Business deleted successfully.');
      } catch (err: any) {
        toast.error(`Failed to delete business: ${err.message}`);
      }
    }
  };

  const handleSaveBusiness = async (businessData: Business) => {
    try {
      if (editingBusiness) {
        await updateBusiness(editingBusiness.id, businessData);
        setBusinesses(businesses.map((b) => (b.id === editingBusiness.id ? { ...b, ...businessData } : b)));
        setFilteredBusinesses(filteredBusinesses.map((b) => (b.id === editingBusiness.id ? { ...b, ...businessData } : b)));
        toast.success('Business updated successfully.');
      }
      setShowModal(false);
      setEditingBusiness(null);
    } catch (err: any) {
      toast.error(`Failed to save business: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully.');
      navigate('/login');
    } catch (err: any) {
      toast.error('Failed to log out: ' + err.message);
    }
  };

  const paginatedBusinesses = useMemo(() => {
    const startIndex = (currentPage - 1) * businessesPerPage;
    return filteredBusinesses.slice(startIndex, startIndex + businessesPerPage);
  }, [filteredBusinesses, currentPage]);

  const totalPages = Math.ceil(filteredBusinesses.length / businessesPerPage);

  const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
  const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="w-full max-w-6xl p-4 space-y-4">
          <div className="h-8 bg-gray-700 rounded w-3/5 mx-auto animate-pulse"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-64 bg-gray-700 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
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
            aria-label="Retry loading business profiles"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (selectedBusiness) {
    return <BusinessProfileDetails business={selectedBusiness} setSelectedBusiness={setSelectedBusiness} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white py-6 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-6xl mx-auto bg-gray-800/70 backdrop-blur-lg rounded-2xl p-4 sm:p-6 lg:p-8 shadow-2xl border border-gray-700/30"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-400">Business Profiles</h2>
          {userRole === 'serviceProvider' ? (
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  setEditingBusiness(null);
                  setShowModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-500 hover:to-blue-600 transition-all shadow-sm text-sm sm:text-base flex items-center justify-center"
              >
                <FaPlus className="inline mr-2" /> Create New Business
              </button>
              <button
                onClick={handleLogout}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full hover:from-red-500 hover:to-red-600 transition-all shadow-sm text-sm sm:text-base flex items-center justify-center"
              >
                <FaSignOutAlt className="inline mr-2" /> Logout
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Link
                to="/business-login"
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-500 hover:to-blue-600 transition-all shadow-sm text-sm sm:text-base flex items-center justify-center"
              >
                <FaBriefcase className="inline mr-2" /> Business Login
              </Link>
              <Link
                to="/business-register"
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-500 hover:to-blue-600 transition-all shadow-sm text-sm sm:text-base flex items-center justify-center"
              >
                <FaBriefcase className="inline mr-2" /> Register as Service Provider
              </Link>
            </div>
          )}
        </div>

        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center w-full sm:w-auto">
            <FaSearch className="text-yellow-400 mr-3" size={20} />
            <label htmlFor="businessSearchInput" className="sr-only">
              Search businesses by name
            </label>
            <input
              id="businessSearchInput"
              type="text"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                handleFilterChange(e.target.value, serviceFilter);
              }}
              placeholder="Search businesses by name..."
              className="w-full sm:w-64 px-4 py-2 sm:py-3 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 text-sm sm:text-base"
            />
          </div>
          <div className="flex items-center w-full sm:w-auto">
            <FaFilter className="text-yellow-400 mr-3" size={20} />
            <label htmlFor="serviceFilterSelect" className="sr-only">
              Filter by Service
            </label>
            <select
              id="serviceFilterSelect"
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                handleFilterChange(filter, e.target.value);
              }}
              className="w-full sm:w-48 px-4 py-2 sm:py-3 rounded-lg bg-gray-700/50 text-gray-200 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all duration-300 text-sm sm:text-base"
            >
              <option value="All">All Services</option>
              {serviceOptions.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>
        </div>

        {paginatedBusinesses.length > 0 ? (
          <>
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
              variants={stagger}
            >
              {paginatedBusinesses.map((business) => (
                <motion.div
                  key={business.id}
                  className="relative h-56 sm:h-64 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-600/30 group"
                  variants={fadeIn}
                >
                  <LazyImage
                    src={business.imageUrl || 'https://via.placeholder.com/300'}
                    alt={business.name}
                    className="w-full h-full object-cover"
                    fallbackSrc="https://via.placeholder.com/300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent"></div>
                  <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4">
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white">{business.name}</h3>
                    <p className="text-gray-300 text-xs sm:text-sm line-clamp-2">{business.description}</p>
                  </div>
                  <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 flex justify-between items-center flex-wrap gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedBusinessForDetails(business);
                          setShowDetailsModal(true);
                        }}
                        className="px-3 sm:px-4 py-1 sm:py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-500 hover:to-blue-600 transition-all shadow-sm hover:shadow-md text-sm sm:text-base"
                      >
                        View Details
                      </button>
                      <Link
                        to={`/service-provider/${business.ownerId}`}
                        className="px-3 sm:px-4 py-1 sm:py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full hover:from-purple-500 hover:to-purple-600 transition-all shadow-sm hover:shadow-md text-sm sm:text-base flex items-center"
                      >
                        <FaUser className="mr-1" size={14} /> Provider
                      </Link>
                    </div>
                    {userRole === 'serviceProvider' && business.ownerId === currentUser?.uid && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditBusiness(business)}
                          className="px-3 sm:px-4 py-1 sm:py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-full hover:from-yellow-400 hover:to-yellow-500 transition-all shadow-sm hover:shadow-md text-sm sm:text-base"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteBusiness(business.id)}
                          className="px-3 sm:px-4 py-1 sm:py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full hover:from-red-500 hover:to-red-600 transition-all shadow-sm hover:shadow-md text-sm sm:text-base"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
            {totalPages > 1 && (
              <div className="mt-6 sm:mt-8 flex justify-center items-center gap-3">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-700/50 text-gray-200 rounded-lg hover:bg-gray-600/50 disabled:opacity-50 transition-all shadow-sm text-sm sm:text-base"
                >
                  Previous
                </button>
                <span className="text-gray-300 text-sm sm:text-base">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-700/50 text-gray-200 rounded-lg hover:bg-gray-600/50 disabled:opacity-50 transition-all shadow-sm text-sm sm:text-base"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-400 text-lg sm:text-xl">
              {userRole === 'serviceProvider'
                ? 'You have not created any business profiles yet.'
                : 'No business profiles available.'}
            </p>
            {userRole === 'serviceProvider' && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-500 hover:to-blue-600 transition-all shadow-sm hover:shadow-md text-sm sm:text-base"
              >
                <FaPlus className="inline mr-2" /> Create Your First Business
              </button>
            )}
          </div>
        )}
      </motion.div>

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

      {showDetailsModal && selectedBusinessForDetails && (
        <BusinessDetailsModal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          business={selectedBusinessForDetails}
          onViewFullProfile={() => {
            setShowDetailsModal(false);
            navigate(`/business-profiles/${selectedBusinessForDetails.id}`);
          }}
        />
      )}
    </div>
  );
}

export default BusinessProfiles;