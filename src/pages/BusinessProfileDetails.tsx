// src/pages/BusinessProfileDetails.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, updateDoc, doc, deleteDoc } from '../services/firebase';
import { motion } from 'framer-motion';
import { FaEdit, FaPlus, FaArrowLeft, FaCheckCircle, FaTimesCircle, FaTrash, FaCalendar } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { collection, query, getDocs, where } from 'firebase/firestore';
import ProductFormModal from './ProductFormModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface Business {
  id: string;
  name: string;
  services: string[];
  description: string;
  contact: { phoneNumber: string; email?: string };
  location: string;
  imageUrl?: string;
  ownerId: string;
  products: { name: string; description: string; imageUrl?: string; inStock: boolean; category?: string }[];
}

interface Product {
  name: string;
  description: string;
  imageUrl?: string;
  inStock: boolean;
  file?: File;
  category?: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
  products: { name: string; businessId: string }[];
}

interface Notification {
  id: string;
  businessId: string;
  productName: string;
  eventId: string;
  eventTitle: string;
  timestamp: string;
  read: boolean;
}

const LazyImage = ({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      onLoad={() => setIsLoaded(true)}
      loading="lazy"
    />
  );
};

interface BusinessProfileDetailsProps {
  business: Business;
  setSelectedBusiness: (business: Business | null) => void;
}

function BusinessProfileDetails({ business, setSelectedBusiness }: BusinessProfileDetailsProps) {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Business>(business);
  const [eventsServicing, setEventsServicing] = useState<Event[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductIndex, setEditingProductIndex] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<Product>({
    name: '',
    description: '',
    imageUrl: '',
    inStock: true,
    category: 'Food',
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteProductModal, setShowDeleteProductModal] = useState(false);
  const [productToDeleteIndex, setProductToDeleteIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventsQuery = query(collection(db, 'events'));
        const eventsSnapshot = await getDocs(eventsQuery);
        const allEvents = eventsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Event[];

        const currentDate = new Date();
        const servicingEvents = allEvents.filter((event) => {
          const eventDate = new Date(event.date);
          return (
            eventDate >= currentDate &&
            event.products?.some((product) => product.businessId === business.id)
          );
        });
        setEventsServicing(servicingEvents);

        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('businessId', '==', business.id)
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        const notificationsData = notificationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Notification[];
        setNotifications(notificationsData);
      } catch (err: any) {
        toast.error(`Failed to load data: ${err.message}`);
      }
    };

    fetchData();
  }, [business.id]);

  const handleEdit = () => {
    if (userRole !== 'serviceProvider') {
      toast.error('You must be a registered service provider to edit a business.');
      return;
    }
    navigate(`/business-profiles/${business.id}/edit`);
  };

  const handleDelete = async () => {
    if (userRole !== 'serviceProvider') {
      toast.error('You must be a registered service provider to delete a business.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'businesses', business.id));
      toast.success('Business deleted successfully!');
      setSelectedBusiness(null);
      navigate('/business-profiles');
    } catch (error) {
      toast.error('Failed to delete business: ' + (error as Error).message);
    }
  };

  const handleEditProduct = (index: number) => {
    if (userRole !== 'serviceProvider') {
      toast.error('You must be a registered service provider to edit a product.');
      return;
    }
    setProductForm(business.products[index]);
    setEditingProductIndex(index);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async () => {
    if (productToDeleteIndex === null) return;
    if (userRole !== 'serviceProvider') {
      toast.error('You must be a registered service provider to delete a product.');
      return;
    }
    const updatedProducts = formData.products.filter((_, i) => i !== productToDeleteIndex);

    const businessRef = doc(db, 'businesses', business.id);
    await updateDoc(businessRef, { products: updatedProducts });

    setFormData((prev) => ({ ...prev, products: updatedProducts }));
    setShowDeleteProductModal(false);
    setProductToDeleteIndex(null);
    toast.success('Product deleted successfully!');
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      toast.error('Failed to mark notification as read: ' + (error as Error).message);
    }
  };

  const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
  const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white py-6 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-5xl mx-auto bg-gray-800/70 backdrop-blur-lg rounded-2xl p-4 sm:p-6 lg:p-8 shadow-2xl border border-gray-700/30"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <button
            onClick={() => navigate('/business-profiles')}
            className="text-gray-300 hover:text-yellow-400 transition-colors flex items-center text-sm sm:text-base"
          >
            <FaArrowLeft className="mr-2" /> Back to Business Profiles
          </button>
          {userRole === 'serviceProvider' && (
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
              <button
                onClick={handleEdit}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 rounded-full hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-sm text-sm sm:text-base"
              >
                <FaEdit className="inline mr-2" /> Edit Business
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full hover:from-red-400 hover:to-red-500 transition-all shadow-sm text-sm sm:text-base"
              >
                <FaTrash className="inline mr-2" /> Delete Business
              </button>
            </div>
          )}
        </div>

        <div className="relative h-48 sm:h-56 lg:h-64 mb-6">
          <LazyImage
            src={business.imageUrl || 'https://via.placeholder.com/1200x300'}
            alt={business.name}
            className="w-full h-full object-cover rounded-lg"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent rounded-lg"></div>
          <h2 className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 text-xl sm:text-2xl lg:text-4xl font-bold text-white">
            {business.name}
          </h2>
        </div>

        <div className="space-y-6 sm:space-y-8">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-2">Description</h3>
            <p className="text-gray-300 text-sm sm:text-base">{business.description}</p>
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-2">Details</h3>
            <p className="text-gray-400 text-sm sm:text-base">
              <strong className="text-yellow-400">Services:</strong>{' '}
              {business.services.join(', ') || 'N/A'}
            </p>
            <p className="text-gray-400 text-sm sm:text-base">
              <strong className="text-yellow-400">Phone:</strong>{' '}
              {business.contact.phoneNumber}
            </p>
            {business.contact.email && (
              <p className="text-gray-400 text-sm sm:text-base">
                <strong className="text-yellow-400">Email:</strong>{' '}
                {business.contact.email}
              </p>
            )}
            <p className="text-gray-400 text-sm sm:text-base">
              <strong className="text-yellow-400">Location:</strong>{' '}
              {business.location}
            </p>
          </div>

          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h3 className="text-lg sm:text-xl font-semibold text-yellow-400">Products</h3>
              {userRole === 'serviceProvider' && (
                <button
                  onClick={() => {
                    setProductForm({ name: '', description: '', imageUrl: '', inStock: true, category: 'Food' });
                    setEditingProductIndex(null);
                    setShowProductModal(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-500 hover:to-blue-600 transition-all shadow-sm text-sm sm:text-base"
                >
                  <FaPlus className="inline mr-2" /> Add Product
                </button>
              )}
            </div>

            {formData.products.length > 0 ? (
              <motion.ul className="space-y-4" variants={stagger}>
                {formData.products.map((product, index) => (
                  <motion.li
                    key={index}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-600/50 p-3 sm:p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 gap-4"
                    variants={fadeIn}
                  >
                    <div className="flex items-center gap-4">
                      {product.imageUrl && (
                        <LazyImage
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg"
                        />
                      )}
                      <div>
                        <p className="text-gray-200 font-medium text-sm sm:text-base">{product.name}</p>
                        <p className="text-gray-400 text-xs sm:text-sm line-clamp-2">{product.description}</p>
                        <p className="text-gray-400 text-xs sm:text-sm mt-1">
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
                        {product.category && (
                          <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold text-gray-200 bg-gray-500/50 rounded-full">
                            {product.category}
                          </span>
                        )}
                      </div>
                    </div>
                    {userRole === 'serviceProvider' && (
                      <div className="flex space-x-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleEditProduct(index)}
                          className="w-full sm:w-auto px-3 py-1 bg-yellow-400 text-gray-900 rounded-full hover:bg-yellow-300 transition-colors text-sm"
                          aria-label={`Edit product ${product.name}`}
                        >
                          <FaEdit size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setProductToDeleteIndex(index);
                            setShowDeleteProductModal(true);
                          }}
                          className="w-full sm:w-auto px-3 py-1 bg-red-500 text-white rounded-full hover:bg-red-400 transition-colors text-sm"
                          aria-label={`Delete product ${product.name}`}
                        >
                          <FaTrash size={16} />
                        </button>
                      </div>
                    )}
                  </motion.li>
                ))}
              </motion.ul>
            ) : (
              <p className="text-gray-400 text-center text-sm sm:text-base">No products added yet.</p>
            )}
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-4">Events Servicing</h3>
            {eventsServicing.length > 0 ? (
              <motion.ul className="space-y-4" variants={stagger}>
                {eventsServicing.map((event) => (
                  <motion.li
                    key={event.id}
                    className="bg-gray-600/50 p-3 sm:p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                    variants={fadeIn}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-200 font-medium text-sm sm:text-base">{event.title}</p>
                        <p className="text-gray-400 text-xs sm:text-sm">
                          Date: {new Date(event.date).toLocaleDateString()}
                        </p>
                        <p className="text-gray-400 text-xs sm:text-sm">
                          Products: {event.products
                            .filter((p) => p.businessId === business.id)
                            .map((p) => p.name)
                            .join(', ')}
                        </p>
                      </div>
                      <FaCalendar className="text-yellow-400" size={20} />
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            ) : (
              <p className="text-gray-400 text-center text-sm sm:text-base">
                No events are currently using your services.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-yellow-400 mb-4">Notifications</h3>
            {notifications.length > 0 ? (
              <motion.ul className="space-y-4" variants={stagger}>
                {notifications.map((notif) => (
                  <motion.li
                    key={notif.id}
                    className={`p-3 sm:p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 ${
                      notif.read ? 'bg-gray-600/50' : 'bg-gray-500/70'
                    }`}
                    variants={fadeIn}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-200 text-sm sm:text-base">
                          Product <strong>{notif.productName}</strong> was added to event{' '}
                          <strong>{notif.eventTitle}</strong>.
                        </p>
                        <p className="text-gray-400 text-xs sm:text-sm">
                          {new Date(notif.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {!notif.read && (
                        <button
                          onClick={() => markNotificationAsRead(notif.id!)}
                          className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm"
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            ) : (
              <p className="text-gray-400 text-center text-sm sm:text-base">No notifications.</p>
            )}
          </div>
        </div>
      </motion.div>

      {showProductModal && (
        <ProductFormModal
          business={business}
          product={editingProductIndex !== null ? formData.products[editingProductIndex] : null}
          onClose={() => setShowProductModal(false)}
          onSave={(updatedProduct) => {
            const updatedProducts = editingProductIndex !== null
              ? formData.products.map((p, i) => (i === editingProductIndex ? updatedProduct : p))
              : [...formData.products, updatedProduct];
            setFormData((prev) => ({ ...prev, products: updatedProducts }));
            setShowProductModal(false);
          }}
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmationModal
          title="Confirm Deletion"
          message={`Are you sure you want to delete ${business.name}? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {showDeleteProductModal && productToDeleteIndex !== null && (
        <DeleteConfirmationModal
          title="Confirm Deletion"
          message={`Are you sure you want to delete ${formData.products[productToDeleteIndex].name}? This action cannot be undone.`}
          onConfirm={handleDeleteProduct}
          onCancel={() => {
            setShowDeleteProductModal(false);
            setProductToDeleteIndex(null);
          }}
        />
      )}
    </div>
  );
}

export default BusinessProfileDetails;