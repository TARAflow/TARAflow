// ==================== USE CELL IDENTITY ====================
// Leveled-DFD Phase 5a (leveled-dfd-multi-diagram-design.md §5.2): the
// cell ↔ tfId index of the current DFD, for selection and navigation.

import { useMemo } from "react";
import type { DFDData } from "../models/dfd-types";
import { dfdParser } from "../services/dfd-parser";
import {
  buildCellIdentityIndex,
  type CellIdentityIndex,
} from "../services/leveled";

const CLASSIC = buildCellIdentityIndex(undefined, []);

/**
 * Index of the saved DFD. A classic project (no dfd.pages, or one page
 * without links) needs no parse: tfId = cell id, one page — the index
 * answers with the identity and selection works exactly as before.
 */
export function useCellIdentity(
  dfd: Pick<DFDData, "xml" | "pages"> | null | undefined,
): CellIdentityIndex {
  const xml = dfd?.xml;
  const pages = dfd?.pages;
  return useMemo(() => {
    const leveled =
      !!pages && (pages.length > 1 || pages.some((p) => (p.links?.length ?? 0) > 0));
    if (!leveled || !xml) return CLASSIC;
    return buildCellIdentityIndex(pages, dfdParser.parse(xml, pages).occurrences);
  }, [xml, pages]);
}
