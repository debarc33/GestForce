import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
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
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        glass: {
          DEFAULT: "var(--glass)",
          hover: "var(--glass-hover)",
          strong: "var(--glass-strong)",
          border: "var(--glass-border)",
          "border-strong": "var(--glass-border-strong)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [
    function ({ addUtilities }: any) {
      addUtilities({
        '.glass-surface': {
          'background': 'var(--glass)',
          'backdrop-filter': 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
          '-webkit-backdrop-filter': 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
          'border': '1px solid var(--glass-border)',
        },
        '.glass-surface-strong': {
          'background': 'var(--glass-strong)',
          'backdrop-filter': 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
          '-webkit-backdrop-filter': 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
          'border': '1px solid var(--glass-border-strong)',
        },
      })
    },
  ],
};

export default config;