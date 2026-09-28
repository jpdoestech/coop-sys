/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18211d",
        paper: "#f7f4ee",
        line: "#d8d0c2",
        moss: "#4f6f52",
        clay: "#a15d45",
        signal: "#e5b84b"
      },
      fontFamily: {
        sans: ["Aptos", "Segoe UI", "system-ui", "sans-serif"],
        display: ["Georgia", "Cambria", "serif"]
      },
      boxShadow: {
        panel: "0 18px 60px rgba(24, 33, 29, 0.10)"
      }
    }
  },
  plugins: []
};
