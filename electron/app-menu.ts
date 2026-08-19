// electron/app-menu.ts
// ==================== APP MENU ====================
// Electron doesn't expose its built-in default menu for extension, so we
// rebuild an equivalent from `role`-based submenus (which expand to the
// platform-correct default items — Copy/Paste, DevTools, Window, the macOS
// app menu, …) and add a single custom Help entry. Clicking it pushes
// "update:menu-check" to the focused renderer, where UpdateNotifier runs a
// manual check. NOTE: menu labels are static (the main process has no
// i18next); the snackbar/dialog in the renderer are fully localized.

import { Menu, BrowserWindow, type MenuItemConstructorOptions } from "electron";

export function buildAppMenu(): Menu {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: "appMenu" as const }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Check for Updates…",
          click: () => {
            const win =
              BrowserWindow.getFocusedWindow() ??
              BrowserWindow.getAllWindows()[0];
            win?.webContents.send("update:menu-check");
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
