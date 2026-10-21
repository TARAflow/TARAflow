// ==================== DFD FIGURES ====================
// Leveled-DFD Phase 7a (leveled-dfd-multi-diagram-design.md §12.1, item 4):
// the figures of the DFD chapter. A classic DFD has one figure without a
// caption, exactly as before; a leveled DFD one figure per page in
// page-tree order, captioned with the page name and, for a child page, the
// multiprocess it decomposes. A page without a stored image says so.

import type { DocLanguage } from "../models/doc-types";
// Deep import: the DFD barrel pulls UI components; this module is pure.
import {
  reportPagesOf,
  type ReportPagesSource,
} from "../../dfd/services/leveled/report-pages";

export interface DfdFigure {
  /** Image data URL; absent when the page has no stored image yet. */
  image?: string;
  /** Absent for the single figure of a classic DFD. */
  caption?: string;
}

const TEXT = {
  en: {
    page: (name: string) => `Page "${name}"`,
    decomposes: (mp: string) => ` (decomposes ${mp})`,
    noImage:
      "No image of this page is stored yet — open the project in TARAflow and save it once.",
  },
  de: {
    page: (name: string) => `Seite „${name}“`,
    decomposes: (mp: string) => ` (zerlegt ${mp})`,
    noImage:
      "Für diese Seite ist noch kein Bild gespeichert — öffnen Sie das Projekt in TARAflow und speichern Sie es einmal.",
  },
} as const;

/** Text shown in place of a figure whose page has no stored image. */
export const noDfdImageText = (lang: DocLanguage): string => TEXT[lang].noImage;

export function dfdFiguresOf(
  dfd: ReportPagesSource | null | undefined,
  lang: DocLanguage,
): DfdFigure[] {
  const pages = reportPagesOf(dfd);
  if (!pages) return [{ ...(dfd?.thumbnail ? { image: dfd.thumbnail } : {}) }];
  const text = TEXT[lang];
  return pages.map((p) => ({
    ...(p.image ? { image: p.image } : {}),
    caption: text.page(p.name) + (p.decomposes ? text.decomposes(p.decomposes) : ""),
  }));
}
