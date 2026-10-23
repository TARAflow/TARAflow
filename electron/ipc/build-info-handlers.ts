// electron/ipc/build-info-handlers.ts
// ==================== ELECTRON BUILD INFO ====================
// The hash of the sources this Electron part was built from
// (dist-electron/build-info.json, written by scripts/build-electron.mjs),
// read once at start — so it describes the RUNNING process, also after a
// later rebuild. The renderer compares it with the sources as they are now
// (dev mode) and asks for a restart when they differ.

import { ipcMain } from "electron";
import fs from "fs";
import path from "path";

export interface ElectronBuildInfo {
  hash: string;
  builtAt?: string;
}

function readBuildInfo(): ElectronBuildInfo | null {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "build-info.json"), "utf8");
    const { hash, builtAt } = JSON.parse(raw);
    return typeof hash === "string" ? { hash, builtAt } : null;
  } catch {
    return null;
  }
}

export function registerBuildInfoHandlers() {
  const info = readBuildInfo();
  ipcMain.handle("app:getElectronBuildInfo", () => info);
}
