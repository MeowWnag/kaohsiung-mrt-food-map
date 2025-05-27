// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // 掃描 src 目錄下所有 JS, JSX, TS, TSX 檔案
    "./public/index.html",       // 也掃描 public/index.html (以防萬一)
  ],
  theme: {
    extend: {}, // 你可以在這裡擴展 Tailwind 的預設主題
  },
  plugins: [],
};