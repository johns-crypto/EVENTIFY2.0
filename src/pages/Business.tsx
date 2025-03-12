import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, getBusinesses, BusinessData, ProductData } from '../services/firebase'; // Updated imports
import { useAuth } from '../context/AuthContext';
import { FaImage } from 'react-icons/fa';
import { motion } from 'framer-motion'; // Added for animations

type Category = 'Refreshments' | 'Catering/Food' | 'Venue Provider';

function Business() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [businesses, setBusinesses] = useState<BusinessData[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<BusinessData[]>([]);
  const [newBusiness, setNewBusiness] = useState({
    name: '',
    category: 'Refreshments' as Category,
    description: '',
    products: [] as ProductData[],
  });
  const [newProduct, setNewProduct] = useState({ name: '', description: '', image: null as File | null, inStock: true });
  const [editingBusiness, setEditingBusiness] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true); // Added loading state
  const [error, setError] = useState<string | null>(null); // Added error state

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const stagger = {
    visible: { transition: { staggerChildren: 0.2 } },
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const category = params.get('category') as Category | null;
    if (category) {
      setFilteredBusinesses(businesses.filter((b) => b.category === category));
    } else {
      setFilteredBusinesses(businesses);
    }
  }, [location.search, businesses]);

  const fetchBusinesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const businessData = await getBusinesses();
      setBusinesses(businessData);
    } catch (err: any) {
      setError('Failed to fetch businesses: ' + err.message);
      console.error('Error fetching businesses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.image) {
      setError('Product name and image are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const storageRef = ref(storage, `products/${newProduct.image.name}-${Date.now()}`);
      await uploadBytes(storageRef, newProduct.image);
      const imageUrl = await getDownloadURL(storageRef);
      setNewBusiness({
        ...newBusiness,
        products: [...newBusiness.products, { ...newProduct, imageUrl }],
      });
      setNewProduct({ name: '', description: '', image: null, inStock: true });
    } catch (err: any) {
      setError('Failed to add product: ' + err.message);
      console.error('Error adding product:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError('Please log in to register a business.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await addDoc(collection(db, 'businesses'), {
        ...newBusiness,
        ownerId: currentUser.uid,
      });
      setNewBusiness({ name: '', category: 'Refreshments', description: '', products: [] });
      await fetchBusinesses();
    } catch (err: any) {
      setError('Failed to register business: ' + err.message);
      console.error('Error registering business:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusiness || !currentUser || editingBusiness.ownerId !== currentUser.uid) {
      setError('Unauthorized or invalid business data.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const businessRef = doc(db, 'businesses', editingBusiness.id);
      await updateDoc(businessRef, {
        name: editingBusiness.name,
        category: editingBusiness.category,
        description: editingBusiness.description,
        products: editingBusiness.products,
      });
      setEditingBusiness(null);
      await fetchBusinesses();
    } catch (err: any) {
      setError('Failed to update business: ' + err.message);
      console.error('Error updating business:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: Category) => {
    switch (category) {
      case 'Refreshments': return 'bg-refreshments-lightBlue';
      case 'Catering/Food': return 'bg-catering-orange';
      case 'Venue Provider': return 'bg-venue-green';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-darkGray flex items-center justify-center">
        <svg
          className="animate-spin h-8 w-8 text-accent-gold"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray">
      <motion.section
        className="bg-primary-navy p-6"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <div className="container mx-auto">
          <h1 className="text-4xl font-bold text-accent-gold">Business Directory</h1>
          <p className="text-lg mt-2">Explore and connect with our registered businesses.</p>
        </div>
      </motion.section>

      <motion.section
        className="container mx-auto p-6"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <h2 className="text-2xl font-bold text-accent-gold mb-4">Registered Businesses</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={stagger}>
          {filteredBusinesses.map((business) => (
            <motion.div
              key={business.id}
              className="bg-neutral-offWhite text-neutral-darkGray p-4 rounded shadow"
              variants={fadeIn}
            >
              <div className={`${getCategoryColor(business.category)} h-2 rounded-t`}></div>
              <h3 className="text-xl font-semibold mt-2">{business.name}</h3>
              <p className="text-sm">{business.category}</p>
              <p>{business.description}</p>
              <h4 className="text-lg font-semibold mt-4">Products/Services</h4>
              <div className="grid grid-cols-1 gap-4 mt-2">
                {business.products.map((product, index) => (
                  <div key={index} className="bg-white p-3 rounded flex items-center space-x-4">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-16 h-16 object-cover rounded" />
                    ) : (
                      <FaImage className="w-16 h-16 text-gray-400" />
                    )}
                    <div>
                      <h5 className="font-semibold">{product.name}</h5>
                      <p className="text-sm">{product.description}</p>
                      <span
                        className={`text-sm ${product.inStock ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {product.inStock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {currentUser && business.ownerId === currentUser.uid && (
                <button
                  className="mt-4 bg-secondary-deepRed text-neutral-lightGray px-4 py-2 rounded hover:bg-secondary-darkRed"
                  onClick={() => setEditingBusiness(business)}
                  disabled={loading}
                >
                  Edit
                </button>
              )}
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {currentUser && (
        <motion.section
          className="container mx-auto p-6"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <h2 className="text-2xl font-bold text-accent-gold mb-4">Register Your Business</h2>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <form onSubmit={handleRegister} className="space-y-4 max-w-md">
            <div>
              <label htmlFor="business-name" className="block text-sm font-medium text-neutral-lightGray">Business Name</label>
              <input
                id="business-name"
                type="text"
                value={newBusiness.name}
                onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })}
                placeholder="Business Name"
                className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
                required
                aria-label="Business Name"
              />
            </div>
            <div>
              <label htmlFor="business-category" className="block text-sm font-medium text-neutral-lightGray">Category</label>
              <select
                id="business-category"
                value={newBusiness.category}
                onChange={(e) => setNewBusiness({ ...newBusiness, category: e.target.value as Category })}
                className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
                aria-label="Business Category"
              >
                <option value="Refreshments">Refreshments</option>
                <option value="Catering/Food">Catering/Food</option>
                <option value="Venue Provider">Venue Provider</option>
              </select>
            </div>
            <div>
              <label htmlFor="business-description" className="block text-sm font-medium text-neutral-lightGray">Description</label>
              <textarea
                id="business-description"
                value={newBusiness.description}
                onChange={(e) => setNewBusiness({ ...newBusiness, description: e.target.value })}
                placeholder="Description"
                className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
                rows={3}
                aria-label="Business Description"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="product-name" className="block text-sm font-medium text-neutral-lightGray">Product Name</label>
              <input
                id="product-name"
                type="text"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="Product Name"
                className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
                aria-label="Product Name"
              />
              <label htmlFor="product-description" className="block text-sm font-medium text-neutral-lightGray">Product Description</label>
              <textarea
                id="product-description"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                placeholder="Product Description"
                className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
                rows={2}
                aria-label="Product Description"
              />
              <label htmlFor="product-image" className="block text-sm font-medium text-neutral-lightGray">Product Image</label>
              <input
                id="product-image"
                type="file"
                accept="image/*"
                onChange={(e) => setNewProduct({ ...newProduct, image: e.target.files?.[0] || null })}
                className="w-full p-2"
                aria-label="Product Image"
              />
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newProduct.inStock}
                  onChange={(e) => setNewProduct({ ...newProduct, inStock: e.target.checked })}
                />
                <span>In Stock</span>
              </label>
              <button
                type="button"
                onClick={handleAddProduct}
                className="w-full bg-secondary-deepRed text-neutral-lightGray p-2 rounded hover:bg-secondary-darkRed"
                disabled={loading}
              >
                Add Product
              </button>
            </div>
            <button
              type="submit"
              className="w-full bg-secondary-deepRed text-neutral-lightGray p-2 rounded hover:bg-secondary-darkRed"
              disabled={loading}
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>
        </motion.section>
      )}

      {editingBusiness && currentUser && editingBusiness.ownerId === currentUser.uid && (
        <motion.section
          className="container mx-auto p-6"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <h2 className="text-2xl font-bold text-accent-gold mb-4">Edit Business</h2>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <form onSubmit={handleUpdate} className="space-y-4 max-w-md">
            <div>
              <label htmlFor="edit-business-name" className="block text-sm font-medium text-neutral-lightGray">Business Name</label>
              <input
                id="edit-business-name"
                type="text"
                value={editingBusiness.name}
                onChange={(e) => setEditingBusiness({ ...editingBusiness, name: e.target.value })}
                placeholder="Business Name"
                className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
                required
                aria-label="Business Name"
              />
            </div>
            <div>
              <label htmlFor="edit-business-category" className="block text-sm font-medium text-neutral-lightGray">Category</label>
              <select
                id="edit-business-category"
                value={editingBusiness.category}
                onChange={(e) => setEditingBusiness({ ...editingBusiness, category: e.target.value as Category })}
                className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
                aria-label="Business Category"
              >
                <option value="Refreshments">Refreshments</option>
                <option value="Catering/Food">Catering/Food</option>
                <option value="Venue Provider">Venue Provider</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-business-description" className="block text-sm font-medium text-neutral-lightGray">Description</label>
              <textarea
                id="edit-business-description"
                value={editingBusiness.description}
                onChange={(e) => setEditingBusiness({ ...editingBusiness, description: e.target.value })}
                placeholder="Description"
                className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
                rows={3}
                aria-label="Business Description"
              />
            </div>
            <div className="space-y-2">
              {editingBusiness.products.map((product, index) => (
                <div key={index} className="flex items-center space-x-2">
                  {product.imageUrl && (
                    <img src={product.imageUrl} alt={product.name} className="w-12 h-12 object-cover rounded" />
                  )}
                  <div>
                    <label htmlFor={`edit-product-name-${index}`} className="block text-sm font-medium text-neutral-lightGray">Product Name</label>
                    <input
                      id={`edit-product-name-${index}`}
                      type="text"
                      value={product.name}
                      onChange={(e) => {
                        const updatedProducts = [...editingBusiness.products];
                        updatedProducts[index].name = e.target.value;
                        setEditingBusiness({ ...editingBusiness, products: updatedProducts });
                      }}
                      className="p-1 rounded bg-neutral-offWhite text-neutral-darkGray"
                      aria-label={`Product Name ${index + 1}`}
                    />
                    <label htmlFor={`edit-product-inStock-${index}`} className="block text-sm font-medium text-neutral-lightGray">In Stock</label>
                    <input
                      id={`edit-product-inStock-${index}`}
                      type="checkbox"
                      checked={product.inStock}
                      onChange={(e) => {
                        const updatedProducts = [...editingBusiness.products];
                        updatedProducts[index].inStock = e.target.checked;
                        setEditingBusiness({ ...editingBusiness, products: updatedProducts });
                      }}
                      aria-label={`In Stock ${index + 1}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="w-full bg-secondary-deepRed text-neutral-lightGray p-2 rounded hover:bg-secondary-darkRed"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update'}
            </button>
            <button
              type="button"
              className="w-full bg-gray-500 text-neutral-lightGray p-2 rounded hover:bg-gray-600"
              onClick={() => setEditingBusiness(null)}
              disabled={loading}
            >
              Cancel
            </button>
          </form>
        </motion.section>
      )}
    </div>
  );
}

export default Business;