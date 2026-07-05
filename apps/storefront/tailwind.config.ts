import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#191510",
        paper: "#F7F4EE",
        panel: "#FFFFFF",
        line: "#E1DACB",
        accent: "#D98E2B",
        muted: "#8A8271",
        danger: "#B3432B",
        "danger-bg": "#FBE9E4",
        success: "#4C7A4A",
        "success-bg": "#EAF3E6",
      },
      fontFamily: {
        heading: ["Bricolage Grotesque", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },
    },
  },
  plugins: [],
} satisfies Config;
