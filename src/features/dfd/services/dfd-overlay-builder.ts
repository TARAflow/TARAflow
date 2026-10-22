// ==================== DFD OVERLAY BUILDER ====================
// Pure function — no React, no side effects.
//
// Responsibility: Given a selected asset and the current draw.io base XML,
// produce overlay XML that highlights all DFD elements / connections that
// have that asset assigned.
//
// Highlighting strategy:
//   • Element:    colored stroke (asset group color) + floating badge above the cell
//                 Badge position is read from mxGeometry in the XML DOM — not from
//                 DFD React state — so it stays correct after unsaved moves.
//   • Connection: colored stroke; a filled badge on the middle of the line
//                 only when the flow IS the asset (is_an) — "transports",
//                 the common case, would clutter the diagram
//
// Leveled DFD (design §4): every page is kept and highlighted — a record
// is shown by its cells on all pages (definition and context copies, from
// the cell ↔ tfId index); before, only the first <diagram> was read and
// the overlay replaced the whole file with that one page.

import type { DFDAsset } from "../models/dfd-asset-types";
import type { DFDElement, DFDConnection } from "../models/dfd-types";
import { getAssetGroupColor } from "../models/dfd-formatters";
import type { CellRef } from "./leveled";

// ==================== INTERNAL TYPES ====================

interface OverlayTarget {
  /** Record id (tfId). */
  id: string;
  /** All relation type strings for this element → asset */
  relationTypes: string[];
  isConnection: boolean;
}

// ==================== XML DECOMPRESSION ====================

/**
 * Decompress draw.io diagram content.
 *
 * draw.io stores the <diagram> text content as base64(deflate-raw(encodeURIComponent(xml))).
 * If the content already starts with "<" it is uncompressed — return as-is.
 */
async function decompressDiagramContent(content: string): Promise<string> {
  const trimmed = content.trim();
  if (trimmed.startsWith("<")) return trimmed;

  const binary = atob(trimmed);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(bytes);
  writer.close();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const raw = new TextDecoder().decode(
    new Uint8Array(chunks.flatMap((c) => [...c])),
  );
  return decodeURIComponent(raw);
}

// ==================== STYLE HELPERS ====================

/**
 * Inject overlay stroke color + width into an existing mxCell style string.
 * Removes previous strokeColor / strokeWidth entries to avoid duplication.
 */
function injectStroke(existingStyle: string, color: string): string {
  const cleaned = existingStyle
    .replace(/strokeColor=[^;]+;?/g, "")
    .replace(/strokeWidth=[^;]+;?/g, "")
    .replace(/;;+/g, ";")
    .replace(/;$/, "");
  return `${cleaned};strokeColor=${color};strokeWidth=3;`;
}

// ==================== BADGE BUILDER ====================

const BADGE_HEIGHT = 16;
const BADGE_CHAR_WIDTH = 6;
const BADGE_PADDING = 12;
const BADGE_MIN_WIDTH = 50;

/**
 * Build an mxCell XML string for a floating label badge.
 * Positioned just above the target element.
 * Coordinates come from the XML DOM (mxGeometry), not React state.
 */
function buildBadgeXml(
  targetCellId: string,
  assetId: string,
  label: string,
  color: string,
  elementX: number,
  elementY: number,
  elementWidth: number,
  parentId: string,
  filled = false,
): string {
  const badgeId = `taraflow-overlay-badge-${targetCellId}-${assetId.replace(/[^a-z0-9]/gi, "")}`;
  const badgeWidth = Math.max(
    BADGE_MIN_WIDTH,
    label.length * BADGE_CHAR_WIDTH + BADGE_PADDING,
  );
  const badgeX = elementX + elementWidth / 2 - badgeWidth / 2;
  const badgeY = elementY - BADGE_HEIGHT - 3;

  const style = [
    "text",
    "html=1",
    "align=center",
    "verticalAlign=middle",
    `strokeColor=${color}`,
    `fontColor=${filled ? "#ffffff" : color}`,
    `fillColor=${filled ? color : "none"}`,
    "rounded=1",
    "arcSize=50",
    "fontSize=9",
    "fontStyle=1",
    "spacingLeft=3",
    "spacingRight=3",
    "whiteSpace=nowrap",
  ].join(";");

  return (
    `<mxCell id="${badgeId}" value="${escapeXmlAttr(label)}" ` +
    `style="${style};" vertex="1" parent="${parentId}">` +
    `<mxGeometry x="${badgeX}" y="${badgeY}" ` +
    `width="${badgeWidth}" height="${BADGE_HEIGHT}" as="geometry"/>` +
    `</mxCell>`
  );
}

function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ==================== MAIN EXPORT ====================

/**
 * Overlay of one asset on every page of `baseXml`. `cellsOf` gives the
 * cells that show a record (leveled DFD); without it, or when it knows no
 * cell, the record id is taken as the cell id on every page (classic).
 */
export async function buildOverlayXml(
  assetId: string,
  assets: DFDAsset[],
  elements: DFDElement[],
  connections: DFDConnection[],
  baseXml: string,
  cellsOf?: (tfId: string) => readonly CellRef[],
): Promise<string | null> {
  const asset = assets.find((a) => a.id === assetId);
  if (!asset) {
    console.warn("[buildOverlayXml] Asset not found:", assetId);
    return null;
  }

  const { color } = getAssetGroupColor(asset.assetGroup);

  // --- Collect all DFD items that reference this asset ---

  const targets: OverlayTarget[] = [];

  for (const el of elements) {
    const matching = (el.assetRelations ?? []).filter(
      (r) => r.assetId === assetId,
    );
    if (matching.length === 0) continue;
    targets.push({
      id: el.id,
      relationTypes: [...new Set(matching.map((r) => r.relationType))],
      isConnection: false,
    });
  }

  for (const conn of connections) {
    const matching = (conn.assetRelations ?? []).filter(
      (r) => r.assetId === assetId,
    );
    if (matching.length === 0) continue;
    targets.push({
      id: conn.id,
      relationTypes: [...new Set(matching.map((r) => r.relationType))],
      isConnection: true,
    });
  }

  if (targets.length === 0) {
    return null;
  }

  // --- Parse base XML ---

  const parser = new DOMParser();
  const mxfileDoc = parser.parseFromString(baseXml, "text/xml");

  const parseError = mxfileDoc.querySelector("parsererror");
  if (parseError) {
    console.error("[buildOverlayXml] Failed to parse base XML");
    return null;
  }

  const diagrams = Array.from(mxfileDoc.getElementsByTagName("diagram"));
  if (diagrams.length === 0) {
    console.error("[buildOverlayXml] No <diagram> element in base XML");
    return null;
  }

  // The cells of each target per page (a cell id is page-local).
  const cellsByPage = new Map<string | undefined, { target: OverlayTarget; cellId: string }[]>();
  for (const target of targets) {
    const cells = cellsOf?.(target.id) ?? [];
    if (cells.length === 0) {
      const all = cellsByPage.get(undefined) ?? [];
      cellsByPage.set(undefined, [...all, { target, cellId: target.id }]);
    }
    for (const cell of cells) {
      const onPage = cellsByPage.get(cell.pageId) ?? [];
      cellsByPage.set(cell.pageId, [...onPage, { target, cellId: cell.cellId }]);
    }
  }

  const pagesXml: string[] = [];
  for (const [index, diagramEl] of diagrams.entries()) {
    const diagramId = diagramEl.getAttribute("id") ?? `diagram-${index}`;
    const diagramName = diagramEl.getAttribute("name") ?? `Page-${index + 1}`;
    const graphXml = await overlayPage(
      parser,
      diagramEl,
      [...(cellsByPage.get(undefined) ?? []), ...(cellsByPage.get(diagramId) ?? [])],
      assetId,
      color,
    );
    if (graphXml === null) return null;
    pagesXml.push(
      `<diagram id="${escapeXmlAttr(diagramId)}" name="${escapeXmlAttr(diagramName)}">${graphXml}</diagram>`,
    );
  }

  return `<mxfile>${pagesXml.join("")}</mxfile>`;
}

/** The <mxGraphModel> of one page with the overlay applied, uncompressed. */
async function overlayPage(
  parser: DOMParser,
  diagramEl: Element,
  cells: { target: OverlayTarget; cellId: string }[],
  assetId: string,
  color: string,
): Promise<string | null> {
  // draw.io export with format:'xml' returns the diagram UNCOMPRESSED —
  // the <diagram> element contains <mxGraphModel> as a direct child element.
  // The autosave/load format uses COMPRESSED base64+deflate text content instead.
  // We must handle both cases.
  let graphDoc: Document;

  const existingGraphModel = diagramEl.querySelector("mxGraphModel");
  if (existingGraphModel) {
    // Uncompressed: <diagram> contains <mxGraphModel> as child element.
    const serializer = new XMLSerializer();
    const graphModelXml = serializer.serializeToString(existingGraphModel);
    graphDoc = parser.parseFromString(graphModelXml, "text/xml");
  } else {
    // Compressed: <diagram> text content is base64+deflate+encodeURIComponent.
    const rawContent = diagramEl.textContent ?? "";
    let decompressed: string;
    try {
      decompressed = await decompressDiagramContent(rawContent);
    } catch (err) {
      console.error("[buildOverlayXml] Decompression failed:", err);
      return null;
    }
    graphDoc = parser.parseFromString(decompressed, "text/xml");
  }

  const root = graphDoc.querySelector("root");
  if (!root) {
    console.error("[buildOverlayXml] No <root> element in parsed XML");
    return null;
  }

  // --- Apply overlay per target cell ---

  const badgesToAppend: string[] = [];

  for (const { target, cellId } of cells) {
    // draw.io wraps elements as <object id="..."><mxCell .../></object>.
    // The id lives on the <object> tag — mxCell[id=...] finds nothing.
    const container = root.querySelector(`[id="${cellId}"]`);
    if (!container) continue; // not on this page

    // mxCell is either the container itself (plain cells) or a child of <object>
    const cell = container.tagName === "mxCell"
      ? container
      : container.querySelector("mxCell") ?? container;

    // 1. Stroke override on the mxCell style
    const currentStyle = cell.getAttribute("style") ?? "";
    cell.setAttribute("style", injectStroke(currentStyle, color));

    // 2. Badge — position from mxGeometry, always inside mxCell
    if (target.isConnection) {
      if (!target.relationTypes.includes("is_an")) continue;
      const middle = edgeMiddle(root, cell);
      if (middle) {
        // Centred on the line: the badge sits BADGE_HEIGHT + 3 above "y".
        const y = middle.y + BADGE_HEIGHT / 2 + 3;
        badgesToAppend.push(buildBadgeXml(cellId, assetId, "is_an", color, middle.x, y, 0, "1", true));
      }
    } else {
      const geo = cell.querySelector("mxGeometry");
      if (geo) {
        const x = parseFloat(geo.getAttribute("x") ?? "0");
        const y = parseFloat(geo.getAttribute("y") ?? "0");
        const width = parseFloat(geo.getAttribute("width") ?? "100");
        const label = target.relationTypes.join(" · ");
        const parentId = cell.getAttribute("parent") ?? "1";
        badgesToAppend.push(
          buildBadgeXml(cellId, assetId, label, color, x, y, width, parentId),
        );
      }
    }
  }

  // Append all badges
  for (const badgeXml of badgesToAppend) {
    const wrapper = parser.parseFromString(
      `<root>${badgeXml}</root>`,
      "text/xml",
    );
    const badgeCell = wrapper.querySelector("mxCell");
    if (badgeCell) {
      root.appendChild(graphDoc.importNode(badgeCell, true));
    }
  }

  // --- Serialize ---

  const serializer = new XMLSerializer();
  // XMLSerializer prepends <?xml version="1.0"?> on document nodes.
  // draw.io rejects this inside <diagram> text content.
  return serializer.serializeToString(graphDoc).replace(/^<\?xml[^?]*\?>\s*/i, "");
}

// ==================== EDGE GEOMETRY ====================

interface Point {
  x: number;
  y: number;
}

const num = (el: Element | null | undefined, name: string) => parseFloat(el?.getAttribute(name) ?? "0") || 0;

function cellById(root: Element, id: string | null): Element | null {
  if (!id) return null;
  const container = root.querySelector(`[id="${id}"]`);
  if (!container) return null;
  return container.tagName === "mxCell" ? container : container.querySelector("mxCell");
}

/** Absolute offset of a cell's parent (vertices inside groups / containers). */
function parentOffset(root: Element, cell: Element): Point {
  const offset = { x: 0, y: 0 };
  const seen = new Set<string>();
  let parentId = cell.getAttribute("parent");
  while (parentId && parentId !== "0" && parentId !== "1" && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = cellById(root, parentId);
    if (!parent) break;
    const geo = parent.querySelector("mxGeometry");
    offset.x += num(geo, "x");
    offset.y += num(geo, "y");
    parentId = parent.getAttribute("parent");
  }
  return offset;
}

/** Centre of a vertex in absolute coordinates. */
function centreOf(root: Element, id: string | null): Point | null {
  const cell = cellById(root, id);
  const geo = cell?.querySelector("mxGeometry");
  if (!cell || !geo) return null;
  const offset = parentOffset(root, cell);
  return {
    x: offset.x + num(geo, "x") + num(geo, "width") / 2,
    y: offset.y + num(geo, "y") + num(geo, "height") / 2,
  };
}

/**
 * The point at half the length of an edge: source centre → waypoints →
 * target centre (or the edge's own source / target point when unconnected).
 */
function edgeMiddle(root: Element, edge: Element): Point | null {
  const geo = edge.querySelector("mxGeometry");
  const offset = parentOffset(root, edge);
  const own = (as: string): Point | null => {
    const p = geo?.querySelector(`:scope > mxPoint[as="${as}"]`);
    return p ? { x: offset.x + num(p, "x"), y: offset.y + num(p, "y") } : null;
  };
  const start = centreOf(root, edge.getAttribute("source")) ?? own("sourcePoint");
  const end = centreOf(root, edge.getAttribute("target")) ?? own("targetPoint");
  if (!start || !end) return null;
  const waypoints = Array.from(geo?.querySelectorAll(':scope > Array[as="points"] > mxPoint') ?? []).map((p) => ({
    x: offset.x + num(p, "x"),
    y: offset.y + num(p, "y"),
  }));
  const line = [start, ...waypoints, end];
  const lengths = line.slice(1).map((p, i) => Math.hypot(p.x - line[i].x, p.y - line[i].y));
  let rest = lengths.reduce((a, b) => a + b, 0) / 2;
  for (const [i, length] of lengths.entries()) {
    if (rest <= length && length > 0) {
      const t = rest / length;
      return { x: line[i].x + (line[i + 1].x - line[i].x) * t, y: line[i].y + (line[i + 1].y - line[i].y) * t };
    }
    rest -= length;
  }
  return start;
}

