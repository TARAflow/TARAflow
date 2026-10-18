// ==================== DFD PREVIEW PAGES ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md §12.1, D18): the pages a
// DFD preview can show — one thumbnail per page, Top first. Undefined for a
// classic DFD (one page): the preview shows dfd.thumbnail as before.

export interface DFDPreviewPage {
  pageId: string;
  name: string;
  /** SVG data URL; absent while the page has no thumbnail yet. */
  thumbnail?: string;
}

interface PreviewSource {
  thumbnail?: string;
  pages?: readonly {
    pageId: string;
    name: string;
    order: number;
    decomposes?: string;
    thumbnail?: string;
  }[];
}

export function dfdPreviewPagesOf(
  dfd: PreviewSource | null | undefined,
): DFDPreviewPage[] | undefined {
  const pages = dfd?.pages;
  if (!pages || pages.length < 2) return undefined;
  const isRoot = (p: { decomposes?: string }) => p.decomposes === undefined;
  return [...pages]
    .sort(
      (a, b) =>
        Number(isRoot(b)) - Number(isRoot(a)) ||
        a.order - b.order ||
        a.name.localeCompare(b.name),
    )
    .map((p) => ({
      pageId: p.pageId,
      name: p.name || p.pageId,
      // The root page's thumbnail is mirrored in dfd.thumbnail.
      ...((p.thumbnail ?? (isRoot(p) ? dfd?.thumbnail : undefined))
        ? { thumbnail: p.thumbnail ?? dfd?.thumbnail }
        : {}),
    }));
}
