/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#070B14",
        panel: {
          DEFAULT: "#0E1626",
          light: "#152238",
          dark: "#090F1C",
          border: "rgba(255, 255, 255, 0.08)",
        },
        vajra: {
          orange: "#F28C28",
          navy: "#1F3864",
          blue: "#0070C0",
        },
        hazard: {
          lightning: "#FFD400",
          hail: "#67E8F9",
          downburst: "#A855F7",
          cloudburst: "#1E88E5",
          severe: "#C0182D",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.05)" },
        },
        flash: {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "pulse-glow": "pulseGlow 2s infinite ease-in-out",
        "lightning-flash": "flash 0.8s infinite ease-in-out",
      },
    },
  },
  plugins: [],
};
