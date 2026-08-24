import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Component tests (src/tests/component/**) render REAL components through
// @testing-library/react and jsdom — the same real-render style used e.g. by
// attacktree-path-columns.test.tsx and attacktree-editor
// .validation-render.test.tsx.
//
// These differ from src/tests/unit/** in kind, not just location: unit tests
// isolate one module with everything else mocked; component tests render a
// real component tree and replace only heavy/irrelevant leaves (CodeMirror,
// dialogs, sibling feature panels) with minimal stand-ins, the way
// attacktree-editor.validation-render.test.tsx stubs CodeMirror to a
// textarea. Kept in a SEPARATE config (like vitest.integration.config.ts)
// rather than folded into vitest.config.ts's include list so that:
//   - the default `npm test` stays fast (no accidental heavy real-renders
//     sneaking in through a broad include glob), and
//   - it's an explicit decision to add a file here, not an accident of
//     which glob happened to match a new file's path.
//
//   npm run test:component
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/tests/setup-tests.ts"],
    include: [
      "src/tests/component/**/*.test.ts",
      "src/tests/component/**/*.test.tsx",
    ],
    exclude: ["node_modules/**", "**/*.int.test.ts"],
    alias: {
      app: "/src/app",
      features: "/src/features",
      shared: "/src/shared",
      i18n: "/src/i18n",
      audit: "/src/features/audit",
      services: "/electron/services",
    },
  },
});