// electron/window-title.ts
//
// The window title shows the open project (0.19 manual test note, 0.20 item
// 17): the renderer sets document.title to "<project> — <file path>"; the
// main process appends "TARAflow <version>", which only it knows. Without a
// project: "TARAflow <version>" as before.

export function windowTitle(pageTitle: string, version: string): string {
  const app = `TARAflow ${version}`;
  const page = pageTitle.trim();
  return page && page !== app ? `${page} — ${app}` : app;
}
