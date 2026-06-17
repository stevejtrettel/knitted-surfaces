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
        hyperbolic: path.resolve(__dirname, 'demos/hyperbolic/index.html'),
        '3-sphere': path.resolve(__dirname, 'demos/3-sphere/index.html'),
        surfaces: path.resolve(__dirname, 'demos/surfaces/index.html'),
        'quad-obj': path.resolve(__dirname, 'demos/quad-obj/index.html'),
        'tri-obj': path.resolve(__dirname, 'demos/tri-obj/index.html'),
        tile: path.resolve(__dirname, 'demos/tile/index.html'),
      },
    },
  }
});
