import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        // Core brand colors
        'ink-black': '#111827',
        'medium-slate-blue': '#8B5CF6',
        'slime-lime': '#A3E635',
        'dust-grey': '#D4D4D8',
        'platinum': '#F4F4F5',
        
        // Semantic colors using CSS variables
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        },
        // Brand color utilities
        brand: {
          purple: '#8B5CF6',
          'purple-dark': '#7C3AED',
          lime: '#A3E635',
          'lime-dark': '#84CC16',
        },
        // Status colors
        success: {
          DEFAULT: '#84CC16',
          light: 'rgba(163, 230, 53, 0.1)',
        },
        error: {
          DEFAULT: '#EF4444',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji'
        ],
        serif: [
          'ui-serif',
          'Georgia',
          'Cambria',
          'Times New Roman',
          'Times',
          'serif'
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace'
        ]
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        },
        'premium-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(163, 230, 53, 0.3)'
          },
          '50%': {
            boxShadow: '0 0 30px rgba(163, 230, 53, 0.5)'
          }
        },
        'glow': {
          '0%, 100%': {
            boxShadow: '0 0 15px rgba(163, 230, 53, 0.3)'
          },
          '50%': {
            boxShadow: '0 0 25px rgba(163, 230, 53, 0.5)'
          }
        },
        'shimmer': {
          '0%': {
            backgroundPosition: '-200% 0'
          },
          '100%': {
            backgroundPosition: '200% 0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'premium-pulse': 'premium-pulse 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite'
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(17, 24, 39, 0.1)',
        'medium': '0 4px 6px rgba(17, 24, 39, 0.1)',
        'large': '0 10px 25px rgba(139, 92, 246, 0.15)',
        'glow': '0 0 20px rgba(163, 230, 53, 0.3)',
        'glow-purple': '0 0 30px rgba(139, 92, 246, 0.25)',
        'glow-lg': '0 0 40px rgba(163, 230, 53, 0.4)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
        'gradient-premium': 'linear-gradient(135deg, #8B5CF6 0%, #A3E635 100%)',
        'gradient-dark': 'linear-gradient(180deg, #111827 0%, #1F2937 100%)',
        'gradient-hero': 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(163, 230, 53, 0.05) 100%)',
        'gradient-progress': 'linear-gradient(90deg, #8B5CF6 0%, #A3E635 100%)',
      },
      transitionDuration: {
        '200': '200ms',
      },
    }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
