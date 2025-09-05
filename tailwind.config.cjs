// tailwind.config.cjs
/* eslint-disable @typescript-eslint/no-var-requires */
const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  safelist: [
    // Phòng trường hợp có build-time treeshake mạnh tay
    { pattern: /^(bg|text|border|from|to|via)-brand-(50|100|200|300|400|500|600|700|800|900)$/ },
  ],
  theme: {
    extend: {
      colors: {
        // Alias "brand" → dùng trọn palette sky của Tailwind
        brand: colors.sky,
        // "primary" để dùng class không có số: bg-primary, text-primary
        primary: { DEFAULT: "#0EA5E9" },
      },
    },
  },
  plugins: [],
};
