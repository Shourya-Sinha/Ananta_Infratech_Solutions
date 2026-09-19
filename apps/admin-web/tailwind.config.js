/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F3F5F7",
        surface: "#FFFFFF",
        graphite: {
          900: "#14181D",
          700: "#2B323B",
          500: "#5B6572",
          300: "#8D97A3",
        },
        steel: {
          200: "#D8DEE4",
          100: "#E9EDF1",
        },
        amber: {
          DEFAULT: "#C97A1F",
          50: "#FBF1E4",
          600: "#A9670F",
        },
        teal: {
          DEFAULT: "#1F7A72",
          50: "#E7F4F2",
        },
        rust: {
          DEFAULT: "#B84A3E",
          50: "#FBEBE9",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        none: "0px",
        sm: "3px",
        DEFAULT: "5px",
        md: "6px",
        lg: "8px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 24, 29, 0.06), 0 1px 1px rgba(20, 24, 29, 0.04)",
      },
    },
  },
  plugins: [],
};
