// ==================== USE PAGE OUTLINE ====================
// Leveled-DFD Phase 5c (leveled-dfd-multi-diagram-design.md §12): the page
// tree of the saved DFD with the current finding counts. Null for a DFD
// with one page (no page tree) and while pages wait for adoption (5b).
// The parse is the shared one of the DFD tab (leveled analysis), not its own.

import { useMemo } from "react";
import type { DFDPage, ValidationFinding } from "../models/dfd-types";
import type { ParseResult } from "../services/dfd-parser";
import { buildPageOutline, type PageOutline } from "../services/leveled";

export function usePageOutline(
  /** Parse of the saved DFD; null for a classic DFD or while adoption is pending. */
  parse: ParseResult | null,
  pages: readonly DFDPage[] | undefined,
  findings?: {
    errors?: readonly ValidationFinding[];
    warnings?: readonly ValidationFinding[];
  } | null,
): PageOutline | null {
  const errors = findings?.errors;
  const warnings = findings?.warnings;
  return useMemo(
    () =>
      parse && pages && pages.length >= 2 && parse.pages.length >= 2
        ? buildPageOutline({ parse, pages, errors, warnings })
        : null,
    [parse, pages, errors, warnings],
  );
}
