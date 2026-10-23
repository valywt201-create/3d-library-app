/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        space: { 950: '#070812', 900: '#0d0f1c', 800: '#14172a' },
        nebula: { violet: '#8b5cf6', blue: '#3b82f6' },
      },
      fontFamily: {
        kufi: ["'Noto Kufi Arabic'", 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(139, 92, 246, 0.35)',
      },
    },
  },
  plugins: [],
}
