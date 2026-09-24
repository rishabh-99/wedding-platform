import type { Config } from 'tailwindcss';

/** Design tokens: ivory dominates, antique gold brings the luxury, maroon gives depth. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: {
          DEFAULT: '#FBF7EE',
          50: '#FDFBF6',
          100: '#F7F0E1',
          200: '#EFE4CC',
          300: '#E4D4B2',
        },
        gold: {
          DEFAULT: '#A8894F',
          light: '#C2A56B',
          pale: '#E3D3AE',
          dark: '#8A6D3B',
          deep: '#6F5629',
        },
        maroon: {
          DEFAULT: '#6B1E2A',
          light: '#8A2E3C',
          dark: '#4E1420',
          night: '#2A0A10',
        },
        ink: {
          DEFAULT: '#2E2420',
          soft: '#4A3C35',
          muted: '#6B5B50',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        label: ['Cinzel', '"Cormorant Garamond"', 'serif'],
      },
      letterSpacing: {
        label: '0.28em',
        wide2: '0.18em',
      },
      boxShadow: {
        paper: '0 1px 0 rgba(168,137,79,0.18), 0 18px 40px -24px rgba(46,36,32,0.35)',
        glow: '0 0 60px -10px rgba(194,165,107,0.55)',
      },
      maxWidth: {
        prose2: '38rem',
      },
      keyframes: {
        'live-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.85)' },
        },
        drift: {
          '0%': { transform: 'translate3d(0, 0, 0)', opacity: '0' },
          '15%': { opacity: '0.9' },
          '100%': { transform: 'translate3d(var(--drift-x, 12px), -120px, 0)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'live-pulse': 'live-pulse 1.8s ease-in-out infinite',
        drift: 'drift 9s linear infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
