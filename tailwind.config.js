/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surface layers (dark to light)
        surface: {
          DEFAULT: '#0a0a0b',   // App background
          raised: '#111113',    // Cards, sidebar
          overlay: '#1a1a1e',   // Dropdowns, modals
          hover: '#1f1f24',     // Hover states
          active: '#26262d',    // Active/pressed states
        },
        // Borders
        border: {
          DEFAULT: '#1e1e24',   // Subtle borders
          strong: '#2e2e38',    // Prominent borders
          hover: '#3a3a46',     // Border hover
        },
        // Text
        'text-primary': '#ededef',     // Primary text
        'text-secondary': '#8b8b96',   // Secondary/muted text
        'text-tertiary': '#5c5c66',    // Tertiary/disabled text
        // Accent (blue — Linear-style)
        accent: {
          DEFAULT: '#5b5bd6',   // Primary accent
          hover: '#6e6ade',     // Accent hover
          muted: '#5b5bd620',   // Accent background tint
          text: '#9b9ef0',      // Accent text on dark bg
        },
        // Status colors
        status: {
          success: '#30a46c',
          'success-muted': '#30a46c20',
          warning: '#f5a623',
          'warning-muted': '#f5a62320',
          error: '#e5484d',
          'error-muted': '#e5484d20',
          info: '#5b5bd6',
          'info-muted': '#5b5bd620',
        },
        // Phase status colors
        phase: {
          'not-started': '#5c5c66',
          'in-progress': '#5b5bd6',
          complete: '#30a46c',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],  // 10px
        xs: ['0.75rem', { lineHeight: '1rem' }],           // 12px
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],      // 13px
        base: ['0.875rem', { lineHeight: '1.375rem' }],    // 14px
        lg: ['1rem', { lineHeight: '1.5rem' }],             // 16px
        xl: ['1.125rem', { lineHeight: '1.75rem' }],        // 18px
        '2xl': ['1.25rem', { lineHeight: '1.75rem' }],      // 20px
        '3xl': ['1.5rem', { lineHeight: '2rem' }],          // 24px
      },
      spacing: {
        '4.5': '1.125rem',  // 18px
        '13': '3.25rem',    // 52px — sidebar icon-only width
        '72': '18rem',      // 288px — sidebar expanded width
      },
      borderRadius: {
        sm: '0.25rem',   // 4px
        DEFAULT: '0.375rem', // 6px
        md: '0.5rem',    // 8px
        lg: '0.75rem',   // 12px
        xl: '1rem',      // 16px
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'DEFAULT': '0 2px 4px 0 rgba(0, 0, 0, 0.3)',
        'md': '0 4px 8px -1px rgba(0, 0, 0, 0.4)',
        'lg': '0 8px 16px -2px rgba(0, 0, 0, 0.5)',
        'overlay': '0 12px 32px -4px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      transitionDuration: {
        DEFAULT: '150ms',
        fast: '100ms',
        normal: '200ms',
        slow: '300ms',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
