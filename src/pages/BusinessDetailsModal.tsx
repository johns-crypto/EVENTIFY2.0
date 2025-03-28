// src/pages/BusinessDetailsModal.tsx
import { motion } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { useState, useEffect, useRef } from 'react';

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

interface LazyImageProps {
  src: string | undefined; // Allow undefined
  alt: string;
  className: string;
  fallbackSrc?: string; // Optional fallback image
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  fallbackSrc = '/path/to/fallback-image.jpg', // Provide a default fallback image
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Fallback to immediate load if IntersectionObserver is not supported
    if (!('IntersectionObserver' in window)) {
      setIsLoaded(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, []);

  const handleError = () => {
    setHasError(true);
  };

  // Use fallbackSrc if src is undefined or if there's an error
  const imageSrc = hasError || !src || !isLoaded ? fallbackSrc : src;

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`${className} ${isLoaded && !hasError ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      onLoad={() => setIsLoaded(true)}
      onError={handleError}
      loading="lazy"
    />
  );
};

interface BusinessDetailsModalProps {
  business: Business;
  onClose: () => void;
  onViewFullProfile: () => void;
}

function BusinessDetailsModal({ business, onClose, onViewFullProfile }: BusinessDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800/90 backdrop-blur-md rounded-2xl max-w-lg w-full p-4 sm:p-6 lg:p-8 relative border border-gray-700/30 shadow-2xl max-h-[80vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Close modal"
        >
          <FaTimes size={20} />
        </button>
        <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-yellow-400 mb-6">
          {business.name} Details
        </h3>
        <div className="space-y-4">
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
          <div>
            <h4 className="text-base sm:text-lg font-semibold text-yellow-400 mb-2">Products Offered</h4>
            {business.products.length > 0 ? (
              <ul className="space-y-3">
                {business.products.map((product, index) => (
                  <li key={index} className="bg-gray-700/50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      {product.imageUrl && (
                        <LazyImage
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg"
                          fallbackSrc="/path/to/fallback-image.jpg" // Ensure this path is correct
                        />
                      )}
                      <div>
                        <p className="text-gray-200 font-medium text-sm sm:text-base">{product.name}</p>
                        <p className="text-gray-400 text-xs sm:text-sm line-clamp-2">{product.description}</p>
                        {product.category && (
                          <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold text-gray-200 bg-gray-500/50 rounded-full">
                            {product.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm sm:text-base">No products available.</p>
            )}
          </div>
          <button
            onClick={onViewFullProfile}
            className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-500 hover:to-blue-600 transition-all shadow-sm hover:shadow-md text-sm sm:text-base"
          >
            View Full Profile
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default BusinessDetailsModal;