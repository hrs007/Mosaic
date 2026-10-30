import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        gallery: 'src/main.jsx',
      },
      output: {
        entryFileNames: 'gallery.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'gallery.css';
          }
          return 'assets/[name].[ext]';
        },
        format: 'es',
      },
    },
  },
});
