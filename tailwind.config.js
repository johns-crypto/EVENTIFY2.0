/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary-navy': '#1A2A44',
        'secondary-deepRed': '#8B1E3F',
        'secondary-darkRed': '#6B152F',
        'accent-gold': '#D4AF37',
        'neutral-darkGray': '#4A4A4A',
        'neutral-lightGray': '#D3D3D3',
        'neutral-offWhite': '#F5F5F5',
      },
    },
  },
  plugins: [],
};