import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase'; // Adjust imports
import { useAuth } from '../context/AuthContext';
import { FaImage } from 'react-icons/fa'; // Fallback icon

type Category = 'Refreshments' | 'Catering/Food' | 'Venue Provider';

interface Product {
  name: string;
  description: string;
  imageUrl?: string;
  inStock: boolean;
}

interface Business {
  id: string;
  name: string;
  category: Category;
  description: string;
  ownerId: string;
  products: Product[];
}

function Business() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);
  const [newBusiness, setNewBusiness] = useState({
    name: '',
    category: 'Refreshments' as Category,
    description: '',
    products: [] as Product[],
  });
  const [newProduct, setNewProduct] = useState({ name: '', description: '', image: null as File | null, inStock: true });
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);

  // Fetch businesses from Firestore
  useEffect(() => {
    fetchBusinesses();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const category = params.get('category');
    if (category) {
      setFilteredBusinesses(businesses.filter((b) => b.category === category));
    } else {
      setFilteredBusinesses(businesses);
    }
  }, [location.search, businesses]);

  const fetchBusinesses = async () => {
    const businessCol = collection(db, 'businesses');
    const snapshot = await getDocs(businessCol);
    const businessData = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Business[];
    setBusinesses(businessData);
  };

  // Handle image upload and product addition
  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.image) return;
    const storageRef = ref(storage, `products/${newProduct.image.name}-${Date.now()}`);
    await uploadBytes(storageRef, newProduct.image);
    const imageUrl = await getDownloadURL(storageRef);
    setNewBusiness({
      ...newBusiness,
      products: [...newBusiness.products, { ...newProduct, imageUrl }],
    });
    setNewProduct({ name: '', description: '', image: null, inStock: true });
  };

  // Register a new business
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return alert('Please log in to register a business.');
    try {
      await addDoc(collection(db, 'businesses'), {
        ...newBusiness,
        ownerId: currentUser.uid,
      });
      setNewBusiness({ name: '', category: 'Refreshments', description: '', products: [] });
      fetchBusinesses();
    } catch (error) {
      console.error('Error registering business:', error);
    }
  };

  // Update an existing business
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusiness || !currentUser || editingBusiness.ownerId !== currentUser.uid) return;
    try {
      const businessRef = doc(db, 'businesses', editingBusiness.id);
      await updateDoc(businessRef, {
        name: editingBusiness.name,
        category: editingBusiness.category,
        description: editingBusiness.description,
        products: editingBusiness.products,
      });
      setEditingBusiness(null);
      fetchBusinesses();
    } catch (error) {
      console.error('Error updating business:', error);
    }
  };

  // Category color mapping
  const getCategoryColor = (category: Category) => {
    switch (category) {
      case 'Refreshments': return 'bg-refreshments-lightBlue';
      case 'Catering/Food': return 'bg-catering-orange';
      case 'Venue Provider': return 'bg-venue-green';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-darkGray text-neutral-lightGray">
      {/* Header */}
      <section className="bg-primary-navy p-6">
        <div className="container mx-auto">
          <h1 className="text-4xl font-bold">Business Directory</h1>
          <p className="text-lg mt-2">Explore and connect with our registered businesses.</p>
        </div>
      </section>

      {/* Business List */}
      <section className="container mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">Registered Businesses</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBusinesses.map((business) => (
            <div key={business.id} className="bg-neutral-offWhite text-neutral-darkGray p-4 rounded shadow">
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
                >
                  Edit
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Register Business Form */}
      {currentUser && (
        <section className="container mx-auto p-6">
          <h2 className="text-2xl font-bold mb-4">Register Your Business</h2>
          <form onSubmit={handleRegister} className="space-y-4 max-w-md">
            <label htmlFor="business-name" className="block text-sm font-medium text-neutral-lightGray">Business Name</label>
            <input
              id="business-name"
              type="text"
              value={newBusiness.name}
              onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })}
              placeholder="Business Name"
              className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
              required
            />
            <label htmlFor="business-category" className="block text-sm font-medium text-neutral-lightGray">Category</label>
            <select
              id="business-category"
              value={newBusiness.category}
              onChange={(e) => setNewBusiness({ ...newBusiness, category: e.target.value as Category })}
              className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
            >
              <option value="Refreshments">Refreshments</option>
              <option value="Catering/Food">Catering/Food</option>
              <option value="Venue Provider">Venue Provider</option>
            </select>
            <label htmlFor="business-description" className="block text-sm font-medium text-neutral-lightGray">Description</label>
            <textarea
              id="business-description"
              value={newBusiness.description}
              onChange={(e) => setNewBusiness({ ...newBusiness, description: e.target.value })}
              placeholder="Description"
              className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
              rows={3}
            />
            {/* Product Input */}
            <div className="space-y-2">
              <label htmlFor="product-name" className="block text-sm font-medium text-neutral-lightGray">Product Name</label>
              <input
                id="product-name"
                type="text"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="Product Name"
                className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
              />
              <label htmlFor="product-description" className="block text-sm font-medium text-neutral-lightGray">Product Description</label>
              <textarea
                id="product-description"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                placeholder="Product Description"
                className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
                rows={2}
              />
              <label htmlFor="product-image" className="block text-sm font-medium text-neutral-lightGray">Product Image</label>
              <input
                id="product-image"
                type="file"
                accept="image/*"
                onChange={(e) => setNewProduct({ ...newProduct, image: e.target.files?.[0] || null })}
                className="w-full p-2"
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
              >
                Add Product
              </button>
            </div>
            <button
              type="submit"
              className="w-full bg-secondary-deepRed text-neutral-lightGray p-2 rounded hover:bg-secondary-darkRed"
            >
              Register
            </button>
          </form>
        </section>
      )}

      {/* Edit Business Form */}
      {editingBusiness && currentUser && editingBusiness.ownerId === currentUser.uid && (
        <section className="container mx-auto p-6">
          <h2 className="text-2xl font-bold mb-4">Edit Business</h2>
          <form onSubmit={handleUpdate} className="space-y-4 max-w-md">
            <label htmlFor="edit-business-name" className="block text-sm font-medium text-neutral-lightGray">Business Name</label>
            <input
              id="edit-business-name"
              type="text"
              value={editingBusiness.name}
              onChange={(e) => setEditingBusiness({ ...editingBusiness, name: e.target.value })}
              placeholder="Business Name"
              className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
              required
            />
            <label htmlFor="edit-business-category" className="block text-sm font-medium text-neutral-lightGray">Category</label>
            <select
              id="edit-business-category"
              value={editingBusiness.category}
              onChange={(e) => setEditingBusiness({ ...editingBusiness, category: e.target.value as Category })}
              className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
            >
              <option value="Refreshments">Refreshments</option>
              <option value="Catering/Food">Catering/Food</option>
              <option value="Venue Provider">Venue Provider</option>
            </select>
            <label htmlFor="edit-business-description" className="block text-sm font-medium text-neutral-lightGray">Description</label>
            <textarea
              id="edit-business-description"
              value={editingBusiness.description}
              onChange={(e) => setEditingBusiness({ ...editingBusiness, description: e.target.value })}
              placeholder="Description"
              className="w-full p-2 rounded bg-neutral-offWhite text-neutral-darkGray"
              rows={3}
            />
            {/* Edit Products */}
            <div className="space-y-2">
              {editingBusiness.products.map((product, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <img src={product.imageUrl} alt={product.name} className="w-12 h-12 object-cover rounded" />
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
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="w-full bg-secondary-deepRed text-neutral-lightGray p-2 rounded hover:bg-secondary-darkRed"
            >
              Update
            </button>
            <button
              type="button"
              className="w-full bg-gray-500 text-neutral-lightGray p-2 rounded hover:bg-gray-600"
              onClick={() => setEditingBusiness(null)}
            >
              Cancel
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

export default Business;