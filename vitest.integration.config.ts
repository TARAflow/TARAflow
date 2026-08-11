import { defineConfig } from "vitest/config";

// Integration tests (`*.int.test.ts`) exercise the engine against a REAL git
// binary (spawning throwaway repos): git-reader-exec + audit-verify-main. They
// run in a plain NODE environment — no jsdom, no React setup — and are kept out
// of the default `npm test` so that suite stays fast and git-free.
//
//   npm run test:integration
//
// In CI, run this only in a job that has git (e.g. ubuntu-latest, which ships
// git). The signature crypto paths (good/bad) still need real SSH keys and are
// covered separately by the example fixtures, not here.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.int.test.ts"],
    exclude: [
      "node_modules/**",
      "dist/**",
      "dist-cli/**",
      "dist-electron/**",
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
