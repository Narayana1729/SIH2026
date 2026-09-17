import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-base)",
        "bg-base": "var(--bg-base)",
        surface: {
          DEFAULT: "var(--bg-surface)",
          raised: "var(--bg-surface-raised)",
          hover: "var(--bg-surface-hover)",
          active: "var(--bg-surface-active)",
        },
        foreground: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          disabled: "var(--text-disabled)",
        },
        accent: {
          DEFAULT: "var(--accent-primary)",
          soft: "var(--accent-primary-soft)",
          cyan: "var(--accent-cyan)",
          blue: "var(--accent-blue)",
          hover: "var(--accent-hover)",
        },
        state: {
          success: "var(--state-success)",
          warning: "var(--state-warning)",
          error: "var(--state-error)",
          info: "var(--state-info)",
        },
        border: {
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
          active: "var(--border-active)",
        },
        thermal: {
          DEFAULT: "var(--thermal-primary)",
          hot: "var(--thermal-hot)",
          glow: "var(--thermal-glow)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        control: "6px",
        panel: "8px",
        overlay: "12px",
        pill: "9999px",
      },
      boxShadow: {
        panel: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
        elevated: "0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
        modal: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
        inset: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
      },
      animation: {
        "pulse-subtle": "pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
