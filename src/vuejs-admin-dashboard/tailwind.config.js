/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surface tokens
        surface: {
          DEFAULT: 'var(--color-surface)',
          secondary: 'var(--color-surface-secondary)',
          tertiary: 'var(--color-surface-tertiary)',
        },
        // On-surface (text) tokens
        'on-surface': {
          DEFAULT: 'var(--color-on-surface)',
          muted: 'var(--color-on-surface-muted)',
          subtle: 'var(--color-on-surface-subtle)',
        },
        // Primary / accent tokens
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          muted: 'var(--color-primary-muted)',
        },
        // Border tokens
        border: {
          DEFAULT: 'var(--color-border)',
          subtle: 'var(--color-border-subtle)',
        },
        // Semantic accent colors
        'accent-green': {
          DEFAULT: 'var(--color-accent-green)',
          muted: 'var(--color-accent-green-muted)',
          subtle: 'var(--color-accent-green-subtle)',
        },
        'accent-red': {
          DEFAULT: 'var(--color-accent-red)',
          muted: 'var(--color-accent-red-muted)',
          subtle: 'var(--color-accent-red-subtle)',
        },
        'accent-yellow': {
          DEFAULT: 'var(--color-accent-yellow)',
          muted: 'var(--color-accent-yellow-muted)',
          subtle: 'var(--color-accent-yellow-subtle)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      spacing: {
        // 8dp base rhythm is already Tailwind default (1 unit = 4px, 2 = 8px)
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.10)',
        'card-dark': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover-dark': '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.35)',
      },
      safelist: [
        'bg-accent-green-subtle',
        'bg-accent-red-subtle',
        'bg-accent-yellow-subtle',
        'text-accent-green',
        'text-accent-red',
        'text-accent-yellow',
        'border-accent-green',
        'border-accent-red',
        'border-accent-yellow',
      ],
    },
  },
  plugins: [],
}
