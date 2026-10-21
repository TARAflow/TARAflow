// ==================== DFD DECOMPOSITION ====================
// Leveled-DFD Phase 7b (leveled-dfd-multi-diagram-design.md, Phase 7): the
// decomposition tree in the DFD chapter — one entry per page in page-tree
// order, indented by depth, captioned like its figure and listing the
// elements defined on the page. Absent for a classic DFD.

import type { DocLanguage } from "../models/doc-types";
// Deep import: the DFD barrel pulls UI components; this module is pure.
import { reportPagesOf, type ReportPagesSource } from "../../dfd/services/leveled/report-pages";
import { pageCaption } from "./dfd-figures";

export interface DecompositionItem {
  /** 0 for the root page. */
  depth: number;
  text: string;
}

export interface DfdDecomposition {
  title: string;
  intro: string;
  items: DecompositionItem[];
}

const TEXT = {
  en: {
    title: "Decomposition",
    intro:
      "Each child page decomposes one multiprocess. The tree shows the pages and the elements defined on each of them.",
    defined: (ids: string) => ` — defined here: ${ids}`,
  },
  de: {
    title: "Zerlegung",
    intro:
      "Jede Unterseite zerlegt einen Multiprozess. Der Baum zeigt die Seiten und die Elemente, die auf jeder Seite definiert sind.",
    defined: (ids: string) => ` — hier definiert: ${ids}`,
  },
} as const;

export function dfdDecompositionOf(
  dfd: ReportPagesSource | null | undefined,
  lang: DocLanguage,
): DfdDecomposition | undefined {
  const pages = reportPagesOf(dfd);
  if (!pages) return undefined;
  const text = TEXT[lang];
  return {
    title: text.title,
    intro: text.intro,
    items: pages.map((p) => ({
      depth: p.depth,
      text: pageCaption(p, lang) + (p.defined.length > 0 ? text.defined(p.defined.join(", ")) : ""),
    })),
  };
}
