// ==================== DISPLAY ORDER ====================
// One ordering for everything the analyst reads as a list: DFD elements,
// data flows, threats. Display ids are compared NATURALLY (DF-2 before DF-10),
// element kinds follow one fixed order, STRIDE follows S-T-R-I-D-E.
//
// Pure; no React, no feature imports.

/** Canonical order of element kinds in lists and tables. */
export const ELEMENT_TYPE_ORDER: readonly string[] = [
  "ExternalEntity",
  "Process",
  "Multiprocess",
  "DataStore",
  "DataFlow",
  "Interface",
  "PhysicalInterface",
  "TrustBoundary",
  "ChipBoundary",
  "PhysicalBoundary",
  "Sensor",
  "Actuator",
];

export const STRIDE_ORDER: readonly string[] = ["S", "T", "R", "I", "D", "E"];

function rank(order: readonly string[], value: string | undefined): number {
  const i = value === undefined ? -1 : order.indexOf(value);
  return i === -1 ? order.length : i;
}

/** Natural comparison of display ids; missing ids sort last. */
export function compareDisplayIds(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function compareElementTypes(
  a: string | undefined,
  b: string | undefined,
): number {
  return rank(ELEMENT_TYPE_ORDER, a) - rank(ELEMENT_TYPE_ORDER, b);
}

export function compareStride(a: string | undefined, b: string | undefined): number {
  return rank(STRIDE_ORDER, a) - rank(STRIDE_ORDER, b);
}

/** Element kind first, then natural display id (DF-1, DF-2 … DF-10). */
export function compareByTypeAndDisplayId(
  a: { type?: string; displayId?: string | null },
  b: { type?: string; displayId?: string | null },
): number {
  return (
    compareElementTypes(a.type, b.type) || compareDisplayIds(a.displayId, b.displayId)
  );
}
