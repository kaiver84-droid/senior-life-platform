import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213A",
        paper: "#FFFBF1",
        brand: { DEFAULT: "#17509E", dark: "#0E3B78", light: "#E7F0FC" },
        warm: { DEFAULT: "#D9480F", light: "#FFF0E6" },
        gold: { DEFAULT: "#B07A16", light: "#FFF4D6" },
        leaf: { DEFAULT: "#1B6B45", light: "#E6F5EC" },
      },
      boxShadow: {
        card: "0 4px 0 0 rgba(20,33,58,0.10), 0 10px 24px -12px rgba(20,33,58,0.35)",
      },
      borderRadius: {
        xl2: "1.5rem",
      },
      screens: {
        senior: "390px",
      },
    },
  },
  plugins: [],
};

export default config;
