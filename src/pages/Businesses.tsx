import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { FaSave, FaPlus, FaTrash, FaFilter, FaCheckCircle, FaTimesCircle, FaTimes, FaRedo } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import debounce from 'lodash/debounce';

type Category = 'Refreshments' | 'Catering/Food' | 'Venue Provider';

interface Product {
  name: string;
  description: string;
  imageUrl?: string;
  inStock: boolean;
  file?: File; // For new products being added
}

interface Business {
  id: string;
  name: string;
  category: Category;
  description: string;
  ownerId: string;
  products: Product[];
}

interface ProductFilter {
  showInStockOnly: boolean;
  sortBy: 'name' | 'stock';
}

interface FormErrors {
  name: string;
  category: string;
  description: string;
  productName: string;
  productDescription: string;
}

// Custom component for lazy loading images
const LazyImage = ({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={shouldLoad ? src : undefined}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
};

// Function to upload image to Cloudinary
const uploadImageToCloudinary = async (file: File): Promise<string> => {
  const cloudName = 'your-cloud-name'; // Replace with your Cloudinary cloud name
  const uploadPreset = 'your-upload-preset'; // Replace with your Cloudinary upload preset

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload image to Cloudinary');
  }

  const data = await response.json();
  return data.secure_url; // Return the secure URL of the uploaded image
};

function Business() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<Category>('Refreshments');
  const [description, setDescription] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [newProduct, setNewProduct] = useState<Product>({
    name: '',
    description: '',
    inStock: true,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProductFilter>({ showInStockOnly: false, sortBy: 'name' });
  const [formErrors, setFormErrors] = useState<FormErrors>({
    name: '',
    category: '',
    description: '',
    productName: '',
    productDescription: '',
  });

  // Fetch the user's business directly from Firestore
  const fetchBusiness = useCallback(async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'businesses'), where('ownerId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userBusiness = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Business;
        setBusinessId(userBusiness.id);
        setName(userBusiness.name || '');
        setCategory(userBusiness.category as Category);
        setDescription(userBusiness.description || '');
        setProducts(userBusiness.products || []);
      }
    } catch (err: any) {
      setError('Failed to load business. Please try again.');
      toast.error('Failed to load business: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    fetchBusiness();
  }, [fetchBusiness]);

  // Debounced input handlers
  const debouncedSetName = useCallback(
    debounce((value: string) => {
      setName(value);
      setFormErrors((prev) => ({ ...prev, name: value.trim() ? '' : 'Business name is required' }));
    }, 300),
    []
  );

  const debouncedSetDescription = useCallback(
    debounce((value: string) => {
      setDescription(value);
      setFormErrors((prev) => ({ ...prev, description: value.trim() ? '' : 'Description is required' }));
    }, 300),
    []
  );

  const debouncedSetNewProductName = useCallback(
    debounce((value: string) => {
      setNewProduct((prev) => ({ ...prev, name: value }));
      setFormErrors((prev) => ({ ...prev, productName: value.trim() ? '' : 'Product name is required' }));
    }, 300),
    []
  );

  const debouncedSetNewProductDescription = useCallback(
    debounce((value: string) => {
      setNewProduct((prev) => ({ ...prev, description: value }));
      setFormErrors((prev) => ({ ...prev, productDescription: value.trim() ? '' : 'Product description is required' }));
    }, 300),
    []
  );

  const validateBusinessForm = () => {
    const errors = { ...formErrors };
    let isValid = true;

    if (!name.trim()) {
      errors.name = 'Business name is required';
      isValid = false;
    }
    if (!category) {
      errors.category = 'Category is required';
      isValid = false;
    }
    if (!description.trim()) {
      errors.description = 'Description is required';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const validateProductForm = () => {
    const errors = { ...formErrors };
    let isValid = true;

    if (!newProduct.name.trim()) {
      errors.productName = 'Product name is required';
      isValid = false;
    }
    if (!newProduct.description.trim()) {
      errors.productDescription = 'Product description is required';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSaveBusiness = async () => {
    if (!currentUser) return;

    if (!validateBusinessForm()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const businessData = {
        name,
        category,
        description,
        ownerId: currentUser.uid,
        products,
      };
      if (businessId) {
        await updateDoc(doc(db, 'businesses', businessId), businessData);
        toast.success('Business updated!');
      } else {
        const docRef = await addDoc(collection(db, 'businesses'), businessData);
        setBusinessId(docRef.id);
        toast.success('Business created!');
      }
      navigate('/business-profile');
    } catch (err: any) {
      toast.error('Failed to save business: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!validateProductForm()) {
      toast.error('Please fill in all required product fields.');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = newProduct.imageUrl;
      if (newProduct.file) {
        // Upload image to Cloudinary
        imageUrl = await uploadImageToCloudinary(newProduct.file);
      }
      const updatedProduct = { ...newProduct, imageUrl, file: undefined };
      const updatedProducts = [...products, updatedProduct];
      setProducts(updatedProducts);
      setNewProduct({ name: '', description: '', inStock: true });
      if (businessId) {
        await updateDoc(doc(db, 'businesses', businessId), { products: updatedProducts });
      }
      toast.success('Product added!');
    } catch (err: any) {
      toast.error('Failed to add product: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (index: number) => {
    if (!businessId) return;
    const updatedProducts = products.filter((_, i) => i !== index);
    setProducts(updatedProducts);
    try {
      await updateDoc(doc(db, 'businesses', businessId), { products: updatedProducts });
      toast.success('Product deleted!');
    } catch (err: any) {
      toast.error('Failed to delete product: ' + err.message);
    }
  };

  const handleCancelAddProduct = () => {
    setNewProduct({ name: '', description: '', inStock: true });
    setFormErrors((prev) => ({ ...prev, productName: '', productDescription: '' }));
  };

  const handleFilterChange = (showInStockOnly: boolean) => {
    setFilter((prev) => ({ ...prev, showInStockOnly }));
  };

  const handleSortChange = (sortBy: 'name' | 'stock') => {
    setFilter((prev) => ({ ...prev, sortBy }));
  };

  const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
  const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

  // Memoized product list with filtering and sorting
  const filteredProducts = useMemo(() => {
    let productList = [...products];

    // Apply filter
    if (filter.showInStockOnly) {
      productList = productList.filter((product) => product.inStock);
    }

    // Apply sorting
    if (filter.sortBy === 'name') {
      productList.sort((a, b) => a.name.localeCompare(b.name));
    } else if (filter.sortBy === 'stock') {
      productList.sort((a, b) => (a.inStock === b.inStock ? 0 : a.inStock ? -1 : 1));
    }

    return productList;
  }, [products, filter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="w-full max-w-4xl p-4 space-y-4">
          <div className="h-8 bg-gray-700 rounded w-3/5 mx-auto animate-pulse"></div>
          <div className="h-24 bg-gray-700 rounded animate-pulse"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="h-48 bg-gray-700 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-4xl mx-auto bg-gray-800 rounded-xl shadow-2xl overflow-hidden"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        {/* Hero Section */}
        <div className="relative h-48">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-yellow-300 opacity-80"></div>
          <h1 className="absolute bottom-4 left-6 text-3xl font-bold text-white">
            {businessId ? 'Manage Your Business' : 'Create a Business'}
          </h1>
        </div>

        {/* Business Form */}
        <motion.div className="p-6 space-y-6" variants={fadeIn}>
          <div>
            <label htmlFor="nameInput" className="block text-sm text-gray-400 mb-1">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              id="nameInput"
              value={name}
              onChange={(e) => debouncedSetName(e.target.value)}
              className={`w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.name ? 'border-red-500 border' : ''}`}
              placeholder="Enter business name"
              disabled={loading}
              aria-invalid={formErrors.name ? "true" : "false"}
              aria-describedby={formErrors.name ? 'name-error' : undefined}
            />
            {formErrors.name && (
              <p id="name-error" className="text-red-500 text-sm mt-1">
                {formErrors.name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="categorySelect" className="block text-sm text-gray-400 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="categorySelect"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as Category);
                setFormErrors((prev) => ({ ...prev, category: e.target.value ? '' : 'Category is required' }));
              }}
              className={`w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.category ? 'border-red-500 border' : ''}`}
              disabled={loading}
              aria-invalid={formErrors.category ? "true" : "false"}
              aria-describedby={formErrors.category ? 'category-error' : undefined}
            >
              <option value="">Select a category</option>
              <option value="Refreshments">Refreshments</option>
              <option value="Catering/Food">Catering/Food</option>
              <option value="Venue Provider">Venue Provider</option>
            </select>
            {formErrors.category && (
              <p id="category-error" className="text-red-500 text-sm mt-1">
                {formErrors.category}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="descriptionTextarea" className="block text-sm text-gray-400 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="descriptionTextarea"
              value={description}
              onChange={(e) => debouncedSetDescription(e.target.value)}
              className={`w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.description ? 'border-red-500 border' : ''}`}
              rows={4}
              placeholder="Describe your business"
              disabled={loading}
              aria-invalid={formErrors.description ? "true" : "false"}
              aria-describedby={formErrors.description ? 'description-error' : undefined}
            />
            {formErrors.description && (
              <p id="description-error" className="text-red-500 text-sm mt-1">
                {formErrors.description}
              </p>
            )}
          </div>
          <button
            onClick={handleSaveBusiness}
            className="w-full p-3 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 flex items-center justify-center disabled:opacity-50 transition-colors"
            disabled={loading}
            aria-label={businessId ? 'Update Business' : 'Create Business'}
          >
            <FaSave className="mr-2" />
            {businessId ? 'Update Business' : 'Create Business'}
          </button>
        </motion.div>

        {/* Products Section */}
        <motion.div className="p-6" variants={fadeIn}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <h2 className="text-xl font-semibold text-yellow-400">Products</h2>
            <div className="flex gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFilterChange(!filter.showInStockOnly)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full ${filter.showInStockOnly ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-200'} hover:bg-yellow-400 transition-colors`}
                  aria-label={filter.showInStockOnly ? 'Show All Products' : 'Show In-Stock Only'}
                >
                  <FaFilter size={16} />
                  {filter.showInStockOnly ? 'All' : 'In Stock'}
                </button>
                <select
                  value={filter.sortBy}
                  onChange={(e) => handleSortChange(e.target.value as 'name' | 'stock')}
                  className="p-1 bg-gray-700 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  aria-label="Sort Products"
                >
                  <option value="name">Sort by Name</option>
                  <option value="stock">Sort by Stock</option>
                </select>
              </div>
            </div>
          </div>
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {filteredProducts.map((product, idx) => (
                <motion.div
                  key={idx}
                  className="bg-gray-700 p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow relative"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {product.imageUrl ? (
                    <LazyImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded mb-3"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-600 rounded mb-3 flex items-center justify-center">
                      <span className="text-gray-400">No Image</span>
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-yellow-400">{product.name}</h3>
                  <p className="text-gray-400 text-sm line-clamp-2">{product.description}</p>
                  <p className="text-sm mt-2 flex items-center gap-1">
                    {product.inStock ? (
                      <FaCheckCircle className="text-green-500" />
                    ) : (
                      <FaTimesCircle className="text-red-500" />
                    )}
                    <span className="text-gray-400">
                      {product.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </p>
                  <button
                    onClick={() => handleDeleteProduct(idx)}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-400 transition-colors"
                    aria-label={`Delete ${product.name}`}
                    disabled={loading}
                  >
                    <FaTrash size={16} />
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-6">No products added yet.</p>
          )}

          {/* Add New Product Form */}
          <h3 className="text-lg font-semibold text-yellow-400 mt-6 mb-4">Add New Product</h3>
          <div className="space-y-4 bg-gray-700 p-4 rounded-lg">
            <div>
              <label htmlFor="productNameInput" className="block text-sm text-gray-400 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                id="productNameInput"
                value={newProduct.name}
                onChange={(e) => debouncedSetNewProductName(e.target.value)}
                className={`w-full p-3 rounded bg-gray-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.productName ? 'border-red-500 border' : ''}`}
                placeholder="Enter product name"
                disabled={loading}
                aria-invalid={formErrors.productName ? "true" : "false"}
                aria-describedby={formErrors.productName ? 'product-name-error' : undefined}
              />
              {formErrors.productName && (
                <p id="product-name-error" className="text-red-500 text-sm mt-1">
                  {formErrors.productName}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="productDescriptionTextarea" className="block text-sm text-gray-400 mb-1">
                Product Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="productDescriptionTextarea"
                value={newProduct.description}
                onChange={(e) => debouncedSetNewProductDescription(e.target.value)}
                className={`w-full p-3 rounded bg-gray-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.productDescription ? 'border-red-500 border' : ''}`}
                rows={2}
                placeholder="Describe the product"
                disabled={loading}
                aria-invalid={formErrors.productDescription ? "true" : "false"}
                aria-describedby={formErrors.productDescription ? 'product-description-error' : undefined}
              />
              {formErrors.productDescription && (
                <p id="product-description-error" className="text-red-500 text-sm mt-1">
                  {formErrors.productDescription}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="productImageInput" className="block text-sm text-gray-400 mb-1">
                Product Image
              </label>
              <input
                id="productImageInput"
                type="file"
                accept="image/*"
                onChange={(e) => setNewProduct({ ...newProduct, file: e.target.files?.[0] || undefined })}
                className="w-full p-3 text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-yellow-400 file:text-gray-900"
                disabled={loading}
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={newProduct.inStock}
                onChange={(e) => setNewProduct({ ...newProduct, inStock: e.target.checked })}
                className="mr-2 accent-yellow-400"
                id="inStockCheckbox"
                disabled={loading}
              />
              <label htmlFor="inStockCheckbox" className="text-gray-400">
                In Stock
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAddProduct}
                className="flex-1 p-3 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center disabled:opacity-50 transition-colors"
                disabled={loading}
                aria-label="Add Product"
              >
                <FaPlus className="mr-2" />
                Add Product
              </button>
              <button
                onClick={handleCancelAddProduct}
                className="flex-1 p-3 bg-red-500 text-white rounded hover:bg-red-600 flex items-center justify-center disabled:opacity-50 transition-colors"
                disabled={loading}
                aria-label="Cancel Adding Product"
              >
                <FaTimes className="mr-2" />
                Cancel
              </button>
            </div>
          </div>
        </motion.div>

        {/* Error State with Retry */}
        {error && (
          <motion.div className="m-6 p-4 bg-red-500 text-white rounded-lg flex justify-center items-center gap-3" variants={fadeIn}>
            <p>{error}</p>
            <button
              onClick={fetchBusiness}
              className="flex items-center gap-2 px-4 py-2 bg-white text-red-500 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Retry loading business data"
            >
              <FaRedo size={16} /> Retry
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default Business;