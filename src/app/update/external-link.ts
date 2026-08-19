// src/app/update/external-link.ts
// ==================== UPDATE — EXTERNAL LINK RULE ====================
// Links inside release notes must open in the external browser, never
// navigate the Electron window. `externalHref` is the pure gate: it returns
// a URL only for absolute http(s) links, and null for anything else
// (fragments #…, mailto:, relative paths, javascript:, malformed, empty).
// `openExternalHref` is the thin side-effect used by the markdown anchor.

export function externalHref(href: string | undefined): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    // Relative paths / fragments / malformed → not an external link.
    return null;
  }
  return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
}

export function openExternalHref(href: string | undefined): void {
  const external = externalHref(href);
  if (external) void window.electron?.shell.openExternal(external);
}
