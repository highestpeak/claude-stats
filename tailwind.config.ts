import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0d1117",
        card: "#161b22",
        border: "#30363d",
        textPrimary: "#e6edf3",
        textSecondary: "#8b949e",
      },
    },
  },
  plugins: [],
};
export default config;
