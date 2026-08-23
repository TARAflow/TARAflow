// scripts/build-electron.mjs
// ==================== ELECTRON BUILD (esbuild) ====================
// Replaces the old 3-step pipeline (tsc -> rename .js to .cjs -> patch
// require() paths -> separately re-bundle audit-verify-main.ts with esbuild)
// with a single esbuild pass per entry point.
//
// Why this works: esbuild resolves our tsconfig `paths`-style aliases itself
// (see `alias` below) and writes CommonJS directly to .cjs — so there is
// nothing left to rename and no require() paths to patch afterwards.
// Bundling main.ts also transitively bundles everything it imports,
// including electron/services/audit-verify-main.ts and (through that) the
// audit engine under src/features/audit/**. That means the old dedicated
// `bundle:audit-main` step is gone too — it's just part of the main bundle
// now.
//
// Type-checking is NOT done here — see "typecheck:electron" in package.json
// (tsc -p tsconfig.electron.json --noEmit). Keeping the type-check separate
// from the bundle step means a type error fails the check but esbuild still
// produces a runnable dev build (esbuild does not type-check at all).

import { build } from "esbuild";
import { rmSync } from "node:fs";

const OUT_DIR = "dist-electron";

rmSync(OUT_DIR, { recursive: true, force: true });

/**
 * Runtime deps that must NOT be bundled:
 * - "electron" is provided by the Electron runtime itself.
 * - keytar / simple-git / @kwsites/file-exists are kept external the same
 *   way vite.config.ts already excludes them from the renderer bundle —
 *   keytar ships a native .node addon (can't be bundled at all), and
 *   simple-git/@kwsites/file-exists come along for the ride so there's one
 *   copy of the git plumbing, not two.
 *
 * These are shipped to production via node_modules as normal (electron-
 * builder packages production dependencies alongside dist-electron/**).
 *
 * If a future dependency fails to bundle cleanly (native binding, or a
 * package that loads assets relative to its own package folder, e.g. via
 * __dirname tricks), add it here rather than fighting esbuild.
 */
const EXTERNAL = ["electron", "keytar", "simple-git", "@kwsites/file-exists"];

/** Mirrors the path aliases in tsconfig.electron.json / tsconfig.json. */
const ALIAS = {
  app: "./src/app",
  features: "./src/features",
  shared: "./src/shared",
  i18n: "./src/i18n",
  audit: "./src/features/audit",
};

const shared = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  sourcemap: true,
  logLevel: "info",
  external: EXTERNAL,
  alias: ALIAS,
  outExtension: { ".js": ".cjs" },
};

await build({
  ...shared,
  entryPoints: { main: "electron/main.ts" },
  outdir: OUT_DIR,
});

await build({
  ...shared,
  entryPoints: { preload: "electron/preload.ts" },
  outdir: OUT_DIR,
});

console.log("\n✅ Electron build complete (dist-electron/main.cjs, dist-electron/preload.cjs)");
