// src/pages/BusinessProfiles.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, updateDoc, doc } from '../services/firebase';
import { motion } from 'framer-motion';
import { FaEdit, FaPlus, FaTimes, FaFilter, FaCheckCircle, FaTimesCircle, FaCheck, FaRedo } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { collection, query, getDocs } from 'firebase/firestore';
import debounce from 'lodash/debounce';
import { multiStepCreateBusiness } from '../services/multiStepCreateBusiness';
import { uploadImageToCloudinary } from '../utils/cloudinary';

interface Business {
  id: string;
  name: string;
  services: string[];
  description: string;
  contact: string;
  location: string;
  imageUrl?: string;
  ownerId: string;
  products: { name: string; description: string; imageUrl?: string; inStock: boolean }[];
}

interface Product {
  name: string;
  description: string;
  imageUrl?: string;
  inStock: boolean;
}

interface FormErrors {
  name?: string;
  services?: string;
  description?: string;
  contact?: string;
  location?: string;
  productName?: string;
  productDescription?: string;
}

function BusinessProfiles() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    services: string[];
    description: string;
    contact: string;
    location: string;
    imageUrl: string;
  }>({
    name: '',
    services: [],
    description: '',
    contact: '',
    location: '',
    imageUrl: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [filter, setFilter] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState<Product>({
    name: '',
    description: '',
    imageUrl: '',
    inStock: true,
  });
  const [editingProductIndex, setEditingProductIndex] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const serviceOptions = ['Catering', 'Refreshments', 'Venue Provider'];

  const handleSuccess = useCallback((newBusiness: Business) => {
    setBusinesses((prev) => [...prev, newBusiness]);
    setShowModal(false);
    toast.success('Business created successfully!');
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
    toast.error(message);
  }, []);

  const {
    step,
    newBusiness,
    setNewBusiness,
    handleNextStep,
    handlePrevStep,
    handleCreateBusiness,
    handleImageUpload,
    loading: multiStepLoading,
  } = multiStepCreateBusiness({
    userId: currentUser?.uid || '',
    onSuccess: handleSuccess,
    onError: handleError,
  });

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setError('Please sign in to view business profiles.');
      navigate('/login');
      return;
    }

    const fetchBusinesses = async () => {
      setLoading(true);
      setError(null);
      try {
        const businessesQuery = query(collection(db, 'businesses'));
        const querySnapshot = await getDocs(businessesQuery);
        const businessData = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as Business))
          .filter((business: Business) => business.ownerId === currentUser.uid);
        setBusinesses(businessData);
        setFilteredBusinesses(businessData);
      } catch (err: any) {
        setError(`Failed to load businesses: ${err.message}`);
        toast.error(`Failed to load businesses: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchBusinesses();
  }, [currentUser, navigate]);

  const debouncedFilter = useMemo(
    () =>
      debounce((value: string) => {
        setFilteredBusinesses(
          businesses.filter((business) =>
            business.name.toLowerCase().includes(value.toLowerCase())
          )
        );
      }, 300),
    [businesses]
  );

  useEffect(() => {
    debouncedFilter(filter);
    return () => debouncedFilter.cancel();
  }, [filter, debouncedFilter]);

  const validateForm = () => {
    const errors: FormErrors = {};
    if (!formData.name.trim()) errors.name = 'Business name is required.';
    if (formData.services.length === 0)
      errors.services = 'Please select at least one service.';
    if (!formData.description.trim())
      errors.description = 'Description is required.';
    if (!formData.contact.trim()) errors.contact = 'Contact information is required.';
    if (!formData.location.trim()) errors.location = 'Location is required.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateProductForm = () => {
    const errors: FormErrors = {};
    if (!productForm.name.trim()) errors.productName = 'Product name is required.';
    if (!productForm.description.trim())
      errors.productDescription = 'Product description is required.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleServiceChange = (service: string) => {
    setFormData((prev) => {
      const services = prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service];
      return { ...prev, services };
    });
    setFormErrors((prev) => ({ ...prev, services: undefined }));
  };

  const handleImageUploadLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imageUrl = await uploadImageToCloudinary(file);
        setFormData((prev) => ({ ...prev, imageUrl }));
        toast.success('Image uploaded successfully!');
      } catch (error) {
        toast.error('Failed to upload image: ' + (error as Error).message);
      }
    }
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imageUrl = await uploadImageToCloudinary(file);
        setProductForm((prev) => ({ ...prev, imageUrl }));
        toast.success('Product image uploaded successfully!');
      } catch (error) {
        toast.error('Failed to upload product image: ' + (error as Error).message);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!currentUser) {
      toast.error('User not authenticated.');
      return;
    }

    try {
      if (editingBusiness) {
        const businessRef = doc(db, 'businesses', editingBusiness.id);
        await updateDoc(businessRef, {
          ...formData,
          ownerId: currentUser.uid,
          products: editingBusiness.products,
        });
        setBusinesses((prev) =>
          prev.map((b) =>
            b.id === editingBusiness.id ? { ...b, ...formData } : b
          )
        );
        toast.success('Business updated successfully!');
      }
      setEditingBusiness(null);
      setFormData({
        name: '',
        services: [],
        description: '',
        contact: '',
        location: '',
        imageUrl: '',
      });
      setShowModal(false);
    } catch (error) {
      toast.error('Failed to save business: ' + (error as Error).message);
    }
  };

  const handleEdit = (business: Business) => {
    setEditingBusiness(business);
    setFormData({
      name: business.name,
      services: business.services,
      description: business.description,
      contact: business.contact,
      location: business.location,
      imageUrl: business.imageUrl || '',
    });
    setShowModal(true);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProductForm()) return;
    if (!editingBusiness) return;

    try {
      const updatedProducts = [...editingBusiness.products];
      if (editingProductIndex !== null) {
        updatedProducts[editingProductIndex] = productForm;
      } else {
        updatedProducts.push(productForm);
      }

      const businessRef = doc(db, 'businesses', editingBusiness.id);
      await updateDoc(businessRef, { products: updatedProducts });
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === editingBusiness.id ? { ...b, products: updatedProducts } : b
        )
      );
      setProductForm({ name: '', description: '', imageUrl: '', inStock: true });
      setEditingProductIndex(null);
      setShowProductModal(false);
      toast.success('Product saved successfully!');
    } catch (error) {
      toast.error('Failed to save product: ' + (error as Error).message);
    }
  };

  const handleEditProduct = (index: number) => {
    if (editingBusiness) {
      setProductForm(editingBusiness.products[index]);
      setEditingProductIndex(index);
      setShowProductModal(true);
    }
  };

  useEffect(() => {
    if (showModal && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      firstElement?.focus();
    }
  }, [showModal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-white">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <motion.section
        className="py-12 px-6 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-6xl mx-auto bg-gray-800 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-yellow-400 mb-4 sm:mb-0">
              Your Business Profiles
            </h2>
            {currentUser && (
              <motion.button
                onClick={() => {
                  setEditingBusiness(null);
                  setFormData({
                    name: '',
                    services: [],
                    description: '',
                    contact: '',
                    location: '',
                    imageUrl: '',
                  });
                  setShowModal(true);
                }}
                className="bg-yellow-400 text-gray-900 font-semibold rounded-full px-6 py-3 hover:bg-yellow-300 transition-all shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FaPlus className="inline mr-2" /> Create Business
              </motion.button>
            )}
          </div>

          <div className="mb-6 flex items-center">
            <FaFilter className="text-yellow-400 mr-2" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter businesses..."
              className="w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {filteredBusinesses.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
            >
              {filteredBusinesses.map((business) => (
                <motion.div
                  key={business.id}
                  className="bg-gray-700 rounded-lg overflow-hidden shadow-md"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <img
                    src={business.imageUrl || 'https://via.placeholder.com/300'}
                    alt={business.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="text-xl font-semibold text-yellow-400">
                      {business.name}
                    </h3>
                    <p className="text-gray-400 mt-1">{business.description}</p>
                    <p className="text-gray-400 mt-1">
                      <strong>Services:</strong> {business.services.join(', ')}
                    </p>
                    <p className="text-gray-400 mt-1">
                      <strong>Contact:</strong> {business.contact}
                    </p>
                    <p className="text-gray-400 mt-1">
                      <strong>Location:</strong> {business.location}
                    </p>
                    <div className="mt-4">
                      <h4 className="text-lg font-semibold text-yellow-400">
                        Products
                      </h4>
                      {business.products.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {business.products.map((product, index) => (
                            <li
                              key={index}
                              className="flex justify-between items-center bg-gray-600 p-2 rounded"
                            >
                              <div>
                                <p className="text-gray-200">{product.name}</p>
                                <p className="text-gray-400 text-sm">
                                  {product.description}
                                </p>
                                <p className="text-gray-400 text-sm">
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
                              <button
                                onClick={() => handleEditProduct(index)}
                                className="text-yellow-400 hover:text-yellow-300"
                                aria-label={`Edit product ${product.name}`}
                              >
                                <FaEdit />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-400 mt-1">No products added.</p>
                      )}
                      <button
                        onClick={() => {
                          setEditingBusiness(business);
                          setProductForm({
                            name: '',
                            description: '',
                            imageUrl: '',
                            inStock: true,
                          });
                          setEditingProductIndex(null);
                          setShowProductModal(true);
                        }}
                        className="mt-2 text-yellow-400 hover:text-yellow-300 flex items-center"
                        aria-label={`Add product to ${business.name}`}
                      >
                        <FaPlus className="mr-1" /> Add Product
                      </button>
                    </div>
                    <div className="mt-4 flex space-x-2">
                      <button
                        onClick={() => handleEdit(business)}
                        className="px-4 py-2 bg-yellow-400 text-gray-900 rounded-full hover:bg-yellow-300 transition-all"
                        aria-label={`Edit business ${business.name}`}
                      >
                        Edit Business
                      </button>
                      <Link
                        to={`/business-profile/${business.id}`}
                        className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-all"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-center text-gray-400">
              No business profiles found. Create one to get started!
            </p>
          )}
        </div>
      </motion.section>

      {showModal && currentUser && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <motion.div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-800 rounded-2xl max-w-md w-full p-6 relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-200"
              aria-label="Close business modal"
            >
              <FaTimes size={20} />
            </button>
            <h3 className="text-2xl font-bold text-yellow-400 mb-6">
              {editingBusiness ? 'Edit Business' : 'Create Business'}
            </h3>
            {editingBusiness ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="nameInput"
                    className="block text-sm text-gray-200 mb-1"
                  >
                    Business Name
                  </label>
                  <input
                    id="nameInput"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`text-3xl font-bold text-yellow-400 bg-gray-700 p-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.name ? 'border-red-500 border' : ''}`}
                    placeholder="Enter business name"
                    {...(formErrors.name ? { 'aria-invalid': true } : {})}
                    aria-describedby={formErrors.name ? 'name-error' : undefined}
                  />
                  {formErrors.name && (
                    <p id="name-error" className="text-red-500 text-sm mt-1">
                      {formErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-1">
                    Services
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {serviceOptions.map((service) => (
                      <button
                        key={service}
                        type="button"
                        onClick={() => handleServiceChange(service)}
                        className={`px-3 py-1 rounded-full text-sm ${formData.services.includes(service) ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-200'}`}
                        aria-label={`Toggle ${service} service`}
                      >
                        {service}
                        {formData.services.includes(service) && (
                          <FaCheck className="inline ml-1" />
                        )}
                      </button>
                    ))}
                  </div>
                  {formErrors.services && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.services}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="descriptionTextarea"
                    className="block text-sm text-gray-200 mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    id="descriptionTextarea"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className={`w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.description ? 'border-red-500 border' : ''}`}
                    rows={4}
                    placeholder="Enter business description"
                    {...(formErrors.description ? { 'aria-invalid': true } : {})}
                    aria-describedby={formErrors.description ? 'description-error' : undefined}
                  />
                  {formErrors.description && (
                    <p id="description-error" className="text-red-500 text-sm mt-1">
                      {formErrors.description}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="contactInput"
                    className="block text-sm text-gray-200 mb-1"
                  >
                    Contact Information
                  </label>
                  <input
                    id="contactInput"
                    name="contact"
                    value={formData.contact}
                    onChange={handleInputChange}
                    className={`w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.contact ? 'border-red-500 border' : ''}`}
                    placeholder="Enter contact information"
                    {...(formErrors.contact ? { 'aria-invalid': true } : {})}
                    aria-describedby={formErrors.contact ? 'contact-error' : undefined}
                  />
                  {formErrors.contact && (
                    <p id="contact-error" className="text-red-500 text-sm mt-1">
                      {formErrors.contact}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="locationInput"
                    className="block text-sm text-gray-200 mb-1"
                  >
                    Location
                  </label>
                  <input
                    id="locationInput"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className={`w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.location ? 'border-red-500 border' : ''}`}
                    placeholder="Enter location"
                    {...(formErrors.location ? { 'aria-invalid': true } : {})}
                    aria-describedby={formErrors.location ? 'location-error' : undefined}
                  />
                  {formErrors.location && (
                    <p id="location-error" className="text-red-500 text-sm mt-1">
                      {formErrors.location}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="imageInput"
                    className="block text-sm text-gray-200 mb-1"
                  >
                    Business Image
                  </label>
                  <input
                    id="imageInput"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUploadLocal}
                    className="w-full p-3 rounded bg-gray-700 text-gray-200"
                  />
                  {formData.imageUrl && (
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="mt-2 w-full h-32 object-cover rounded"
                    />
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full bg-yellow-400 text-gray-900 p-3 rounded-lg hover:bg-yellow-300 transition-all"
                >
                  {editingBusiness ? 'Update Business' : 'Create Business'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between mb-6">
                  {[1, 2, 3].map((stepNum) => (
                    <div key={stepNum} className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${stepNum <= step ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-200'}`}
                      >
                        {stepNum}
                      </div>
                    </div>
                  ))}
                </div>
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="newBusinessName"
                        className="block text-sm text-gray-200 mb-1"
                      >
                        Business Name
                      </label>
                      <input
                        id="newBusinessName"
                        value={newBusiness.name}
                        onChange={(e) =>
                          setNewBusiness({ ...newBusiness, name: e.target.value })
                        }
                        className="w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        placeholder="Enter business name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-200 mb-1">
                        Services
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {serviceOptions.map((service) => (
                          <button
                            key={service}
                            type="button"
                            onClick={() =>
                              setNewBusiness((prev) => {
                                const services = prev.services.includes(service)
                                  ? prev.services.filter((s) => s !== service)
                                  : [...prev.services, service];
                                return { ...prev, services };
                              })
                            }
                            className={`px-3 py-1 rounded-full text-sm ${newBusiness.services.includes(service) ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-200'}`}
                            aria-label={`Toggle ${service} service`}
                          >
                            {service}
                            {newBusiness.services.includes(service) && (
                              <FaCheck className="inline ml-1" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleNextStep}
                      className="w-full bg-yellow-400 text-gray-900 p-3 rounded-lg hover:bg-yellow-300 transition-all"
                      disabled={multiStepLoading}
                    >
                      Next
                    </button>
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="newBusinessContact"
                        className="block text-sm text-gray-200 mb-1"
                      >
                        Contact Information
                      </label>
                      <input
                        id="newBusinessContact"
                        value={newBusiness.contact}
                        onChange={(e) =>
                          setNewBusiness({ ...newBusiness, contact: e.target.value })
                        }
                        className="w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        placeholder="Enter contact information"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="newBusinessLocation"
                        className="block text-sm text-gray-200 mb-1"
                      >
                        Location
                      </label>
                      <input
                        id="newBusinessLocation"
                        value={newBusiness.location}
                        onChange={(e) =>
                          setNewBusiness({ ...newBusiness, location: e.target.value })
                        }
                        className="w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        placeholder="Enter location"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={handlePrevStep}
                        className="w-full bg-gray-600 text-gray-200 p-3 rounded-lg hover:bg-gray-500 transition-all"
                        disabled={multiStepLoading}
                      >
                        Back
                      </button>
                      <button
                        onClick={handleNextStep}
                        className="w-full bg-yellow-400 text-gray-900 p-3 rounded-lg hover:bg-yellow-300 transition-all"
                        disabled={multiStepLoading}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
                {step === 3 && (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="newBusinessDescription"
                        className="block text-sm text-gray-200 mb-1"
                      >
                        Description
                      </label>
                      <textarea
                        id="newBusinessDescription"
                        value={newBusiness.description}
                        onChange={(e) =>
                          setNewBusiness({
                            ...newBusiness,
                            description: e.target.value,
                          })
                        }
                        className="w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        rows={4}
                        placeholder="Enter business description"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="newBusinessImage"
                        className="block text-sm text-gray-200 mb-1"
                      >
                        Business Image
                      </label>
                      <input
                        id="newBusinessImage"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full p-3 rounded bg-gray-700 text-gray-200"
                      />
                      {newBusiness.imageUrl && (
                        <img
                          src={newBusiness.imageUrl}
                          alt="Preview"
                          className="mt-2 w-full h-32 object-cover rounded"
                        />
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={handlePrevStep}
                        className="w-full bg-gray-600 text-gray-200 p-3 rounded-lg hover:bg-gray-500 transition-all"
                        disabled={multiStepLoading}
                      >
                        Back
                      </button>
                      <button
                        onClick={handleCreateBusiness}
                        className="w-full bg-yellow-400 text-gray-900 p-3 rounded-lg hover:bg-yellow-300 transition-all"
                        disabled={multiStepLoading}
                      >
                        {multiStepLoading ? 'Creating...' : 'Create Business'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {showProductModal && editingBusiness && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowProductModal(false)}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-800 rounded-2xl max-w-md w-full p-6 relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <button
              onClick={() => setShowProductModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-200"
              aria-label="Close product modal"
            >
              <FaTimes size={20} />
            </button>
            <h3 className="text-2xl font-bold text-yellow-400 mb-6">
              {editingProductIndex !== null ? 'Edit Product' : 'Add Product'}
            </h3>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label
                  htmlFor="productName"
                  className="block text-sm text-gray-200 mb-1"
                >
                  Product Name
                </label>
                <input
                  id="productName"
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm({ ...productForm, name: e.target.value })
                  }
                  className={`w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.productName ? 'border-red-500 border' : ''}`}
                  placeholder="Enter product name"
                />
                {formErrors.productName && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.productName}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="productDescription"
                  className="block text-sm text-gray-200 mb-1"
                >
                  Product Description
                </label>
                <textarea
                  id="productDescription"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm({ ...productForm, description: e.target.value })
                  }
                  className={`w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.productDescription ? 'border-red-500 border' : ''}`}
                  rows={3}
                  placeholder="Enter product description"
                />
                {formErrors.productDescription && (
                  <p className="text-red-500 text-sm mt-1">
                    {formErrors.productDescription}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="productImage"
                  className="block text-sm text-gray-200 mb-1"
                >
                  Product Image
                </label>
                <input
                  id="productImage"
                  type="file"
                  accept="image/*"
                  onChange={handleProductImageUpload}
                  className="w-full p-3 rounded bg-gray-700 text-gray-200"
                />
                {productForm.imageUrl && (
                  <img
                    src={productForm.imageUrl}
                    alt="Product Preview"
                    className="mt-2 w-full h-32 object-cover rounded"
                  />
                )}
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="inStock"
                  checked={productForm.inStock}
                  onChange={(e) =>
                    setProductForm({ ...productForm, inStock: e.target.checked })
                  }
                  className="mr-2"
                />
                <label htmlFor="inStock" className="text-sm text-gray-200">
                  In Stock
                </label>
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="w-full bg-yellow-400 text-gray-900 p-3 rounded-lg hover:bg-yellow-300 transition-all"
                >
                  {editingProductIndex !== null ? 'Update Product' : 'Add Product'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProductForm({
                      name: '',
                      description: '',
                      imageUrl: '',
                      inStock: true,
                    });
                    setEditingProductIndex(null);
                    setShowProductModal(false);
                  }}
                  className="w-full bg-gray-600 text-gray-200 p-3 rounded-lg hover:bg-gray-500 transition-all flex items-center justify-center"
                  aria-label="Reset product form"
                >
                  <FaRedo className="mr-2" /> Reset
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default BusinessProfiles;