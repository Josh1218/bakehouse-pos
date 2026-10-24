import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built site works from any URL, including a GitHub Pages
  // project page like https://<user>.github.io/<repo>/
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    host: true, // also reachable from other devices on the same WiFi during dev
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
