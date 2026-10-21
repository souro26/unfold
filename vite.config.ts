import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { main: 'src/overlay.html' },
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