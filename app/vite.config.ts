import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fonts and reference images live at the repo root (../fonts, ../images) and are
// imported from there so nothing is duplicated inside app/.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
  build: { assetsInlineLimit: 0 },
  test: { environment: 'node' },
});
