import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        simple: path.resolve(__dirname, 'demos/simple/index.html'),
        obj: path.resolve(__dirname, 'demos/obj/index.html'),
        surfaces: path.resolve(__dirname, 'demos/surfaces/index.html'),
      },
    },
  }
});
