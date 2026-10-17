// ==================== USE PAGE OUTLINE ====================
// Leveled-DFD Phase 5c (leveled-dfd-multi-diagram-design.md §12): the page
// tree of the saved DFD with the current finding counts. Null for a DFD
// with one page (no page tree) and while pages wait for adoption (5b).

import { useMemo } from "react";
import { inspectDrawioPages } from "shared";
import type { DFDData, ValidationFinding } from "../models/dfd-types";
import { dfdParser } from "../services/dfd-parser";
import { buildPageOutline, type PageOutline } from "../services/leveled";

export function usePageOutline(
  dfd: Pick<DFDData, "xml" | "pages"> | null | undefined,
  findings?: {
    errors?: readonly ValidationFinding[];
    warnings?: readonly ValidationFinding[];
  } | null,
): PageOutline | null {
  const xml = dfd?.xml;
  const pages = dfd?.pages;
  const parse = useMemo(() => {
    if (!xml || !pages || pages.length < 2) return null;
    const layout = inspectDrawioPages(xml, pages.map((p) => p.pageId));
    if (!layout.supported || layout.pageCount < 2) return null;
    return dfdParser.parse(xml, pages);
  }, [xml, pages]);

  const errors = findings?.errors;
  const warnings = findings?.warnings;
  return useMemo(
    () => (parse ? buildPageOutline({ parse, pages, errors, warnings }) : null),
    [parse, pages, errors, warnings],
  );
}
