import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#ffffff', muted: '#fafafa' },
        body: { DEFAULT: '#18181b', muted: '#71717a' },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%)',
      },
    },
  },
  plugins: [],
}
export default config
