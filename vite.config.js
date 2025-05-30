import {defineConfig} from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    svgr({
      exportAsDefault: true,
    }),
    react(),
    laravel({
      input: ['resources/css/index.css', 'resources/js/main.jsx'],
      refresh: true,
    }),
  ],
});

