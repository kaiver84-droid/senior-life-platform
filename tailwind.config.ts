import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* 늘봄 브랜드 — 딥네이비 텍스트 · 크림 배경 · 청록/노랑 */
        ink: "#173B5E",
        paper: "#F9F7F1",
        shell: "#EFEDE4",
        brand: { DEFAULT: "#18939B", dark: "#0F6F76", deep: "#0B555B", light: "#E4F4F3" },
        sun: { DEFAULT: "#F5B82E", light: "#FFF3D8", dark: "#D99A0C" },
        gold: { DEFAULT: "#F7C346", dark: "#D9A018", light: "#FFF6DC" },
        coral: { DEFAULT: "#F2708A", dark: "#D9526C", light: "#FFE9EE" },
        sky: { DEFAULT: "#DCEAF7", deep: "#C3DAF1" },
        plum: { DEFAULT: "#7A6BC4", dark: "#5F51A8", light: "#EDE9FB" },
        leaf: { DEFAULT: "#3E9C6B", dark: "#2C7A52", light: "#E7F6ED" },
        /* 이전 이름 유지(남은 참조 대비) */
        warm: { DEFAULT: "#F2708A", light: "#FFE9EE" },
      },
      boxShadow: {
        soft: "0 2px 16px -8px rgba(23,59,94,0.28)",
        card: "0 4px 22px -12px rgba(23,59,94,0.30)",
        lift: "0 10px 28px -14px rgba(23,59,94,0.40)",
        cta: "0 6px 16px -8px rgba(23,59,94,0.55)",
        sun: "0 6px 16px -6px rgba(245,184,46,0.65)",
      },
      borderRadius: {
        xl2: "1.5rem",
        xl3: "1.75rem",
      },
      screens: {
        senior: "390px",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.94)", opacity: "0" },
          "60%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(22px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.34s ease both",
        pop: "pop 0.4s ease both",
        floaty: "floaty 3.4s ease-in-out infinite",
        rise: "rise 0.5s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
