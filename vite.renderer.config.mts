import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
  },
});
