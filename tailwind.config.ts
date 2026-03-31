import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: '#111111',
        'surface-high': '#1C1C1C',
        border: '#2A2A2A',
        primary: {
          DEFAULT: '#FFD700',
          dark: '#CC9900',
          foreground: '#000000',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#9E9E9E',
          disabled: '#555555',
        },
        success: '#4CAF50',
        error: '#E53935',
        warning: '#FF9800',
        info: '#2196F3',
        // Semánticos contabilidad
        activo: '#4CAF50',
        pasivo: '#E53935',
        patrimonio: '#9C27B0',
        ingreso: '#2196F3',
        egreso: '#FF9800',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
}

export default config
