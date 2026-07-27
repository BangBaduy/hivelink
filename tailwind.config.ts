import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: {
          50: "#FFFEFA",
          100: "#FDFBF7",
          200: "#F7F3EA",
          300: "#ECE5D5",
        },
        slate: {
          deep: "#1E293B",
          darker: "#0F172A",
          muted: "#64748B",
        },
        emerald: {
          cta: "#10B981",
          hover: "#059669",
          soft: "#D1FAE5",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(30, 41, 59, 0.05)",
        card: "0 10px 30px -5px rgba(30, 41, 59, 0.08)",
        glow: "0 0 25px -5px rgba(16, 185, 129, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
