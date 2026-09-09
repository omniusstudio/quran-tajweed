import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Fonts and reference images live at the repo root (../fonts, ../images) and are
// imported from there so nothing is duplicated inside app/.
export default defineConfig({
  // GitHub Pages serves the site under /<repo>/; the deploy workflow sets BASE_PATH accordingly.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    // Offline after first load (PROMPT.md §1, §8): the app shell, fonts, artwork and content are
    // precached; the sūrah recordings are cached on first play so the learner never re-downloads them.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'نُطق — تعلّم نطق القرآن برواية الدوري',
        short_name: 'نُطق',
        description: 'كيف يُنطق كل حرف وكل قاعدة تجويد في رواية الدوري عن أبي عمرو',
        lang: 'ar',
        dir: 'rtl',
        display: 'standalone',
        start_url: './',
        background_color: '#faf7f2',
        theme_color: '#1f7a4d',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,ttf,json,svg}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/audio/'),
            handler: 'CacheFirst',
            options: { cacheName: 'nutq-audio', expiration: { maxEntries: 200, maxAgeSeconds: 365 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  server: { fs: { allow: ['..'] } },
  build: { assetsInlineLimit: 0 },
  test: { environment: 'node' },
});
