// scripts/electron-build-hash.mjs
// ==================== ELECTRON BUILD HASH ====================
// One hash over the source files that went into the Electron bundles
// (main + preload, from esbuild's metafile). Written by build-electron.mjs
// to dist-electron/build-info.json; the Vite dev server hashes the same
// files as they are now. Different hashes = the running Electron part is
// older than its sources (e.g. drawio-handlers.ts changed, but
// `npm run dev:electron` not restarted).

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const BUILD_INFO_PATH = "dist-electron/build-info.json";

/** Project-relative source files of an esbuild metafile (no node_modules). */
export function inputsOfMetafile(metafile, root = process.cwd()) {
  return Object.keys(metafile.inputs)
    .map((key) => key.replace(/^[a-z-]+:/, "")) // plugin namespace ("raw-text:")
    .map((file) => (isAbsolute(file) ? relative(root, file) : file).split(sep).join("/"))
    .filter((file) => !file.includes("node_modules/"));
}

/** Short content hash of the files (sorted; a missing file counts as such). */
export function hashInputs(files, root = process.cwd()) {
  const hash = createHash("sha256");
  for (const file of [...new Set(files)].sort()) {
    const path = resolve(root, file);
    hash.update(file).update("\0");
    hash.update(existsSync(path) ? readFileSync(path) : "<missing>").update("\0");
  }
  return hash.digest("hex").slice(0, 12);
}

/** { hash, inputs } of the last Electron build, or null without one. */
export function readBuildInfo(root = process.cwd()) {
  const path = resolve(root, BUILD_INFO_PATH);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
