import { defineConfig } from 'vite';
import { builtinModules } from 'module';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Externalize Node.js built-in modules
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
    // Target Node.js for preload
    target: 'node18',
    minify: false,
  },
});
