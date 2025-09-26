/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          orange: '#FF6B35',
          yellow: '#F7931E',
          pink: '#FF1744',
          purple: '#9C27B0',
          blue: '#2196F3',
          green: '#4CAF50',
          dark: '#1A1A1A',
          darker: '#0D0D0D',
          light: '#F5F5F5',
          gray: '#666666',
        },
        neon: {
          pink: '#FF10F0',
          blue: '#00FFFF',
          green: '#39FF14',
          yellow: '#FFFF00',
        }
      },
      fontFamily: {
        'retro': ['Courier New', 'monospace'],
        'arcade': ['Orbitron', 'monospace'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #FF10F0, 0 0 10px #FF10F0, 0 0 15px #FF10F0' },
          '100%': { boxShadow: '0 0 10px #FF10F0, 0 0 20px #FF10F0, 0 0 30px #FF10F0' },
        }
      },
      backgroundImage: {
        'retro-gradient': 'linear-gradient(135deg, #FF6B35 0%, #F7931E 25%, #FF1744 50%, #9C27B0 75%, #2196F3 100%)',
        'neon-gradient': 'linear-gradient(45deg, #FF10F0, #00FFFF, #39FF14, #FFFF00)',
      }
    },
  },
  plugins: [],
}
