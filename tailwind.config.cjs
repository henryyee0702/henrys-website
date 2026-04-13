/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"SF Pro Display"', '"PingFang TC"', '"Hiragino Sans GB"', '"Microsoft JhengHei"', 'sans-serif'],
      },
      colors: {
        background: '#050505',
        foreground: '#F5F5F7',
        muted: '#A1A1AA',
      }
    },
  },
  plugins: [],
}
