// src/app/utils/project-window-title.ts
//
// What the window title names (0.19 manual test note, 0.20 item 17): the open
// project and its file, so two windows / a renamed copy can be told apart.
// The Electron main process appends "TARAflow <version>" (window-title.ts).
// No project: empty (the title is then the app's alone).

export function projectWindowTitle(project: { info?: { name?: string }; filePath?: string } | null | undefined): string {
  if (!project) return "";
  const name = project.info?.name?.trim() || "";
  const file = project.filePath?.trim() || "";
  return [name, file].filter(Boolean).join(" — ");
}
