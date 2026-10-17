// ==================== DUPLICATE REASSIGNMENT ====================
// Leveled-DFD Phase 3.3 (leveled-dfd-multi-diagram-design.md §5.2, D8).
//
// Applies the decision of findDuplicateDefinitions on save: every
// definition cell that does not keep a duplicated tfId gets a fresh tfId
// (a "definition" link in dfd.pages) — "paste = new element", never merged.
//
// Only the identity is assigned here. The save path never rewrites the XML
// (the editor owns it), so the reassigned cell keeps the id label it was
// drawn with until the next explicit renumber, which numbers it as the new
// definition it now is (§8). Until then the existing duplicate-id warning
// shows the clash; the info finding ID_PASTE_REASSIGNED comes with the
// leveled findings in Phase 4.

import type { DFDPage } from "../../models/dfd-types";
import { dfdParser, type ParsedOccurrence } from "../dfd-parser";
import { computeHomePages } from "./home-pages";
import { buildPageTree } from "./page-tree";
import { findDuplicateDefinitions } from "./duplicate-definitions";
import { giveFreshIdentities, type FreshIdentity } from "./identity-links";

export interface DuplicateReassignmentInput {
  xml: string;
  /** dfd.pages of the state being saved (stale links already pruned). */
  pages: DFDPage[] | undefined;
  /** XML and dfd.pages of the last saved state; absent = unknown. */
  previousXml?: string;
  previousPages?: readonly DFDPage[];
}

export interface DuplicateReassignmentResult {
  /** Same array if nothing was reassigned. */
  pages: DFDPage[] | undefined;
  reassigned: FreshIdentity[];
}

export function reassignDuplicateDefinitions(
  input: DuplicateReassignmentInput,
): DuplicateReassignmentResult {
  const { xml, pages } = input;
  // Cell ids are unique within a page: duplicates need two adopted pages.
  if (!pages || pages.length < 2) return { pages, reassigned: [] };

  const parse = dfdParser.parse(xml, pages);
  const tree = buildPageTree({
    parsedPages: parse.pages,
    persistedPages: pages,
    elements: parse.elements,
    occurrences: parse.occurrences,
    homePages: computeHomePages(parse.occurrences),
  });
  const duplicates = findDuplicateDefinitions(
    parse.occurrences,
    previousOccurrences(input),
    tree.pages.map((page) => page.pageId),
  );
  if (duplicates.length === 0) return { pages, reassigned: [] };

  return giveFreshIdentities(
    pages,
    duplicates.flatMap((duplicate) => duplicate.reassign),
    parse.occurrences,
  );
}

function previousOccurrences(
  input: DuplicateReassignmentInput,
): ParsedOccurrence[] {
  if (!input.previousXml) return [];
  try {
    return dfdParser.parse(input.previousXml, input.previousPages).occurrences;
  } catch {
    // An unreadable previous state means "unknown" — tree order decides.
    return [];
  }
}
