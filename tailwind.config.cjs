// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F0F9FF",
          100: "#E0F2FE",
          300: "#7DD3FC",
          500: "#0EA5E9",
          600: "#0284C7",
        },
      },
    },
  },
  plugins: [],
};
