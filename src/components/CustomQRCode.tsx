// src/components/CustomQRCode.tsx
import { useEffect, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling'; // Ensure this package is installed

interface CustomQRCodeProps {
  value: string;
  imageUrl?: string;
  size?: number;
  ariaLabel?: string; // Optional accessibility label
}

const CustomQRCode: React.FC<CustomQRCodeProps> = ({ value, imageUrl, size = 120, ariaLabel = 'QR code' }) => {
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!qrRef.current) return;

    // Validate value prop
    if (!value || value.trim() === '') {
      console.warn('CustomQRCode: value prop is empty or invalid. Using fallback URL.');
      value = 'https://example.com'; // Fallback with warning
    }

    try {
      const qrCode = new QRCodeStyling({
        width: size,
        height: size,
        type: 'svg',
        data: value,
        image: imageUrl || undefined,
        margin: 5,
        qrOptions: {
          typeNumber: 0,
          mode: 'Byte',
          errorCorrectionLevel: 'H',
        },
        imageOptions: {
          hideBackgroundDots: true,
          imageSize: 0.3,
          margin: 5,
        },
        dotsOptions: {
          color: '#2b2d42', // Matches your neutral-darkGray theme
          type: 'rounded',
        },
        backgroundOptions: {
          color: '#ffffff',
        },
        cornersSquareOptions: {
          color: '#d90429', // Matches secondary-deepRed
          type: 'extra-rounded',
        },
        cornersDotOptions: {
          color: '#ffd60a', // Matches accent-gold
          type: 'dot',
        },
      });

      qrRef.current.innerHTML = '';
      qrCode.append(qrRef.current);
    } catch (error) {
      console.error('QRCodeStyling Error:', error);
      qrRef.current.innerHTML = 'Failed to generate QR code';
    }

    return () => {
      if (qrRef.current) qrRef.current.innerHTML = '';
    };
  }, [value, imageUrl, size]);

  return (
    <div ref={qrRef} className="p-2 bg-white rounded-lg shadow-sm inline-block" role="img" aria-label={ariaLabel}>
      {/* Fallback content for screen readers */}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
};

export default CustomQRCode;