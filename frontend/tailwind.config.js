/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        nik: {
          bg: '#05030a',
          bgDarker: '#030206',
          card: '#090414',
          border: 'rgba(168, 85, 247, 0.35)',
          purple: '#a855f7',
          violet: '#7c3aed',
          magenta: '#d946ef',
          glow: '#c084fc',
          accent: '#38bdf8',
          red: '#ef4444',
          orange: '#f97316',
          yellow: '#eab308',
          green: '#22c55e',
        }
      }
    },
  },
  plugins: [],
}

