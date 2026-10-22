// ==================== DFD DIFF ====================
// Leveled-DFD §11.3 (leveled-dfd-multi-diagram-design.md): what changed in
// the DFD between two saved states, each change classified —
//   semantic    the logical model: an element or flow added / removed,
//               its name, number, properties, a flow's endpoints,
//               `refines` / `abstract`
//   graphical   the drawing only (layout, context copies, page names)
//   structural  the page tree (pages added / removed)
//   identity    a cell's `tfId` changed (paste reassignment, adoption)
// Pure: compares the persisted records (and, for the drawing, the XML);
// the audit feature turns the changes into its change items. Classic and
// leveled DFDs alike.

import type { DFDConnection, DFDData, DFDElement, DFDPage } from "../models/dfd-types";
import { isLeveled } from "./build-dfd-graph";
import { parseDfd } from "./leveled/leveled-analysis";

export type DfdChangeCategory = "semantic" | "graphical" | "structural" | "identity";

export interface DfdFieldChange {
  /** Field path, e.g. "name" or "properties.refines". */
  field: string;
  before: unknown;
  after: unknown;
}

export interface DfdChange {
  kind: "added" | "removed" | "modified";
  category: DfdChangeCategory;
  /**
   * element / flow: a logical record; page: a page of the DFD; copies: the
   * context copies of one page; layout: positions and sizes on one page;
   * definition: an element's or flow's home page; identity: a cell's tfId.
   */
  subject: "element" | "flow" | "page" | "copies" | "layout" | "definition" | "identity";
  /** tfId of the element or flow; pageId of a page; page:cell of a cell. */
  id: string;
  /** displayId, else the tfId; for the drawing subjects their kind. */
  displayId: string;
  name: string;
  fields?: DfdFieldChange[];
}

/** Record fields that belong to the drawing, not the model (layout). */
const GRAPHICAL_FIELDS = new Set([
  "position",
  "size",
  "waypoints",
  "sourcePoint",
  "targetPoint",
  "offset",
  "curved",
  "arrow",
]);
/** Compared in the asset phase (the asset side mirrors them). */
const ELSEWHERE = new Set(["assetRelations"]);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Semantic field changes of a record; `properties` per key. */
function fieldChanges(before: object, after: object): DfdFieldChange[] {
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const out: DfdFieldChange[] = [];
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
  for (const key of keys) {
    if (GRAPHICAL_FIELDS.has(key) || ELSEWHERE.has(key)) continue;
    if (key === "properties") {
      const bp = (b.properties ?? {}) as Record<string, unknown>;
      const ap = (a.properties ?? {}) as Record<string, unknown>;
      for (const p of [...new Set([...Object.keys(bp), ...Object.keys(ap)])].sort()) {
        if (!same(bp[p], ap[p])) out.push({ field: `properties.${p}`, before: bp[p], after: ap[p] });
      }
      continue;
    }
    if (!same(b[key], a[key])) out.push({ field: key, before: b[key], after: a[key] });
  }
  return out;
}

function diffRecords<T extends DFDElement | DFDConnection>(
  before: readonly T[],
  after: readonly T[],
  subject: DfdChange["subject"],
): DfdChange[] {
  const prev = new Map(before.map((r) => [r.id, r]));
  const next = new Map(after.map((r) => [r.id, r]));
  const head = (r: T) => ({ subject, id: r.id, displayId: r.displayId || r.id, name: r.name ?? "" });
  const out: DfdChange[] = [];
  for (const r of after) {
    const old = prev.get(r.id);
    if (!old) {
      out.push({ kind: "added", category: "semantic", ...head(r) });
      continue;
    }
    const fields = fieldChanges(old, r);
    if (fields.length > 0) out.push({ kind: "modified", category: "semantic", ...head(r), fields });
  }
  for (const r of before) {
    if (!next.has(r.id)) out.push({ kind: "removed", category: "semantic", ...head(r) });
  }
  return out;
}

type DiffSource = Pick<DFDData, "elements" | "connections"> & Partial<Pick<DFDData, "xml" | "pages">>;

/**
 * The changes from `previous` to `current`: elements and flows, then — when
 * both sides carry their XML — pages, definitions, identities, context
 * copies and layout.
 */
export function diffDfd(
  previous: DiffSource | null | undefined,
  current: DiffSource | null | undefined,
): DfdChange[] {
  return [
    ...diffRecords(previous?.elements ?? [], current?.elements ?? [], "element"),
    ...diffRecords(previous?.connections ?? [], current?.connections ?? [], "flow"),
    ...(previous?.xml && current?.xml && drawingChanged(previous, current)
      ? diffDrawing(previous as DrawingSource, current as DrawingSource)
      : []),
  ];
}

/** The pages without their thumbnails (an export is not a change). */
const pageStructure = (pages: DiffSource["pages"]) =>
  JSON.stringify((pages ?? []).map(({ thumbnail: _thumbnail, ...page }) => page));

/** The XML or the page structure (links, names, decomposes) differ. */
const drawingChanged = (previous: DiffSource, current: DiffSource) =>
  previous.xml !== current.xml || pageStructure(previous.pages) !== pageStructure(current.pages);

// ==================== THE DRAWING (§11.3) ====================

type DrawingSource = DiffSource & { xml: string };

interface Drawing {
  pages: Map<string, { name: string; decomposes?: string }>;
  /** pageId:cellId → tfId */
  cells: Map<string, string>;
  /** tfId → pageId of its definition */
  home: Map<string, string>;
  /** pageId → tfIds shown there as context copies */
  copies: Map<string, Set<string>>;
  /** pageId:cellId → geometry (position, size; a flow's points) */
  geometry: Map<string, string>;
}

function drawingOf(source: DrawingSource): Drawing | undefined {
  let parse;
  try {
    const pages = isLeveled(source.xml) ? (source.pages as readonly DFDPage[] | undefined) : undefined;
    parse = parseDfd(source.xml, pages);
  } catch {
    return undefined; // unreadable XML (e.g. compressed): records only
  }
  const decomposes = new Map((source.pages ?? []).map((p) => [p.pageId, p.decomposes]));
  const drawing: Drawing = {
    pages: new Map(
      parse.pages.map((p) => [
        p.pageId,
        {
          name: p.name || p.pageId,
          ...(decomposes.get(p.pageId) ? { decomposes: decomposes.get(p.pageId) } : {}),
        },
      ]),
    ),
    cells: new Map(),
    home: new Map(),
    copies: new Map(),
    geometry: new Map(),
  };
  for (const o of parse.occurrences) {
    drawing.cells.set(`${o.pageId}:${o.cellId}`, o.tfId);
    if (o.role === "definition") drawing.home.set(o.tfId, o.pageId);
    else {
      const set = drawing.copies.get(o.pageId) ?? new Set<string>();
      set.add(o.tfId);
      drawing.copies.set(o.pageId, set);
    }
  }
  for (const page of parse.pageCells) {
    for (const e of page.elements) {
      drawing.geometry.set(`${page.pageId}:${e.id}`, JSON.stringify([e.position, e.size]));
    }
    for (const c of page.connections) {
      drawing.geometry.set(
        `${page.pageId}:${c.id}`,
        JSON.stringify([c.waypoints ?? null, c.sourcePoint ?? null, c.targetPoint ?? null]),
      );
    }
  }
  return drawing;
}

function diffDrawing(previous: DrawingSource, current: DrawingSource): DfdChange[] {
  const before = drawingOf(previous);
  const after = drawingOf(current);
  if (!before || !after) return [];

  const records = new Map<string, { displayId: string; name: string }>();
  const all = [...previous.elements, ...previous.connections, ...current.elements, ...current.connections];
  for (const r of all) {
    records.set(r.id, { displayId: r.displayId || r.id, name: r.name ?? "" });
  }
  const label = (tfId: string) => records.get(tfId)?.displayId ?? tfId;
  const pageName = (pageId: string) =>
    after.pages.get(pageId)?.name ?? before.pages.get(pageId)?.name ?? pageId;
  const pageLabel = (page: { name: string; decomposes?: string }) =>
    page.decomposes ? `${page.name} (decomposes ${label(page.decomposes)})` : page.name;
  const list = (ids: Iterable<string>) => [...ids].map(label).sort().join(", ");
  const out: DfdChange[] = [];

  // Pages: added / removed (structural), renamed (graphical), decomposing
  // another multiprocess (structural).
  for (const [pageId, page] of after.pages) {
    const old = before.pages.get(pageId);
    if (!old) {
      out.push({
        kind: "added",
        category: "structural",
        subject: "page",
        id: pageId,
        displayId: "Page",
        name: pageLabel(page),
      });
      continue;
    }
    if (old.name !== page.name) {
      out.push({
        kind: "modified",
        category: "graphical",
        subject: "page",
        id: pageId,
        displayId: "Page",
        name: pageLabel(page),
        fields: [{ field: "name", before: old.name, after: page.name }],
      });
    }
    if ((old.decomposes ?? null) !== (page.decomposes ?? null)) {
      out.push({
        kind: "modified",
        category: "structural",
        subject: "page",
        id: pageId,
        displayId: "Page",
        name: pageLabel(page),
        fields: [
          {
            field: "decomposes",
            before: old.decomposes && label(old.decomposes),
            after: page.decomposes && label(page.decomposes),
          },
        ],
      });
    }
  }
  for (const [pageId, page] of before.pages) {
    if (!after.pages.has(pageId)) {
      out.push({
        kind: "removed",
        category: "structural",
        subject: "page",
        id: pageId,
        displayId: "Page",
        name: pageLabel(page),
      });
    }
  }

  // Definition moved to another page (semantic: home page, boundaries).
  for (const [tfId, home] of after.home) {
    const old = before.home.get(tfId);
    if (old !== undefined && old !== home) {
      const r = records.get(tfId);
      out.push({
        kind: "modified", category: "semantic", subject: "definition", id: tfId,
        displayId: r?.displayId ?? tfId, name: r?.name ?? "",
        fields: [{ field: "home page", before: pageName(old), after: pageName(home) }],
      });
    }
  }

  // A cell's identity changed (paste reassignment, adoption).
  for (const [cell, tfId] of after.cells) {
    const old = before.cells.get(cell);
    if (old !== undefined && old !== tfId) {
      const pageId = cell.slice(0, cell.indexOf(":"));
      out.push({
        kind: "modified",
        category: "identity",
        subject: "identity",
        id: cell,
        displayId: "Identity",
        name: `cell ${cell.slice(cell.indexOf(":") + 1)} on ${pageName(pageId)}`,
        fields: [{ field: "shows", before: label(old), after: label(tfId) }],
      });
    }
  }

  // Context copies added / removed, per page (graphical).
  for (const pageId of new Set([...before.copies.keys(), ...after.copies.keys()])) {
    if (!after.pages.has(pageId) || !before.pages.has(pageId)) continue; // the page itself changed
    const was = before.copies.get(pageId) ?? new Set<string>();
    const is = after.copies.get(pageId) ?? new Set<string>();
    const added = [...is].filter((t) => !was.has(t));
    const removed = [...was].filter((t) => !is.has(t));
    if (added.length === 0 && removed.length === 0) continue;
    out.push({
      kind: "modified",
      category: "graphical",
      subject: "copies",
      id: pageId,
      displayId: "Context copies",
      name: pageName(pageId),
      fields: [
        ...(added.length ? [{ field: "added", before: undefined, after: list(added) }] : []),
        ...(removed.length ? [{ field: "removed", before: list(removed), after: undefined }] : []),
      ],
    });
  }

  // Layout: cells moved or resized, per page (graphical).
  const moved = new Map<string, Set<string>>();
  for (const [cell, geometry] of after.geometry) {
    const old = before.geometry.get(cell);
    if (old === undefined || old === geometry) continue;
    const pageId = cell.slice(0, cell.indexOf(":"));
    const tfId = after.cells.get(cell);
    if (!tfId) continue;
    const set = moved.get(pageId) ?? new Set<string>();
    set.add(tfId);
    moved.set(pageId, set);
  }
  for (const [pageId, tfIds] of moved) {
    out.push({
      kind: "modified", category: "graphical", subject: "layout", id: pageId, displayId: "Layout",
      name: pageName(pageId),
      fields: [{ field: "moved or resized", before: undefined, after: list(tfIds) }],
    });
  }
  return out;
}
