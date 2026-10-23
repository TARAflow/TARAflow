/// <reference types="vite/client" />
// src/app/dev/electron-source-hash.ts
// The current hash of the Electron sources from the Vite dev server
// (vite.config.ts, electronSourceHash) and its updates while it runs.
import initial from "virtual:electron-source-hash";

export const electronSourceHash: string | null = initial;

/** Called with the new hash whenever an Electron source changes (dev only). */
export function onElectronSourceHash(listener: (hash: string | null) => void): () => void {
  const hot = import.meta.hot;
  if (!hot) return () => {};
  hot.on("taraflow:electron-source-hash", listener);
  return () => hot.off?.("taraflow:electron-source-hash", listener);
}
