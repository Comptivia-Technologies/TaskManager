/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
        mono: ['Cascadia Code', 'Consolas', 'Courier New', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#434E78',
          50: 'rgba(67, 78, 120, 0.1)',
          100: 'rgba(67, 78, 120, 0.2)',
          200: 'rgba(67, 78, 120, 0.3)',
          300: 'rgba(67, 78, 120, 0.4)',
          400: 'rgba(67, 78, 120, 0.5)',
          500: 'rgba(67, 78, 120, 0.6)',
          600: 'rgba(67, 78, 120, 0.7)',
          700: 'rgba(67, 78, 120, 0.8)',
          800: 'rgba(67, 78, 120, 0.9)',
          900: '#434E78',
          dark: 'rgb(40, 47, 70)',
          light: 'rgb(52, 61, 94)',
        },
        text: {
          DEFAULT: '#434E78',
          dark: 'rgba(67, 78, 120, 0.8)',
          light: 'rgba(67, 78, 120, 0.6)',
          muted: 'rgba(67, 78, 120, 0.4)',
        },
      },
      boxShadow: {
        'azure-sm': '0 1.6px 3.6px 0 rgba(0, 0, 0, 0.132), 0 0.3px 0.9px 0 rgba(0, 0, 0, 0.108)',
        'azure-md': '0 3.2px 7.2px 0 rgba(0, 0, 0, 0.132), 0 0.6px 1.8px 0 rgba(0, 0, 0, 0.108)',
        'azure-lg': '0 6.4px 14.4px 0 rgba(0, 0, 0, 0.132), 0 1.2px 3.6px 0 rgba(0, 0, 0, 0.108)',
        'azure-xl': '0 12.8px 28.8px 0 rgba(0, 0, 0, 0.132), 0 2.4px 7.2px 0 rgba(0, 0, 0, 0.108)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'azure': '2px',
        'azure-sm': '4px',
      },
    },
  },
  plugins: [],
}



