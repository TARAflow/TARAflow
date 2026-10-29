// electron/single-instance.ts
// One running TARAflow: a second start focuses the existing window and quits.
// (Formerly part of the OAuth deep-link handler, removed with OAuth — issue-
// tracker adapters design §3.4; the behaviour is unchanged.)

import { app, type BrowserWindow } from "electron";

export function setupSingleInstance(getMainWindow: () => BrowserWindow | null): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on("second-instance", () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
