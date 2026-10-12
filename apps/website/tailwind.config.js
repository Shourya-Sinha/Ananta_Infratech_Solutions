/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF3FA",
          100: "#D5E1F1",
          200: "#A9C0E0",
          400: "#3B639A",
          600: "#1B3A66",
          700: "#14305A",
          800: "#0E2547",
          900: "#0B1F3A"
        },
        accent: {
          DEFAULT: "#F2B705",
          600: "#D99A00",
          50: "#FFF8DB"
        }
      },
      fontFamily: {
        display: ["'Barlow'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"]
      },
      boxShadow: {
        lift: "0 18px 40px -18px rgba(11, 31, 58, 0.35)"
      }
    }
  },
  plugins: []
};
