// electron/window-navigation.ts
// ==================== WINDOW NAVIGATION HARDENING ====================
// Belt-and-braces against the renderer ever navigating away from the app or
// spawning popup windows: no in-app navigation to foreign pages, no popups.
// External http(s) targets are handed to the system browser; anything else is
// simply denied. The decision logic is pure and unit-tested; the thin
// webContents wiring mirrors the other electron glue.

import { shell as defaultShell, type WebContents } from "electron";

const DEV_SERVER_ORIGIN = "http://localhost:5173";

/** Is this URL the app's own content?
 *  - packaged build: the renderer is loaded from file://…/dist/index.html
 *  - dev build: from the Vite dev server origin */
export function makeIsInternalUrl(isPackaged: boolean): (url: string) => boolean {
  return (url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    return isPackaged
      ? parsed.protocol === "file:"
      : parsed.origin === DEV_SERVER_ORIGIN;
  };
}

/** Should this navigation target open in the external browser? Only absolute
 *  http(s) URLs that are NOT the app's own content. */
export function shouldOpenExternally(
  url: string,
  isInternalUrl: (u: string) => boolean,
): boolean {
  if (isInternalUrl(url)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

interface ShellLike {
  openExternal(url: string): Promise<void> | void;
}

export function hardenWindowNavigation(
  contents: WebContents,
  isInternalUrl: (url: string) => boolean,
  shell: ShellLike = defaultShell,
): void {
  // No popup windows; route external ones to the system browser.
  contents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternally(url, isInternalUrl)) void shell.openExternal(url);
    return { action: "deny" };
  });

  // Allow the app's own navigation; block navigation to foreign pages and
  // send external ones to the browser instead.
  contents.on("will-navigate", (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    if (shouldOpenExternally(url, isInternalUrl)) void shell.openExternal(url);
  });
}
