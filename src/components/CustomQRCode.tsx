// src/components/CustomQRCode.tsx
import { useEffect, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';

interface CustomQRCodeProps {
  value: string;
  imageUrl?: string;
  size?: number;
}

const CustomQRCode: React.FC<CustomQRCodeProps> = ({ value, imageUrl, size = 120 }) => {
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!qrRef.current) return;

    try {
      const qrCode = new QRCodeStyling({
        width: size,
        height: size,
        type: 'svg',
        data: value || 'https://example.com', // Fallback for empty value
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
          color: '#2b2d42',
          type: 'rounded',
        },
        backgroundOptions: {
          color: '#ffffff',
        },
        cornersSquareOptions: {
          color: '#d90429',
          type: 'extra-rounded',
        },
        cornersDotOptions: {
          color: '#ffd60a',
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

  return <div ref={qrRef} className="p-2 bg-white rounded-lg shadow-sm inline-block" />;
};

export default CustomQRCode;