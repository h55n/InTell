export default {
  content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#09090b', surface: '#111113', border: '#27272a',
        accent: '#00ff88', warn: '#f59e0b', danger: '#ef4444', info: '#3b82f6', safe: '#22c55e',
        dim: '#71717a', text: '#fafafa',
      },
      fontFamily: { mono: ['JetBrains Mono','Courier New','monospace'] },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite',
        'scan': 'scan 3s linear infinite',
        'fadeUp': 'fadeUp 0.35s ease-out',
      },
      keyframes: {
        scan: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(200%)' } },
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
