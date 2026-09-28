/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        paper: "#f4f7f5",
        line: "#dfe6e1",
        moss: "#287353",
        clay: "#b25d3b",
        signal: "#dcae35"
      },
      fontFamily: {
        sans: ["Segoe UI Variable", "Aptos", "Segoe UI", "system-ui", "sans-serif"],
        display: ["Segoe UI Variable Display", "Aptos Display", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        panel: "0 1px 2px rgba(23, 33, 28, 0.04), 0 8px 24px rgba(23, 33, 28, 0.05)"
      }
    }
  },
  plugins: []
};
