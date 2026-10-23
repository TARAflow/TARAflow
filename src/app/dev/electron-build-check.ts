// src/app/dev/electron-build-check.ts
// Dev mode: is the running Electron part older than its sources?
//
//   running  the hash the Electron process was built with (null: built
//            before the check existed; undefined: not asked yet)
//   current  the hash of those sources now (Vite dev server; null in a
//            production build or without an Electron build)

export function isElectronBuildOutdated(
  running: string | null | undefined,
  current: string | null,
): boolean {
  if (current === null || running === undefined) return false;
  return running !== current;
}
