import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { builtinModules } from "node:module";

export default defineConfig({
  plugins: [react()],
  base: "./", // for Electron - relative path
  resolve: {
    alias: {
      app: "/src/app",
      features: "/src/features",
      shared: "/src/shared",
      i18n: "/src/i18n",
      audit: "/src/features/audit",
    },
  },
  build: {
    rollupOptions: {
      external: [
        ...builtinModules, // fs, path, url, tls, http, https, etc.
        "keytar",
        "simple-git",
        "@kwsites/file-exists",
      ],
    },
  },
  optimizeDeps: {
    exclude: ["keytar", "simple-git", "@kwsites/file-exists"],
  },
});