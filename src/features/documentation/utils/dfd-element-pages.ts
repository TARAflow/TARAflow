// ==================== DFD ELEMENTS BY PAGE ====================
// Leveled-DFD Phase 7b (leveled-dfd-multi-diagram-design.md, Phase 7): the
// element overview of a leveled DFD as one table per page, in page-tree
// order — each element once, on the page its definition is on; the table
// title is the page's figure caption. Elements on no page (records without
// a drawn cell) close the list. Undefined for a classic DFD.

import type { DFDElement } from "../../dfd/models/dfd-types";
import type { DocLanguage } from "../models/doc-types";
// Deep import: the DFD barrel pulls UI components; this module is pure.
import { reportPagesOf, type ReportPagesSource } from "../../dfd/services/leveled/report-pages";
import { pageCaption } from "./dfd-figures";

export interface ElementsOfPage {
  title: string;
  /** In the order of the element records (as in the classic overview). */
  elements: DFDElement[];
}

const NOT_ON_A_PAGE = { en: "Not on any page", de: "Auf keiner Seite" } as const;

export function elementsByPageOf(
  dfd: (ReportPagesSource & { elements?: readonly DFDElement[] }) | null | undefined,
  lang: DocLanguage,
): ElementsOfPage[] | undefined {
  const pages = reportPagesOf(dfd);
  if (!pages) return undefined;
  const elements = dfd?.elements ?? [];
  const placed = new Set(pages.flatMap((p) => p.defined));
  const groups = pages.map((p) => {
    const defined = new Set(p.defined);
    return { title: pageCaption(p, lang), elements: elements.filter((e) => defined.has(e.id)) };
  });
  const unplaced = elements.filter((e) => !placed.has(e.id));
  return [...groups, ...(unplaced.length > 0 ? [{ title: NOT_ON_A_PAGE[lang], elements: unplaced }] : [])].filter(
    (g) => g.elements.length > 0,
  );
}
