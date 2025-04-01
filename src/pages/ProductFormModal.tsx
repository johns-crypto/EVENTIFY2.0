// src/pages/ProductFormModal.tsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, updateDoc, doc } from '../services/firebase';
import { motion } from 'framer-motion';
import { FaBox, FaImage, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { uploadImageToCloudinary } from '../utils/cloudinary';

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

interface FormErrors {
  productName?: string;
  productDescription?: string;
  category?: string;
}

interface ProductFormModalProps {
  business: Business;
  product: Product | null;
  onClose: () => void;
  onSave: (product: Product) => void;
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

function ProductFormModal({ business, product, onClose, onSave }: ProductFormModalProps) {
  const { userRole } = useAuth();
  const [productForm, setProductForm] = useState<Product>(
    product || { name: '', description: '', imageUrl: '', inStock: true, category: 'Food' }
  );
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [imageUploading, setImageUploading] = useState(false);
  const categoryOptions = ['Food', 'Refreshments', 'Venue'];

  const validateProductForm = () => {
    const errors: FormErrors = {};
    if (!productForm.name.trim()) errors.productName = 'Product name is required.';
    if (!productForm.description.trim())
      errors.productDescription = 'Product description is required.';
    if (!productForm.category) errors.category = 'Please select a category.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageUploading(true);
      try {
        const imageUrl = await uploadImageToCloudinary(file);
        setProductForm((prev) => ({ ...prev, imageUrl, file }));
        toast.success('Product image uploaded successfully!');
      } catch (error) {
        toast.error('Failed to upload product image: ' + (error as Error).message);
      } finally {
        setImageUploading(false);
      }
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProductForm()) return;
    if (userRole !== 'serviceProvider') {
      toast.error('You must be a registered service provider to add a product.');
      return;
    }

    try {
      let productImageUrl = productForm.imageUrl || ''; // Default to empty string if undefined
      if (productForm.file) {
        productImageUrl = await uploadImageToCloudinary(productForm.file);
      }

      // Create updatedProduct without the file property and ensure no undefined values
      const updatedProduct: Product = {
        name: productForm.name,
        description: productForm.description,
        imageUrl: productImageUrl,
        inStock: productForm.inStock,
        category: productForm.category || 'Food', // Ensure category is always defined
      };

      const businessRef = doc(db, 'businesses', business.id);
      const updatedProducts = product
        ? business.products.map((p) => (p === product ? updatedProduct : p))
        : [...business.products, updatedProduct];
      await updateDoc(businessRef, { products: updatedProducts });

      onSave(updatedProduct);
      toast.success('Product saved successfully!');
    } catch (error) {
      toast.error('Failed to save product: ' + (error as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800/90 backdrop-blur-md rounded-2xl w-full max-w-md max-h-[90vh] my-4 overflow-y-auto p-6 sm:p-8 relative border border-gray-700/30 shadow-2xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded-full p-1"
          aria-label="Close modal"
        >
          <FaTimes size={20} />
        </button>

        {/* Modal Header */}
        <h3 className="text-xl sm:text-2xl font-bold text-yellow-400 mb-6 tracking-tight">
          {product ? 'Edit Product' : 'Add Product'}
        </h3>

        {/* Form */}
        <form onSubmit={handleAddProduct} className="space-y-6">
          {/* Product Name */}
          <div>
            <label htmlFor="productNameInput" className="block text-sm font-medium text-gray-300 mb-2">
              Product Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FaBox className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="productNameInput"
                value={productForm.name}
                onChange={(e) => {
                  setProductForm((prev) => ({ ...prev, name: e.target.value }));
                  setFormErrors((prev) => ({ ...prev, productName: undefined }));
                }}
                className={`w-full pl-12 pr-4 py-3 rounded-lg bg-gray-700/50 text-gray-200 border ${
                  formErrors.productName ? 'border-red-500' : 'border-gray-600/50'
                } focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 text-sm sm:text-base`}
                placeholder="Enter product name"
                aria-describedby={formErrors.productName ? 'productName-error' : undefined}
                autoFocus
              />
            </div>
            {formErrors.productName && (
              <p id="productName-error" className="mt-2 text-xs text-red-500">
                {formErrors.productName}
              </p>
            )}
          </div>

          {/* Product Description */}
          <div>
            <label htmlFor="productDescriptionTextarea" className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="productDescriptionTextarea"
              value={productForm.description}
              onChange={(e) => {
                setProductForm((prev) => ({ ...prev, description: e.target.value }));
                setFormErrors((prev) => ({ ...prev, productDescription: undefined }));
              }}
              className={`w-full p-3 rounded-lg bg-gray-700/50 text-gray-200 border ${
                formErrors.productDescription ? 'border-red-500' : 'border-gray-600/50'
              } focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 transition-all duration-300 text-sm sm:text-base resize-none`}
              rows={4}
              placeholder="Describe the product"
              aria-describedby={formErrors.productDescription ? 'productDescription-error' : undefined}
            />
            {formErrors.productDescription && (
              <p id="productDescription-error" className="mt-2 text-xs text-red-500">
                {formErrors.productDescription}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="categorySelect" className="block text-sm font-medium text-gray-300 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="categorySelect"
              value={productForm.category}
              onChange={(e) => {
                setProductForm((prev) => ({ ...prev, category: e.target.value }));
                setFormErrors((prev) => ({ ...prev, category: undefined }));
              }}
              className={`w-full px-4 py-3 rounded-lg bg-gray-700/50 text-gray-200 border ${
                formErrors.category ? 'border-red-500' : 'border-gray-600/50'
              } focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all duration-300 text-sm sm:text-base appearance-none cursor-pointer`}
              aria-describedby={formErrors.category ? 'category-error' : undefined}
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {formErrors.category && (
              <p id="category-error" className="mt-2 text-xs text-red-500">
                {formErrors.category}
              </p>
            )}
          </div>

          {/* In Stock Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">In Stock</label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={productForm.inStock}
                onChange={(e) => setProductForm((prev) => ({ ...prev, inStock: e.target.checked }))}
                className="mr-3 accent-yellow-400 h-5 w-5 rounded focus:ring-2 focus:ring-yellow-400"
              />
              <span className="text-gray-300 text-sm sm:text-base">Available in stock</span>
            </label>
          </div>

          {/* Product Image */}
          <div>
            <label htmlFor="productImageInput" className="block text-sm font-medium text-gray-300 mb-2">
              Product Image (Optional)
            </label>
            <div className="relative">
              <FaImage className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="productImageInput"
                type="file"
                accept="image/*"
                onChange={handleProductImageUpload}
                className="w-full pl-12 pr-3 py-2 text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-400 file:text-gray-900 hover:file:bg-yellow-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                disabled={imageUploading}
              />
              {imageUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-700/80 rounded-lg">
                  <svg
                    className="animate-spin h-6 w-6 text-yellow-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
            </div>
            {productForm.imageUrl && !imageUploading && (
              <div className="mt-4 flex justify-center">
                <LazyImage
                  src={productForm.imageUrl}
                  alt="Product Preview"
                  className="w-24 h-24 rounded-lg object-cover border-2 border-gray-600 shadow-md"
                />
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <button
              type="submit"
              className="w-full px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 rounded-full hover:from-yellow-300 hover:to-yellow-400 transition-all font-semibold shadow-md hover:shadow-lg text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={imageUploading}
            >
              {product ? 'Update Product' : 'Add Product'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-6 py-3 bg-gray-600/50 text-gray-200 rounded-full hover:bg-gray-500/50 transition-all font-semibold shadow-md hover:shadow-lg text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={imageUploading}
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default ProductFormModal;