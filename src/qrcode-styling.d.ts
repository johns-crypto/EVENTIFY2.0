// src/qrcode-styling.d.ts
declare module 'qrcode-styling' {
    interface QRCodeStylingOptions {
      width?: number;
      height?: number;
      type?: 'svg' | 'canvas';
      data: string;
      image?: string;
      margin?: number;
      qrOptions?: {
        typeNumber?: number;
        mode?: 'Numeric' | 'Alphanumeric' | 'Byte' | 'Kanji';
        errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
      };
      imageOptions?: {
        hideBackgroundDots?: boolean;
        imageSize?: number;
        margin?: number;
      };
      dotsOptions?: {
        color?: string;
        type?: 'rounded' | 'dots' | 'classy' | 'classy-rounded' | 'square';
      };
      backgroundOptions?: {
        color?: string;
      };
      cornersSquareOptions?: {
        color?: string;
        type?: 'square' | 'extra-rounded';
      };
      cornersDotOptions?: {
        color?: string;
        type?: 'dot' | 'square';
      };
    }
  
    class QRCodeStyling {
      constructor(options: QRCodeStylingOptions);
      append(container: HTMLElement): void;
      update(options?: Partial<QRCodeStylingOptions>): void;
    }
  
    export default QRCodeStyling;
  }