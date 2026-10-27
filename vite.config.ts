import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: 'src/index.html',
        overlay: 'src/overlay.html',
      },
    },
  },
  resolve: { alias: { '@': '/src' } },
  server: { port: 5173, strictPort: true },
  optimizeDeps: {
    include: ['canvaskit-wasm'],
    exclude: [],
  },
  assetsInclude: ['**/*.wasm'],
});