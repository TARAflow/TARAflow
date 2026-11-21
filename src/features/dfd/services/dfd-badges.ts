// src/features/dfd/services/dfd-badges.ts
//
// EL badges in the diagram (0.20, user 2026-11-21). The examples of
// EN 50742 write the exposure level next to a boundary or an interface;
// TARAflow shows it the same way:
//
//   - a small text at the top right of every trust, chip and physical
//     boundary and of every interface whose exposure level is set
//     (TB / chip: defaultExposureLevel, physical: physicalExposureLevel,
//     interface: exposureLevel) — on context copies too;
//   - the trust boundary marked as the safety zone (O18) is drawn yellow
//     and dashed, its badge reads "Safety · EL2" ("Safety" without an EL).
//
// The badge is an <object type="elbadge"> child cell of its element, like
// the ID labels. The app writes it; the side panel is the only place to
// change the value. In draw.io the badge cannot be edited, moved, resized
// or deleted. The parsers skip it (DFD_BADGE_TYPE).
//
// Deterministic: every call removes all badges and writes them anew from
// the element properties. The same input gives the same XML, so a second
// call changes nothing (no save, no audit churn). With the project setting
// off, the badges are removed. The safety-zone colours are restored as they
// were before the mark.
//
// Pure: XML in, XML out (DOMParser / XMLSerializer).

import { safetyZoneIds } from "shared";
import type { DFDPage } from "../models/dfd-types";
import { collectCellIdentities, identityOf } from "./parsers/identity-reader";
import { DFD_BADGE_TYPE } from "./parsers/xml-parser";

export { DFD_BADGE_TYPE };

/** Remembers a trust boundary's colours while it is drawn as the safety zone. */
const SAFETY_PREVIOUS_ATTR = "tfSafetyPrevious";

/** Yellow of the safety zone (the grey / yellow separation of machines). */
export const SAFETY_ZONE_COLOR = "#E6B800";

const BADGE_WIDTH = 90;
const BADGE_HEIGHT = 16;

/** Read-only text: draw.io may not edit, move, resize, delete or connect it. */
const BADGE_STYLE_BASE =
  "text;html=0;whiteSpace=nowrap;align=right;verticalAlign=middle;spacing=0;spacingRight=2;" +
  "fontSize=10;fontStyle=1;fillColor=none;strokeColor=none;" +
  "editable=0;movable=0;resizable=0;deletable=0;rotatable=0;cloneable=0;connectable=0;" +
  "locked=1;pointerEvents=0;";

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
  /** Project setting (absent = on). Off removes every badge. */
  enabled: boolean;
  /** EN 50742 project — only there a trust boundary can be the safety zone. */
  en50742: boolean;
}

/** The badge text of an element, or undefined for no badge. */
export function badgeText(xmlType: string, element: BadgeElement | undefined, en50742: boolean): string | undefined {
  const property = LEVEL_PROPERTY[xmlType];
  if (!property || !element) return undefined;
  const props = (element.properties ?? {}) as Record<string, unknown>;
  const raw = props[property];
  const level = typeof raw === "string" && /^P?EL[0-4]$/.test(raw) ? raw : undefined;
  if (xmlType === "trustboundary" && isSafetyZone(element, en50742)) return level ? `Safety · ${level}` : "Safety";
  return level;
}

function isSafetyZone(element: BadgeElement | undefined, en50742: boolean): boolean {
  if (!en50742 || !element) return false;
  // The shared helper decides what counts as the zone (property-visibility guard R-3).
  return safetyZoneIds([{ id: "", type: element.type, properties: element.properties as Readonly<Record<string, unknown>> | undefined }]).length > 0;
}

/**
 * Writes the badges and the safety-zone style into the diagram XML.
 * `elements` are keyed by tfId (dfd.elements); `pages` hold the identity
 * links of a leveled DFD (absent = one page, cell id = tfId).
 * Returns the input unchanged when nothing differs or the XML cannot be read.
 */
export function applyDfdBadges(
  xml: string,
  elements: ReadonlyMap<string, BadgeElement>,
  pages: readonly DFDPage[] | undefined,
  options: DfdBadgeOptions,
): string {
  if (!xml.trim()) return xml;
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return xml;

  let styleChanged = false;
  const before: string[] = [];
  const after: string[] = [];
  for (const { pageId, scope } of pageScopes(doc)) {
    const identities = collectCellIdentities(pages?.find((p) => p.pageId === pageId)?.links);
    const objects = Array.from(scope.getElementsByTagName("object"));

    // 1. Remove every badge (and a loose badge whose parent is gone).
    for (const obj of objects) {
      if (typeOf(obj) !== DFD_BADGE_TYPE) continue;
      before.push(badgeKey(pageId, obj));
      obj.parentNode?.removeChild(obj);
    }

    // Ids of the page without the old badges — a badge gets the same id again.
    const usedIds = new Set(
      Array.from(scope.getElementsByTagName("mxCell"))
        .concat(objects.filter((o) => typeOf(o) !== DFD_BADGE_TYPE))
        .map((c) => c.getAttribute("id") ?? "")
        .filter((id) => id !== ""),
    );
    for (const obj of objects) {
      const xmlType = typeOf(obj);
      if (!(xmlType in LEVEL_PROPERTY)) continue;
      const cellId = obj.getAttribute("id") ?? "";
      const cell = firstChildCell(obj);
      if (!cellId || !cell || cell.getAttribute("vertex") !== "1") continue;
      const element = elements.get(identityOf(identities, cellId).tfId);

      // 2. Safety-zone style on / off.
      if (xmlType === "trustboundary" && styleSafetyZone(obj, cell, isSafetyZone(element, options.en50742))) {
        styleChanged = true;
      }

      // 3. The badge.
      if (!options.enabled) continue;
      const text = badgeText(xmlType, element, options.en50742);
      if (!text) continue;
      const color = isSafetyZone(element, options.en50742) ? SAFETY_ZONE_COLOR : fontColorOf(cell);
      const badgeId = uniqueId(`${cellId}-elbadge`, usedIds);
      usedIds.add(badgeId);
      const badge = badgeObject(doc, badgeId, cellId, text, color, xmlType);
      obj.parentNode?.insertBefore(badge, obj.nextSibling);
      after.push(badgeKey(pageId, badge));
    }
  }
  // Same badges as before and no style change: keep the input as it is
  // (draw.io may format the XML differently than XMLSerializer).
  if (!styleChanged && sameList(before, after)) return xml;
  return new XMLSerializer().serializeToString(doc);
}

/** What makes a badge — compared to tell whether anything changed. */
function badgeKey(pageId: string, obj: Element): string {
  const cell = firstChildCell(obj);
  const geometry = cell?.getElementsByTagName("mxGeometry")[0];
  const offset = geometry?.getElementsByTagName("mxPoint")[0];
  const attrs = (el: Element | undefined, names: string[]) => names.map((n) => el?.getAttribute(n) ?? "").join(",");
  return [
    pageId,
    attrs(obj, ["id", "label"]),
    attrs(cell, ["parent", "style", "vertex", "connectable"]),
    attrs(geometry, ["x", "y", "width", "height", "relative"]),
    attrs(offset, ["x", "y"]),
  ].join("|");
}

function sameList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((v, i) => v === y[i]);
}

// ==================== SAFETY ZONE STYLE ====================

/** Sets or restores the yellow dashed border; true if the style changed. */
function styleSafetyZone(obj: Element, cell: Element, safety: boolean): boolean {
  const style = cell.getAttribute("style") ?? "";
  const previous = obj.getAttribute(SAFETY_PREVIOUS_ATTR);
  if (safety) {
    if (previous !== null) {
      // Already drawn as the zone — keep it (a user may have touched the colour).
      return false;
    }
    obj.setAttribute(
      SAFETY_PREVIOUS_ATTR,
      ["strokeColor", "fontColor", "dashed"].map((k) => `${k}=${styleValue(style, k) ?? ""}`).join(";"),
    );
    cell.setAttribute(
      "style",
      withStyle(style, { strokeColor: SAFETY_ZONE_COLOR, fontColor: SAFETY_ZONE_COLOR, dashed: "1" }),
    );
    return true;
  }
  if (previous === null) return false;
  const restore: Record<string, string | undefined> = {};
  for (const pair of previous.split(";")) {
    const at = pair.indexOf("=");
    if (at <= 0) continue;
    const value = pair.slice(at + 1);
    restore[pair.slice(0, at)] = value === "" ? undefined : value;
  }
  obj.removeAttribute(SAFETY_PREVIOUS_ATTR);
  cell.setAttribute("style", withStyle(style, restore));
  return true;
}

function styleValue(style: string, key: string): string | undefined {
  for (const part of style.split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at) === key) return part.slice(at + 1);
  }
  return undefined;
}

/** Sets (or, for undefined, removes) style keys; keeps the order of the others. */
function withStyle(style: string, values: Record<string, string | undefined>): string {
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
  return out.length > 0 ? `${out.join(";")};` : "";
}

// ==================== BADGE CELL ====================

function badgeObject(
  doc: Document,
  id: string,
  parentId: string,
  text: string,
  color: string,
  xmlType: string,
): Element {
  const obj = doc.createElement("object");
  obj.setAttribute("label", text);
  obj.setAttribute("type", DFD_BADGE_TYPE);
  obj.setAttribute("id", id);
  const cell = doc.createElement("mxCell");
  cell.setAttribute("connectable", "0");
  cell.setAttribute("parent", parentId);
  cell.setAttribute("style", `${BADGE_STYLE_BASE}fontColor=${color};`);
  cell.setAttribute("vertex", "1");
  const geometry = doc.createElement("mxGeometry");
  geometry.setAttribute("x", "1");
  geometry.setAttribute("y", "0");
  geometry.setAttribute("width", String(BADGE_WIDTH));
  geometry.setAttribute("height", String(BADGE_HEIGHT));
  geometry.setAttribute("relative", "1");
  geometry.setAttribute("as", "geometry");
  // Boundaries: inside the top right corner (the name sits top left).
  // Interfaces are small: above their top right corner.
  const offset = doc.createElement("mxPoint");
  offset.setAttribute("x", String(-BADGE_WIDTH));
  offset.setAttribute("y", String(xmlType === "interface" ? -BADGE_HEIGHT : 2));
  offset.setAttribute("as", "offset");
  geometry.appendChild(offset);
  cell.appendChild(geometry);
  obj.appendChild(cell);
  return obj;
}

function fontColorOf(cell: Element): string {
  const style = cell.getAttribute("style") ?? "";
  return styleValue(style, "fontColor") ?? styleValue(style, "strokeColor") ?? "#333333";
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
