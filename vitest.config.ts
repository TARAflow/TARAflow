import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/tests/setup-tests.ts"],
    include: [
      "src/tests/unit/**/*.test.ts",
      "src/tests/unit/**/*.test.tsx",
      "taraflow-reporter/tests/**/*.test.ts",
      "electron/**/*.{test,spec}.ts",
      "taraflow-verifier/**/*.{test,spec}.ts",
    ],
    // *.int.test.ts are INTEGRATION tests (need a real git binary) — they run
    // via `npm run test:integration` (vitest.integration.config.ts), NOT in the
    // default/unit suite, so this run stays hermetic and CI-safe without git.
    exclude: [
      "src/app/app.test.tsx",
      "node_modules/**",
      "**/*.int.test.ts",
    ],
    alias: {
      app: "/src/app",
      features: "/src/features",
      shared: "/src/shared",
      i18n: "/src/i18n",
      audit: "/src/features/audit",
    },
  },
});
