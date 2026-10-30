/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./gallery.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        green: {
          DEFAULT: 'var(--green)',
          dark: 'var(--green-dark)',
        },
        orange: 'var(--orange)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        display: ['"Manrope"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      boxShadow: {
        custom: 'var(--shadow)',
      },
    },
  },
  plugins: [],
};
