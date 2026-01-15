import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: "./", // for Electron - relative path
  resolve: {
    alias: {
      app: "/src/app",
      features: "/src/features",
      shared: "/src/shared",
      i18n: "/src/i18n",
    },
  },
  build: {
    rollupOptions: {
      external: ["keytar", "simple-git", "@kwsites/file-exists"],
    },
  },
  optimizeDeps: {
    exclude: ["keytar", "simple-git", "@kwsites/file-exists"],
  },
});