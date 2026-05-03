import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07080d",
          900: "#0d1118",
          800: "#141925",
          700: "#202838"
        },
        brass: "#d79b4a",
        emerald: "#2dd4bf",
        crimson: "#ef5f6c",
        arcane: "#7aa2ff"
      },
      boxShadow: {
        glow: "0 0 36px rgba(215, 155, 74, 0.15)",
        card: "0 18px 60px rgba(0, 0, 0, 0.34)"
      }
    }
  },
  plugins: []
};

export default config;
