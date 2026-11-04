/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nik: {
          bg: '#090d16',
          card: '#0f172a',
          border: '#1e293b',
          accent: '#38bdf8',
          red: '#ef4444',
          orange: '#f97316',
          yellow: '#eab308',
          green: '#22c55e',
          purple: '#a855f7'
        }
      }
    },
  },
  plugins: [],
}

