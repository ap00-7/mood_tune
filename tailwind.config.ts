import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#f4efe7',
        panel: '#111827',
        panelAlt: '#171f2c',
        violet: '#b6a0ff',
        indigo: '#8492ff',
        fuchsia: '#d8a0ff',
        muted: '#9291a2',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(182,160,255,0.3), 0 25px 60px rgba(17,24,39,0.35)',
      },
      backgroundImage: {
        'grid-fade': 'radial-gradient(circle at center, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.02) 1px, transparent 1px)',
      },
      screens: {
        xs: '390px',
      },
    },
  },
  plugins: [],
};

export default config;
