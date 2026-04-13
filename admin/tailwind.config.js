/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FFC107',
        'primary-dark': '#E6AC00',
        accent: '#2196F3',
        'bg-deep': '#0F1320',
        'bg-primary': '#1A1F2E',
        'bg-card': '#232A3B',
        surface: '#2C3E50',
        'text-primary': '#F5F5F5',
        'text-secondary': '#94A3B8',
        success: '#4CAF50',
        error: '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
