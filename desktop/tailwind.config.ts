import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/renderer/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: {
          DEFAULT: "hsl(var(--background))",
          raised: "hsl(var(--background-raised))",
          overlay: "hsl(var(--background-overlay))",
        },
        foreground: {
          DEFAULT: "hsl(var(--foreground))",
          secondary: "hsl(var(--foreground-secondary))",
          muted: "hsl(var(--foreground-muted))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          secondary: "hsl(var(--accent-secondary))",
          "secondary-foreground": "hsl(var(--accent-secondary-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Dracula palette for direct use
        dracula: {
          purple: "hsl(var(--dracula-purple))",
          pink: "hsl(var(--dracula-pink))",
          green: "hsl(var(--dracula-green))",
          cyan: "hsl(var(--dracula-cyan))",
          orange: "hsl(var(--dracula-orange))",
          red: "hsl(var(--dracula-red))",
          yellow: "hsl(var(--dracula-yellow))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "var(--shadow-glow)",
        "glow-strong": "var(--shadow-glow-strong)",
        "glow-teal": "var(--shadow-glow-teal)",
        "glow-teal-strong": "var(--shadow-glow-teal-strong)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],                              // 11px — status text
        xs: ["0.75rem", { lineHeight: "1rem" }],                                    // 12px
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],                               // 13px — base body
        base: ["0.9375rem", { lineHeight: "1.375rem", letterSpacing: "-0.01em" }],  // 15px — headings
        lg: ["1.125rem", { lineHeight: "1.5rem", letterSpacing: "-0.015em" }],      // 18px — hero
        xl: ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.02em" }],           // 24px
        "2xl": ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.025em" }],       // 32px — display
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
        panel: "var(--duration-panel)",
      },
      transitionTimingFunction: {
        "ease-out-expo": "var(--ease-out)",
        "ease-in-out-expo": "var(--ease-in-out)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in var(--duration-normal) var(--ease-out)",
        "fade-in-up": "fade-in-up var(--duration-slow) var(--ease-out)",
      },
    },
  },
  plugins: [],
};

export default config;
