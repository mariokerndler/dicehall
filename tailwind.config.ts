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
        card: "0 2px 8px rgba(0, 0, 0, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
