/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ember: '#cf5c36',
        saffron: '#f0b45d',
        ink: '#110f10',
        smoke: '#1d1816',
        clay: '#2f2623',
        sand: '#f4ecdf',
        mist: '#cbb9ae',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        display: ['Cormorant Garamond', 'serif'],
      },
      boxShadow: {
        glow: '0 30px 70px rgba(8, 6, 5, 0.45)',
      },
      backgroundImage: {
        'hero-overlay': "linear-gradient(120deg, rgba(17, 15, 16, 0.94), rgba(17, 15, 16, 0.48))",
        'section-fade': "linear-gradient(180deg, rgba(240, 180, 93, 0.08), rgba(17, 15, 16, 0))",
      },
    },
  },
  plugins: [],
}