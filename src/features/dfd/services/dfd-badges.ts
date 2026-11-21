// src/features/dfd/services/dfd-badges.ts
//
// EL badges and the safety-zone mark in the diagram (0.20). The examples of
// EN 50742 write the exposure level next to a boundary or an interface;
// TARAflow shows it the same way:
//
//   - a small text at the top right of every trust, chip and physical
//     boundary and of every interface whose exposure level is set
//     (TB / chip: defaultExposureLevel, physical: physicalExposureLevel,
//     interface: exposureLevel) — on context copies too;
//   - the trust boundary marked as the safety zone (O18) gets a yellow,
//     dashed frame over its border; its badge reads "Safety · EL2".
//
// Display only, never stored (patch 23, review 2026-11-21): the badges and
// the zone frame are cells the app puts into the EDITOR's diagram; every
// save takes them out again (stripDfdBadges in dfdService), and so does the
// component snapshot hash. A project file therefore never changes by
// opening it, and a component's content hash does not depend on them. The
// page images the app exports from the editor show them.
//
// Both directions are textual — no DOM serialisation of the whole diagram —
// so strip(apply(xml)) gives back exactly the input, byte for byte, and the
// draw.io formatting of a stored file stays as it is. stripDfdBadges also
// matches the cells in draw.io's own export (other attribute order,
// indentation), and it repairs files saved by an earlier 0.20 build (badges
// in the file; the zone drawn by restyling the boundary, tfSafetyPrevious).
//
// The cells are <object type="elbadge"> / <object type="elzone"> children
// of their element, like the ID labels: read-only in draw.io (style flags,
// locked, no pointer events), skipped by every parser (DFD_DECORATION_TYPES).

import { safetyZoneIds } from "shared";
import type { DFDPage } from "../models/dfd-types";
import { collectCellIdentities, identityOf } from "./parsers/identity-reader";
import { DFD_BADGE_TYPE, DFD_ZONE_TYPE } from "./parsers/xml-parser";

export { DFD_BADGE_TYPE, DFD_ZONE_TYPE };

/** Yellow of the safety zone (the grey / yellow separation of machines). */
export const SAFETY_ZONE_COLOR = "#E6B800";

/** Attribute an earlier 0.20 build left on a restyled safety zone. */
const LEGACY_SAFETY_ATTR = "tfSafetyPrevious";

const BADGE_WIDTH = 90;
const BADGE_HEIGHT = 16;

/** Read-only in draw.io: not editable, movable, resizable, deletable, selectable; clicks go through. */
const READ_ONLY =
  "editable=0;movable=0;resizable=0;deletable=0;rotatable=0;cloneable=0;connectable=0;selectable=0;locked=1;pointerEvents=0;";

const BADGE_STYLE_BASE =
  "text;html=0;whiteSpace=nowrap;align=right;verticalAlign=middle;spacing=0;spacingRight=2;" +
  "fontSize=10;fontStyle=1;fillColor=none;strokeColor=none;" +
  READ_ONLY;

const ZONE_STYLE = `rounded=0;fillColor=none;strokeColor=${SAFETY_ZONE_COLOR};dashed=1;strokeWidth=4;` + READ_ONLY;

/** The element types with a badge and the property that holds their level. */
const LEVEL_PROPERTY: Record<string, string> = {
  trustboundary: "defaultExposureLevel",
  chipboundary: "defaultExposureLevel",
  physicalboundary: "physicalExposureLevel",
  interface: "exposureLevel",
};

/** What the badges need of an element (by tfId). */
export interface BadgeElement {
  type: string;
  properties?: object;
}

export interface DfdBadgeOptions {
  /** Project setting (absent = on). Off: no badges; the zone frame stays. */
  enabled: boolean;
  /** EN 50742 project — only there a trust boundary can be the safety zone. */
  en50742: boolean;
  /**
   * The word before the level on the safety zone's badge, in the UI language
   * (i18n tabs.dfd.badges.safety; patch 24). Display only — never stored, so the
   * language of the diagram file does not depend on it. Default "Safety".
   */
  safetyLabel?: string;
}

/** The badge text of an element, or undefined for no badge. */
export function badgeText(
  xmlType: string,
  element: BadgeElement | undefined,
  en50742: boolean,
  safetyLabel = "Safety",
): string | undefined {
  const property = LEVEL_PROPERTY[xmlType];
  if (!property || !element) return undefined;
  const props = (element.properties ?? {}) as Record<string, unknown>;
  const raw = props[property];
  const level = typeof raw === "string" && /^P?EL[0-4]$/.test(raw) ? raw : undefined;
  if (xmlType === "trustboundary" && isSafetyZone(element, en50742)) return level ? `${safetyLabel} · ${level}` : safetyLabel;
  return level;
}

/** The element is the safety zone the diagram marks (EN 50742 project, the shared helper). */
export function isSafetyZone(element: BadgeElement | undefined, en50742: boolean): boolean {
  if (!en50742 || !element) return false;
  // The shared helper decides what counts as the zone (property-visibility guard R-3).
  return safetyZoneIds([{ id: "", type: element.type, properties: element.properties as Readonly<Record<string, unknown>> | undefined }]).length > 0;
}

// ==================== STRIP ====================

/** An <object> of a decoration type with its content, and the line break + indentation before it. */
const DECORATION_OBJECT = new RegExp(
  `(?:\\r?\\n[ \\t]*)?<object\\b(?=[^>]*\\stype="(?:${DFD_BADGE_TYPE}|${DFD_ZONE_TYPE})")[^>]*>[\\s\\S]*?</object>`,
  "g",
);

/**
 * The diagram without badges and zone frames — what is stored and hashed.
 * Same string when there is nothing to take out.
 */
export function stripDfdBadges(xml: string): string {
  if (!xml || (!xml.includes(DFD_BADGE_TYPE) && !xml.includes(DFD_ZONE_TYPE) && !xml.includes(LEGACY_SAFETY_ATTR))) {
    return xml;
  }
  const stripped = xml.replace(DECORATION_OBJECT, "");
  return stripped.includes(LEGACY_SAFETY_ATTR) ? restoreLegacyZoneStyle(stripped) : stripped;
}

/**
 * Files of an earlier 0.20 build drew the zone by restyling the boundary and
 * kept its colours in tfSafetyPrevious ("strokeColor=#FF3333;fontColor=…;
 * dashed=1"). Put them back and drop the attribute.
 */
function restoreLegacyZoneStyle(xml: string): string {
  return xml.replace(
    /<object\b([^>]*?)\s+tfSafetyPrevious="([^"]*)"([^>]*)>(\s*<mxCell\b[^>]*?\sstyle=")([^"]*)(")/g,
    (_all, pre: string, previous: string, post: string, cellStart: string, style: string, quote: string) => {
      const restore: Record<string, string | undefined> = {};
      for (const pair of previous.split(";")) {
        const at = pair.indexOf("=");
        if (at <= 0) continue;
        const value = pair.slice(at + 1);
        restore[pair.slice(0, at)] = value === "" ? undefined : value;
      }
      return `<object${pre}${post}>${cellStart}${withStyle(style, restore)}${quote}`;
    },
  );
}

/** Sets (or, for undefined, removes) style keys; keeps the order of the others. */
function withStyle(style: string, values: Record<string, string | undefined>): string {
  const trailing = style.endsWith(";");
  const parts = style.split(";").filter((p) => p !== "");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const at = part.indexOf("=");
    const key = at > 0 ? part.slice(0, at) : part;
    if (key in values) {
      seen.add(key);
      if (values[key] !== undefined) out.push(`${key}=${values[key]}`);
    } else out.push(part);
  }
  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key) && value !== undefined) out.push(`${key}=${value}`);
  }
  return out.length > 0 ? `${out.join(";")}${trailing ? ";" : ""}` : "";
}

// ==================== APPLY ====================

/**
 * The editor's diagram with the badges and zone frames the properties ask
 * for. `elements` by tfId (dfd.elements); `pages` hold the identity links of
 * a leveled DFD (absent = one page, cell id = tfId). Starts from the
 * stripped diagram, so a second call gives the same string; returns the
 * input unchanged when it already shows exactly these marks.
 */
export function applyDfdBadges(
  xml: string,
  elements: ReadonlyMap<string, BadgeElement>,
  pages: readonly DFDPage[] | undefined,
  options: DfdBadgeOptions,
): string {
  if (!xml.trim()) return xml;
  const base = stripDfdBadges(xml);
  const doc = new DOMParser().parseFromString(base, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return xml;

  /** Text to insert after the closing tag of an object: page → cell id → text. */
  const inserts = new Map<string, Map<string, string>>();
  for (const { pageId, scope } of pageScopes(doc)) {
    const identities = collectCellIdentities(pages?.find((p) => p.pageId === pageId)?.links);
    const objects = Array.from(scope.getElementsByTagName("object"));
    const usedIds = new Set(
      Array.from(scope.getElementsByTagName("mxCell"))
        .concat(objects)
        .map((c) => c.getAttribute("id") ?? "")
        .filter((id) => id !== ""),
    );
    const pageInserts = new Map<string, string>();
    for (const obj of objects) {
      const xmlType = typeOf(obj);
      if (!(xmlType in LEVEL_PROPERTY)) continue;
      const cellId = obj.getAttribute("id") ?? "";
      const cell = firstChildCell(obj);
      if (!cellId || !cell || cell.getAttribute("vertex") !== "1") continue;
      const element = elements.get(identityOf(identities, cellId).tfId);
      const zone = xmlType === "trustboundary" && isSafetyZone(element, options.en50742);
      let text = "";
      if (zone) {
        const geometry = cell.getElementsByTagName("mxGeometry")[0];
        const id = uniqueId(`${cellId}-elzone`, usedIds);
        usedIds.add(id);
        text += zoneObject(id, cellId, Number(geometry?.getAttribute("width") ?? 0), Number(geometry?.getAttribute("height") ?? 0));
      }
      const label = options.enabled ? badgeText(xmlType, element, options.en50742, options.safetyLabel) : undefined;
      if (label) {
        const id = uniqueId(`${cellId}-elbadge`, usedIds);
        usedIds.add(id);
        const color = zone ? SAFETY_ZONE_COLOR : fontColorOf(cell);
        text += badgeObject(id, cellId, label, color, xmlType);
      }
      if (text) pageInserts.set(cellId, text);
    }
    if (pageInserts.size > 0) inserts.set(pageId, pageInserts);
  }

  if (inserts.size === 0) return base === xml ? xml : base;
  const next = insertAfterObjects(base, inserts);
  return next === xml ? xml : next;
}

/** Inserts each text right after the closing tag of its object, page by page. */
function insertAfterObjects(xml: string, inserts: Map<string, Map<string, string>>): string {
  const segments = pageSegments(xml);
  let out = "";
  let at = 0;
  for (const { pageId, start, end } of segments) {
    out += xml.slice(at, start);
    let page = xml.slice(start, end);
    for (const [cellId, text] of inserts.get(pageId) ?? []) {
      const open = new RegExp(`<object\\b(?=[^>]*\\sid="${escapeRegExp(escapeXml(cellId))}")[^>]*>`).exec(page);
      if (!open) continue;
      const close = page.indexOf("</object>", open.index + open[0].length);
      if (close < 0) continue;
      const after = close + "</object>".length;
      page = page.slice(0, after) + text + page.slice(after);
    }
    out += page;
    at = end;
  }
  return out + xml.slice(at);
}

/** The text range of each page (<diagram>); the whole string without pages. */
function pageSegments(xml: string): { pageId: string; start: number; end: number }[] {
  const result: { pageId: string; start: number; end: number }[] = [];
  const open = /<diagram\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(xml))) {
    const id = /\sid="([^"]*)"/.exec(m[0])?.[1] ?? "";
    const close = xml.indexOf("</diagram>", m.index);
    const end = close < 0 ? xml.length : close;
    result.push({ pageId: unescapeXml(id), start: m.index, end });
    open.lastIndex = end;
  }
  return result.length > 0 ? result : [{ pageId: "", start: 0, end: xml.length }];
}

// ==================== CELLS ====================

function badgeObject(id: string, parentId: string, text: string, color: string, xmlType: string): string {
  // Boundaries: inside the top right corner (the name sits top left).
  // Interfaces are small: above their top right corner.
  const offsetY = xmlType === "interface" ? -BADGE_HEIGHT : 2;
  return (
    `<object label="${escapeXml(text)}" type="${DFD_BADGE_TYPE}" id="${escapeXml(id)}">` +
    `<mxCell connectable="0" parent="${escapeXml(parentId)}" style="${BADGE_STYLE_BASE}fontColor=${color};" vertex="1">` +
    `<mxGeometry x="1" y="0" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" relative="1" as="geometry">` +
    `<mxPoint x="${-BADGE_WIDTH}" y="${offsetY}" as="offset"/></mxGeometry></mxCell></object>`
  );
}

/** A yellow dashed frame over the boundary's border (its own size, in its coordinates). */
function zoneObject(id: string, parentId: string, width: number, height: number): string {
  return (
    `<object label="" type="${DFD_ZONE_TYPE}" id="${escapeXml(id)}">` +
    `<mxCell connectable="0" parent="${escapeXml(parentId)}" style="${ZONE_STYLE}" vertex="1">` +
    `<mxGeometry x="0" y="0" width="${width}" height="${height}" as="geometry"/></mxCell></object>`
  );
}

function fontColorOf(cell: Element): string {
  const style = cell.getAttribute("style") ?? "";
  return styleValue(style, "fontColor") ?? styleValue(style, "strokeColor") ?? "#333333";
}

function styleValue(style: string, key: string): string | undefined {
  for (const part of style.split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at) === key) return part.slice(at + 1);
  }
  return undefined;
}

function uniqueId(base: string, used: ReadonlySet<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ==================== XML HELPERS ====================

function typeOf(obj: Element): string {
  return (obj.getAttribute("type") || obj.getAttribute("Type") || "").toLowerCase();
}

function firstChildCell(obj: Element): Element | undefined {
  return Array.from(obj.children).find((c) => c.tagName === "mxCell");
}

function pageScopes(doc: Document): { pageId: string; scope: Document | Element }[] {
  const diagrams = Array.from(doc.getElementsByTagName("diagram"));
  if (diagrams.length === 0) return [{ pageId: "", scope: doc }];
  return diagrams.flatMap((diagram) => {
    const model = diagram.getElementsByTagName("mxGraphModel")[0];
    return model ? [{ pageId: diagram.getAttribute("id") ?? "", scope: model }] : [];
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function unescapeXml(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
