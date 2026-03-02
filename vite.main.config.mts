import { defineConfig } from 'vite';
import { builtinModules } from 'module';
import commonjs from '@rollup/plugin-commonjs';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Externalize Node.js built-in modules and native modules
      external: [
        'electron',
        'node-pty',
        'node-notifier',
        'js-yaml',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      plugins: [commonjs()],
    },
    // Target Node.js
    target: 'node18',
    // Don't minify for easier debugging
    minify: false,
  },
});
