import type { Config } from "tailwindcss";

/**
 * KOKU 2.0 palette. The utility classes the older components still carry
 * (text-brand-600, bg-brand-50, text-ink…) now resolve to the same tokens the
 * KOKU stylesheets use, so a component written against Tailwind and one
 * written against koku2.css read as one system.
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#0a61c9",
          light: "#2d7ff9",
          50: "#e8f2fd",
          100: "#d6e7fb",
          200: "#b3d1f7",
          300: "#86b4f1",
          400: "#4da3ff",
          500: "#1571e0",
          600: "#0a61c9",
          700: "#0a55b0",
          800: "#073f8f",
          900: "#06336d",
        },
        purple: {
          DEFAULT: "#a24ee0",
          light: "#b975ea",
          50: "#f4ecfd",
          100: "#f3e3ff",
          200: "#e4c6fb",
          500: "#a24ee0",
          600: "#a24ee0",
          700: "#7a37b3",
          800: "#5a1f85",
        },
        indigo: {
          50: "#e8f2fd",
          100: "#d6e7fb",
          200: "#b3d1f7",
          500: "#1571e0",
          600: "#0a61c9",
        },
        ink: "#1f2937",
        surface: "#ffffff",
        muted: "#6b7280",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};
export default config;
