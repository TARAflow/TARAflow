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
//   • Connection: colored stroke only (no stable anchor point for badge)

import type { DFDAsset } from "../models/dfd-asset-types";
import type { DFDElement, DFDConnection } from "../models/dfd-types";
import { getAssetGroupColor } from "../models/dfd-formatters";

// ==================== INTERNAL TYPES ====================

interface OverlayTarget {
  cellId: string;
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
    `fontColor=${color}`,
    "fillColor=none",
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

export async function buildOverlayXml(
  assetId: string,
  assets: DFDAsset[],
  elements: DFDElement[],
  connections: DFDConnection[],
  baseXml: string,
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
      cellId: el.id,
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
      cellId: conn.id,
      relationTypes: [...new Set(matching.map((r) => r.relationType))],
      isConnection: true,
    });
  }

  if (targets.length === 0) {
    return null;
  }

  // --- Parse and decompress base XML ---

  const parser = new DOMParser();
  const mxfileDoc = parser.parseFromString(baseXml, "text/xml");

  const parseError = mxfileDoc.querySelector("parsererror");
  if (parseError) {
    console.error("[buildOverlayXml] Failed to parse base XML");
    return null;
  }

  const diagramEl = mxfileDoc.querySelector("diagram");
  if (!diagramEl) {
    console.error("[buildOverlayXml] No <diagram> element in base XML");
    return null;
  }

  const diagramId = diagramEl.getAttribute("id") ?? "diagram";
  const diagramName = diagramEl.getAttribute("name") ?? "Page-1";

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

  // --- Apply overlay per target ---

  const badgesToAppend: string[] = [];

  for (const target of targets) {
    // draw.io wraps elements as <object id="..."><mxCell .../></object>.
    // The id lives on the <object> tag — mxCell[id=...] finds nothing.
    const container = root.querySelector(`[id="${target.cellId}"]`);
    if (!container) {
      console.warn("[buildOverlayXml] Element not found in XML for id:", target.cellId);
      continue;
    }

    // mxCell is either the container itself (plain cells) or a child of <object>
    const cell = container.tagName === "mxCell"
      ? container
      : container.querySelector("mxCell") ?? container;

    // 1. Stroke override on the mxCell style
    const currentStyle = cell.getAttribute("style") ?? "";
    cell.setAttribute("style", injectStroke(currentStyle, color));

    // 2. Badge — position from mxGeometry, always inside mxCell
    if (!target.isConnection) {
      const geo = cell.querySelector("mxGeometry");
      if (geo) {
        const x = parseFloat(geo.getAttribute("x") ?? "0");
        const y = parseFloat(geo.getAttribute("y") ?? "0");
        const width = parseFloat(geo.getAttribute("width") ?? "100");
        const label = target.relationTypes.join(" · ");
        const parentId = cell.getAttribute("parent") ?? "1";
        badgesToAppend.push(
          buildBadgeXml(target.cellId, assetId, label, color, x, y, width, parentId),
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

  // --- Serialize and wrap ---

  const serializer = new XMLSerializer();
  let newGraphXml = serializer.serializeToString(graphDoc);

  // XMLSerializer prepends <?xml version="1.0"?> on document nodes.
  // draw.io rejects this inside <diagram> text content.
  newGraphXml = newGraphXml.replace(/^<\?xml[^?]*\?>\s*/i, "");

  return `<mxfile><diagram id="${diagramId}" name="${escapeXmlAttr(diagramName)}">${newGraphXml}</diagram></mxfile>`;
}