import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, getBusinesses, updateDoc, doc } from '../services/firebase';
import { motion } from 'framer-motion';
import { FaEdit, FaPlus } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

interface Business {
  id: string;
  name: string;
  category: string;
  description: string;
  ownerId: string;
  products: { name: string; description: string; imageUrl?: string; inStock: boolean }[];
}

function BusinessProfile() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: '', description: '' });

  useEffect(() => {
    if (!currentUser) {
      navigate('/login'); // Use navigate here
      return;
    }
    setLoading(true);
    getBusinesses()
      .then((businesses) => {
        const userBusiness = businesses.find((b) => b.ownerId === currentUser.uid);
        setBusiness(userBusiness || null);
        if (userBusiness)
          setFormData({ name: userBusiness.name, category: userBusiness.category, description: userBusiness.description });
      })
      .catch((err) => toast.error('Failed to load business: ' + err.message))
      .finally(() => setLoading(false));
  }, [currentUser, navigate]);

  const handleEdit = async () => {
    if (!business || !currentUser) return;
    try {
      await updateDoc(doc(db, 'businesses', business.id), formData);
      setBusiness({ ...business, ...formData });
      setEditing(false);
      toast.success('Business updated!');
    } catch (err: any) {
      toast.error('Failed to update business: ' + err.message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
  const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

  if (loading)
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-accent-gold" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            className="opacity-75"
          />
        </svg>
      </div>
    );

  return (
    <div className="min-h-screen bg-neutral-darkGray py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-4xl mx-auto bg-primary-navy p-8 rounded-lg shadow-lg"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        {business ? (
          <>
            <motion.div className="flex items-center space-x-6 mb-6" variants={fadeIn}>
              <div className="w-24 h-24 bg-neutral-offWhite rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-accent-gold">{business.name[0]}</span>
              </div>
              <div className="flex-1">
                {editing ? (
                  <div>
                    <label htmlFor="nameInput" className="block text-sm text-neutral-lightGray mb-1">
                      Business Name
                    </label>
                    <input
                      id="nameInput"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="text-3xl font-bold text-accent-gold bg-neutral-offWhite p-2 rounded w-full"
                      placeholder="Enter business name"
                    />
                  </div>
                ) : (
                  <h1 className="text-3xl font-bold text-accent-gold">{business.name}</h1>
                )}
                {editing ? (
                  <div className="mt-2">
                    <label htmlFor="categorySelect" className="block text-sm text-neutral-lightGray mb-1">
                      Category
                    </label>
                    <select
                      id="categorySelect"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full p-2 bg-neutral-offWhite text-neutral-darkGray rounded"
                    >
                      <option value="Refreshments">Refreshments</option>
                      <option value="Catering/Food">Catering/Food</option>
                      <option value="Venue Provider">Venue Provider</option>
                    </select>
                  </div>
                ) : (
                  <p className="text-neutral-lightGray text-lg">{business.category}</p>
                )}
              </div>
              <button
                onClick={() => (editing ? handleEdit() : setEditing(true))}
                className="bg-secondary-deepRed p-3 rounded-full hover:bg-secondary-darkRed transition-colors"
                aria-label={editing ? 'Save Changes' : 'Edit Business'}
              >
                <FaEdit size={24} className="text-neutral-lightGray" />
              </button>
            </motion.div>
            <motion.div className="mb-6" variants={fadeIn}>
              <h2 className="text-xl font-semibold text-accent-gold mb-2">Description</h2>
              {editing ? (
                <div>
                  <label htmlFor="descriptionTextarea" className="block text-sm text-neutral-lightGray mb-1">
                    Description
                  </label>
                  <textarea
                    id="descriptionTextarea"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full p-3 rounded bg-neutral-offWhite text-neutral-darkGray"
                    rows={4}
                    placeholder="Enter business description"
                  />
                </div>
              ) : (
                <p className="text-neutral-lightGray">{business.description || 'No description provided.'}</p>
              )}
            </motion.div>
            <motion.div variants={fadeIn}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-accent-gold">Products</h2>
                <Link
                  to="/business"
                  className="bg-accent-gold text-neutral-darkGray p-2 rounded-full hover:bg-yellow-600 transition-colors"
                  aria-label="Add Product"
                >
                  <FaPlus size={20} />
                </Link>
              </div>
              {business.products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {business.products.map((product, idx) => (
                    <div
                      key={idx}
                      className="bg-neutral-offWhite p-4 rounded-lg shadow hover:shadow-lg transition-shadow"
                    >
                      {product.imageUrl && (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-32 object-cover rounded mb-3" />
                      )}
                      <h3 className="text-lg font-semibold text-accent-gold">{product.name}</h3>
                      <p className="text-neutral-darkGray text-sm">{product.description}</p>
                      <p className="text-sm mt-2 text-neutral-darkGray">
                        {product.inStock ? 'In Stock' : 'Out of Stock'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-lightGray">No products listed yet.</p>
              )}
            </motion.div>
          </>
        ) : (
          <motion.p className="text-neutral-lightGray text-center" variants={fadeIn}>
            No business registered yet.{' '}
            <Link to="/business" className="text-accent-gold hover:underline">
              Register one
            </Link>
            .
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

export default BusinessProfile;