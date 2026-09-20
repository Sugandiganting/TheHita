import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f7f5',
          100: '#dbe9e3',
          200: '#b8d3c8',
          300: '#8bb6a6',
          400: '#5e9682',
          500: '#3f7a66',
          600: '#2f6151',
          700: '#274e42',
          800: '#213f37',
          900: '#1d352f',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
