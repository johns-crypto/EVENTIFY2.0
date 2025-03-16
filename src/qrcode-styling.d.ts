// src/types/qrcode-styling.d.ts
declare module 'qr-code-styling' {
  interface QRCodeStylingOptions {
    width?: number;
    height?: number;
    type?: 'svg' | 'canvas' | 'img'; // Added 'img' for completeness
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
      type?: 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded' | 'square-rotate';
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
    getRawData(format?: 'SVG' | 'PNG'): Promise<string>; // Optional: Add if needed
    download(fileExtension?: 'svg' | 'png', fileName?: string): void; // Optional: Add if needed
    toDataURL(format?: 'SVG' | 'PNG'): Promise<string>; // Optional: Add if needed
  }

  export default QRCodeStyling;
}