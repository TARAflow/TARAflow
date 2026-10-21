// ==================== DFD SCOPE ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md §10, Phase 6f): the
// threat and risk tables filtered by page — the elements and flows shown
// on it, definitions and context copies, optionally with its sub-pages —
// and by analysis state (flows analysed on a parent level, §6.5). Computed
// by the DFD feature with the table groups, consumed by the tabs as a plain
// structure.

export interface DfdScopePage {
  pageId: string;
  name: string;
  /** 0 for the root page. */
  depth: number;
}

export interface DfdScopeIndex {
  /** Placed pages in page-tree order. */
  pages: DfdScopePage[];
  /** pageId → tfIds of the elements and flows shown on it. */
  itemsOnPage: Record<string, string[]>;
  /** pageId → its child pages. */
  childPages: Record<string, string[]>;
  /** tfIds of the flows analysed on a parent level (state "fallback"). */
  parentLevelFlows: string[];
}

export interface DfdScopeFilter {
  /** "" = all pages. */
  pageId: string;
  withSubPages: boolean;
  parentLevelOnly: boolean;
}

export const NO_DFD_SCOPE_FILTER: DfdScopeFilter = {
  pageId: "",
  withSubPages: false,
  parentLevelOnly: false,
};

export const isDfdScopeFilterActive = (filter: DfdScopeFilter): boolean =>
  filter.pageId !== "" || filter.parentLevelOnly;

/** The page and, transitively, its sub-pages. */
export function pageWithSubPages(index: DfdScopeIndex, pageId: string): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    if (out.includes(id)) return;
    out.push(id);
    for (const child of index.childPages[id] ?? []) visit(child);
  };
  visit(pageId);
  return out;
}

/**
 * Whether a DFD item (the element or flow of a threat) passes the filter;
 * undefined when nothing is filtered. A flow reference wins over the
 * element (a flow threat may also name an element), as for the groups.
 */
export function dfdScopePredicate(
  index: DfdScopeIndex | undefined,
  filter: DfdScopeFilter,
): ((ref: { elementId?: string | null; connectionId?: string | null }) => boolean) | undefined {
  if (!index || !isDfdScopeFilterActive(filter)) return undefined;
  const pages = filter.pageId
    ? filter.withSubPages
      ? pageWithSubPages(index, filter.pageId)
      : [filter.pageId]
    : undefined;
  const shown = pages && new Set(pages.flatMap((p) => index.itemsOnPage[p] ?? []));
  const parentLevel = filter.parentLevelOnly ? new Set(index.parentLevelFlows) : undefined;
  return (ref) => {
    const id = ref.connectionId || ref.elementId;
    if (!id) return false;
    if (shown && !shown.has(id)) return false;
    if (parentLevel && !parentLevel.has(id)) return false;
    return true;
  };
}
