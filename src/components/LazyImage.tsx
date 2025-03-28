// src/components/LazyImage.tsx
import React from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}

const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className, fallbackSrc }) => {
  const [imageSrc, setImageSrc] = React.useState<string>(src);

  const handleError = () => {
    if (fallbackSrc) {
      setImageSrc(fallbackSrc);
    }
  };

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={handleError}
      loading="lazy"
    />
  );
};

export default LazyImage;