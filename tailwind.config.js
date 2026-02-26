/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        'deep-blue': '#1A2B4D',
        'medium-blue': '#2E5C9E',
        'gold': '#C8A84B',
        'gold-hover': '#B8983B',
        'pale-blue': '#EEF2F8',
        'dark-text': '#1A1A2E',
        'mid-gray': '#555555',
        'page-bg': '#F8F9FB',
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
        opensans: ['Open Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
