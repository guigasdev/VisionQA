/********************/
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f9ff',
          100: '#eaf2ff',
          200: '#d6e5ff',
          300: '#b9d0ff',
          400: '#8bb2ff',
          500: '#5f94ff',
          600: '#3b74f6',
          700: '#2d5cd9',
          800: '#2449ad',
          900: '#203f8f',
        }
      }
    },
  },
  plugins: [],
} 