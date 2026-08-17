/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        'primary-light': '#EFF6FF',
        background: '#F8FAFC',
        'sidebar-bg': '#FFFFFF',
        'card-bg': '#FFFFFF',
        'text-main': '#0F172A',
        'text-muted': '#64748B',
        border: '#E2E8F0',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        purple: '#8B5CF6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fuelFlow: {
          '0%':   { transform: 'translateX(0)', opacity: '0' },
          '15%':  { opacity: '1' },
          '85%':  { opacity: '1' },
          '100%': { transform: 'translateX(96px)', opacity: '0' },
        },
      },
      animation: {
        'fuel-flow': 'fuelFlow 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
