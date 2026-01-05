/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0f1419',
          900: '#1a1f2e',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
        },
        purple: {
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        blue: {
          500: '#3b82f6',
          600: '#2563eb',
        },
        cyan: {
          500: '#06b6d4',
        },
        yellow: {
          500: '#eab308',
        },
        green: {
          500: '#10b981',
        },
      },
    },
  },
  plugins: [],
}

