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

import type { DFDConnection, DFDData, DFDElement } from "../models/dfd-types";

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
  subject: "element" | "flow";
  /** tfId of the element or flow. */
  id: string;
  /** displayId, else the tfId. */
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

/** The changes from `previous` to `current`; elements first, then flows. */
export function diffDfd(
  previous: Pick<DFDData, "elements" | "connections"> | null | undefined,
  current: Pick<DFDData, "elements" | "connections"> | null | undefined,
): DfdChange[] {
  return [
    ...diffRecords(previous?.elements ?? [], current?.elements ?? [], "element"),
    ...diffRecords(previous?.connections ?? [], current?.connections ?? [], "flow"),
  ];
}
