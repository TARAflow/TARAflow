import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "app": "/src/app",
      "features": "/src/features",
      "shared": "/src/shared",
      "i18n": "/src/i18n",
    },
  },
});