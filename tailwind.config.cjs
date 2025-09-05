/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,jsx,js}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0EA5E9", // xanh dương chủ đạo
        },
      },
    },
  },
  plugins: [],
};
