// ==================== DRAW.IO PAGE LAYOUT ====================
// Phase 0 guard of the leveled-DFD design
// (leveled-dfd-multi-diagram-design.md §13).
//
// The DFD parsers read every <object> of the whole mxfile and ignore the
// <diagram> pages they belong to. A second page is therefore silently merged
// into one model (context copies become duplicate elements, geometry of
// different pages overlaps), and a compressed page is silently invisible.
// Until multi-page support exists (Phase 1+), such a layout must never reach
// the DFD model or the threat generators.
//
// Pure string inspection — no DOMParser — so it can run in the renderer, in
// pure services and in tests alike. Shared because both features/dfd (save /
// load / validation) and features/threats (generation / sync) need it and
// features must not import each other.

export interface DrawioPageLayout {
  /** Number of <diagram> pages. 0 = bare <mxGraphModel> (single page). */
  pageCount: number;
  /** Page names in document order ("" for unnamed pages). */
  pageNames: string[];
  /** Names of pages whose content is compressed (not an <mxGraphModel>). */
  compressedPageNames: string[];
  /** True if the parsers read this layout completely and correctly. */
  supported: boolean;
}

const EMPTY_LAYOUT: DrawioPageLayout = {
  pageCount: 0,
  pageNames: [],
  compressedPageNames: [],
  supported: true,
};

// <diagram ...>content</diagram> or <diagram .../>
const DIAGRAM_RE = /<diagram\b([^>]*?)(\/>|>([\s\S]*?)<\/diagram\s*>)/g;
const NAME_RE = /\bname\s*=\s*"([^"]*)"/;

function decodeXmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Inspect the page structure of a draw.io XML string.
 *
 * Supported = at most one page, and that page is uncompressed. An empty page
 * still counts as a page (a blank second page is a multi-page layout).
 */
export function inspectDrawioPages(
  xml: string | null | undefined,
): DrawioPageLayout {
  if (!xml || xml.trim() === "") return EMPTY_LAYOUT;

  const pageNames: string[] = [];
  const compressedPageNames: string[] = [];

  for (const match of xml.matchAll(DIAGRAM_RE)) {
    const attributes = match[1] ?? "";
    const content = match[3] ?? "";
    const nameMatch = NAME_RE.exec(attributes);
    const name = nameMatch ? decodeXmlAttribute(nameMatch[1]) : "";
    pageNames.push(name);

    const trimmed = content.trim();
    // Uncompressed pages carry an <mxGraphModel> element; compressed pages
    // carry base64 text. An empty page is uncompressed by definition.
    if (trimmed !== "" && !trimmed.startsWith("<")) {
      compressedPageNames.push(name);
    }
  }

  return {
    pageCount: pageNames.length,
    pageNames,
    compressedPageNames,
    supported: pageNames.length <= 1 && compressedPageNames.length === 0,
  };
}

/**
 * English one-line description for service error strings and logs.
 * The UI uses its own i18n keys; this text is never shown as a translation.
 */
export function describeUnsupportedPageLayout(
  layout: DrawioPageLayout,
): string {
  const parts: string[] = [];
  if (layout.pageCount > 1) {
    parts.push(
      `the diagram has ${layout.pageCount} pages (${formatNames(layout.pageNames)}); ` +
        "multiple pages are not supported yet",
    );
  }
  if (layout.compressedPageNames.length > 0) {
    parts.push(
      `compressed page(s) ${formatNames(layout.compressedPageNames)} cannot be read`,
    );
  }
  return parts.length > 0
    ? `Unsupported draw.io page layout: ${parts.join("; ")}.`
    : "";
}

function formatNames(names: string[]): string {
  return names.map((n) => (n === "" ? "<unnamed>" : `"${n}"`)).join(", ");
}
