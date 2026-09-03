/** @type {import('tailwindcss').Config} */
// Astryx neutral theme - light mode (tokens mirrored from @astryxdesign/theme-neutral)
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(0 0% 0% / 0.08)',
        input: 'hsl(0 0% 0% / 0.08)',
        ring: 'hsl(207 100% 45%)',
        background: 'hsl(0 0% 94.5%)', // #f1f1f1 canvas
        foreground: 'hsl(0 0% 9%)', // #171717
        primary: {
          DEFAULT: 'hsl(207 100% 45%)', // #0074e2 Astryx accent
          foreground: 'hsl(0 0% 100%)',
        },
        secondary: {
          DEFAULT: 'hsl(0 0% 89.8%)', // #e5e5e5
          foreground: 'hsl(0 0% 9%)',
        },
        destructive: {
          DEFAULT: 'hsl(355 92% 59%)', // #f5394f
          foreground: 'hsl(0 0% 100%)',
        },
        muted: {
          DEFAULT: 'hsl(0 0% 89.8%)', // soft gray fills (table header, chips)
          foreground: 'hsl(0 0% 32.2%)', // #525252 secondary text
        },
        accent: {
          DEFAULT: 'hsl(0 0% 89.8%)',
          foreground: 'hsl(0 0% 9%)',
        },
        popover: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(0 0% 9%)',
        },
        card: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(0 0% 9%)',
        },
      },
      fontFamily: {
        sans: ['Figtree', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '4rem',
      },
      spacing: {
        0: '0',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
      },
    },
  },
  plugins: [],
}
