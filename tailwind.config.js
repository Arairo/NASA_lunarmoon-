/** @type {import('tailwindcss').Config} */
// Only the main page (index.html) uses Tailwind; the Expert planner has its own CSS.
export default {
  content: ['./index.html', './src/main.js', './src/ui/**/*.js', './src/academy/**/*.js', './src/experience/**/*.js'],
  theme: { extend: {} },
  plugins: [],
};
