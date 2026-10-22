// ==================== DFD PAGE SECTIONS ====================
// Leveled-DFD Phase 7a/7b (leveled-dfd-multi-diagram-design.md §12.1,
// Phase 7): the DFD chapter of a leveled DFD has one section per page in
// page-tree order — heading `Page "Sensor Head" (decomposes MP-1 Sensor
// Head)`, the page's figure, and the table of the elements defined on it
// (each element once, in record order). Records without a drawn cell close
// the list in a section of their own. Undefined for a classic DFD.

import type { DFDElement } from "../../dfd/models/dfd-types";
import type { DocLanguage } from "../models/doc-types";
// Deep import: the DFD barrel pulls UI components; this module is pure.
import { reportPagesOf, type ReportPagesSource } from "../../dfd/services/leveled/report-pages";

export interface DfdPageSection {
  title: string;
  /** False for the closing section of elements on no page (no figure). */
  isPage: boolean;
  /** SVG data URL; absent when the page has no stored image yet. */
  image?: string;
  elements: DFDElement[];
}

const TEXT = {
  en: {
    page: (name: string) => `Page "${name}"`,
    decomposes: (mp: string) => ` (decomposes ${mp})`,
    notOnAPage: "Not on any page",
    noImage:
      "No image of this page is stored yet — open the project in TARAflow and save it once.",
  },
  de: {
    page: (name: string) => `Seite „${name}“`,
    decomposes: (mp: string) => ` (zerlegt ${mp})`,
    notOnAPage: "Auf keiner Seite",
    noImage:
      "Für diese Seite ist noch kein Bild gespeichert — öffnen Sie das Projekt in TARAflow und speichern Sie es einmal.",
  },
} as const;

/** Text shown in place of the figure of a page without a stored image. */
export const noDfdImageText = (lang: DocLanguage): string => TEXT[lang].noImage;

export function dfdPageSectionsOf(
  dfd: (ReportPagesSource & { elements?: readonly DFDElement[] }) | null | undefined,
  lang: DocLanguage,
): DfdPageSection[] | undefined {
  const pages = reportPagesOf(dfd);
  if (!pages) return undefined;
  const text = TEXT[lang];
  const elements = dfd?.elements ?? [];
  const placed = new Set(pages.flatMap((p) => p.defined));
  const sections: DfdPageSection[] = pages.map((p) => {
    const defined = new Set(p.defined);
    return {
      title: text.page(p.name) + (p.decomposes ? text.decomposes(p.decomposes) : ""),
      isPage: true,
      ...(p.image ? { image: p.image } : {}),
      elements: elements.filter((e) => defined.has(e.id)),
    };
  });
  const unplaced = elements.filter((e) => !placed.has(e.id));
  return unplaced.length > 0
    ? [...sections, { title: text.notOnAPage, isPage: false, elements: unplaced }]
    : sections;
}
