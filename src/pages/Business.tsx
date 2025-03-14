import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage, getBusinesses } from '../services/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion } from 'framer-motion';
import { FaSave, FaPlus, FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

type Category = 'Refreshments' | 'Catering/Food' | 'Venue Provider';

interface Product {
  name: string;
  description: string;
  imageUrl?: string;
  inStock: boolean;
  file?: File; // For new products being added
}

function Business() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<Category>('Refreshments'); // Default to a valid Category
  const [description, setDescription] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [newProduct, setNewProduct] = useState<Product>({
    name: '',
    description: '',
    inStock: true,
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    setLoading(true);
    getBusinesses()
      .then((businesses) => {
        const userBusiness = businesses.find((b) => b.ownerId === currentUser.uid);
        if (userBusiness) {
          setBusinessId(userBusiness.id);
          setName(userBusiness.name);
          setCategory(userBusiness.category as Category); // Ensure it matches Category type
          setDescription(userBusiness.description);
          setProducts(userBusiness.products);
        }
      })
      .catch((err) => toast.error('Failed to load business: ' + err.message))
      .finally(() => setLoading(false));
  }, [currentUser, navigate]);

  const handleSaveBusiness = async () => {
    if (!currentUser || !name || !category) {
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
    if (!newProduct.name || !newProduct.description) {
      toast.error('Product name and description are required.');
      return;
    }
    setLoading(true);
    try {
      let imageUrl = newProduct.imageUrl;
      if (newProduct.file) {
        const storageRef = ref(storage, `products/${currentUser!.uid}/${Date.now()}_${newProduct.file.name}`);
        await uploadBytes(storageRef, newProduct.file);
        imageUrl = await getDownloadURL(storageRef);
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
        <h1 className="text-3xl font-bold text-accent-gold mb-6">
          {businessId ? 'Manage Your Business' : 'Create a Business'}
        </h1>

        <motion.div className="space-y-4 mb-6" variants={fadeIn}>
          <div>
            <label htmlFor="nameInput" className="block text-sm text-neutral-lightGray mb-1">
              Business Name
            </label>
            <input
              id="nameInput"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded bg-neutral-offWhite text-neutral-darkGray"
              placeholder="Enter business name"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="categorySelect" className="block text-sm text-neutral-lightGray mb-1">
              Category
            </label>
            <select
              id="categorySelect"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full p-3 rounded bg-neutral-offWhite text-neutral-darkGray"
              disabled={loading}
            >
              <option value="Refreshments">Refreshments</option>
              <option value="Catering/Food">Catering/Food</option>
              <option value="Venue Provider">Venue Provider</option>
            </select>
          </div>
          <div>
            <label htmlFor="descriptionTextarea" className="block text-sm text-neutral-lightGray mb-1">
              Description
            </label>
            <textarea
              id="descriptionTextarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded bg-neutral-offWhite text-neutral-darkGray"
              rows={4}
              placeholder="Describe your business"
              disabled={loading}
            />
          </div>
          <button
            onClick={handleSaveBusiness}
            className="w-full p-3 bg-accent-gold text-neutral-darkGray rounded hover:bg-yellow-600 flex items-center justify-center disabled:opacity-50"
            disabled={loading}
          >
            <FaSave className="mr-2" />
            {businessId ? 'Update Business' : 'Create Business'}
          </button>
        </motion.div>

        <motion.div className="space-y-4" variants={fadeIn}>
          <h2 className="text-xl font-semibold text-accent-gold mb-4">Products</h2>
          {products.map((product, index) => (
            <div
              key={index}
              className="bg-neutral-offWhite p-4 rounded-lg flex items-center justify-between"
            >
              <div>
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.name} className="w-20 h-20 object-cover rounded mr-4" />
                )}
                <div>
                  <h3 className="text-lg font-semibold text-accent-gold">{product.name}</h3>
                  <p className="text-neutral-darkGray">{product.description}</p>
                  <p className="text-sm text-neutral-darkGray">
                    {product.inStock ? 'In Stock' : 'Out of Stock'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteProduct(index)}
                className="text-red-500 hover:text-red-700"
                aria-label={`Delete ${product.name}`}
                disabled={loading}
              >
                <FaTrash size={20} />
              </button>
            </div>
          ))}

          <h3 className="text-lg font-semibold text-accent-gold mt-6">Add New Product</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="productNameInput" className="block text-sm text-neutral-lightGray mb-1">
                Product Name
              </label>
              <input
                id="productNameInput"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="w-full p-3 rounded bg-neutral-offWhite text-neutral-darkGray"
                placeholder="Enter product name"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="productDescriptionTextarea" className="block text-sm text-neutral-lightGray mb-1">
                Product Description
              </label>
              <textarea
                id="productDescriptionTextarea"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                className="w-full p-3 rounded bg-neutral-offWhite text-neutral-darkGray"
                rows={2}
                placeholder="Describe the product"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="productImageInput" className="block text-sm text-neutral-lightGray mb-1">
                Product Image
              </label>
              <input
                id="productImageInput"
                type="file"
                accept="image/*"
                onChange={(e) => setNewProduct({ ...newProduct, file: e.target.files?.[0] || undefined })}
                className="w-full p-3 text-neutral-darkGray"
                disabled={loading}
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={newProduct.inStock}
                onChange={(e) => setNewProduct({ ...newProduct, inStock: e.target.checked })}
                className="mr-2"
                id="inStockCheckbox"
                disabled={loading}
              />
              <label htmlFor="inStockCheckbox" className="text-neutral-lightGray">
                In Stock
              </label>
            </div>
            <button
              onClick={handleAddProduct}
              className="w-full p-3 bg-secondary-deepRed text-neutral-lightGray rounded hover:bg-secondary-darkRed flex items-center justify-center disabled:opacity-50"
              disabled={loading}
            >
              <FaPlus className="mr-2" />
              Add Product
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Business;