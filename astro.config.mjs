import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL || 'https://pinhantseng.com',
  devToolbar: { enabled: false },
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !['/series/fulbright-diary/', '/series/gre-log/', '/series/behind-the-work/'].some(
          (p) => page.endsWith(p),
        ),
    }),
  ],
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  },
});
