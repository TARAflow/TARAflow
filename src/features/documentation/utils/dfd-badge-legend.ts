// ==================== DFD BADGE LEGEND ====================
// The legend of the marks the page images show (0.20): the EL badges at the
// top right of boundaries and interfaces and the yellow, dashed frame of the
// safety zone. They are display only and never stored in the diagram
// (patch 23), so the legend follows the model: the levels set on the
// elements, the zone mark, and what the app draws (DocProjectData.dfdMarks
// — the badge setting, EN 50742 for the zone). A page image saved before
// 0.20 has no marks yet; it gets them with the next save in the app.

import type { DocLanguage } from "../models/doc-types";
// Deep path: the generation path imports no barrel (depcruise-doc).
import { safetyZoneIds } from "../../../shared/models/property-visibility";
import type { StatsTable } from "./threat-risk-stats";

type Marks = { badges: boolean; en50742: boolean };

/** What the legend reads of a DFD element (structural — no import of the DFD feature). */
interface LegendElement {
  id: string;
  type: string;
  properties?: object;
}

const prop = (e: LegendElement, key: string): unknown => (e.properties as Record<string, unknown> | undefined)?.[key];
const isLevel = (v: unknown, prefix: "EL" | "PEL") => typeof v === "string" && new RegExp(`^${prefix}[0-4]$`).test(v);

/** The legend table, or undefined when the images show no mark. */
export function dfdBadgeLegend(
  elements: readonly LegendElement[] | undefined,
  marks: Marks | undefined,
  lang: DocLanguage,
): StatsTable | undefined {
  if (!elements || !marks) return undefined;
  const hasEl =
    marks.badges &&
    elements.some(
      (e) =>
        ((e.type === "TrustBoundary" || e.type === "ChipBoundary") && isLevel(prop(e, "defaultExposureLevel"), "EL")) ||
        (e.type === "Interface" && isLevel(prop(e, "exposureLevel"), "EL")),
    );
  const hasPel = marks.badges && elements.some((e) => e.type === "PhysicalBoundary" && isLevel(prop(e, "physicalExposureLevel"), "PEL"));
  // the shared helper decides what the zone is (property-visibility guard R-3)
  const hasZone = marks.en50742 && safetyZoneIds(elements as { id: string; type: string; properties?: Readonly<Record<string, unknown>> }[]).length > 0;
  if (!hasEl && !hasPel && !hasZone) return undefined;

  const de = lang === "de";
  const rows: string[][] = [];
  if (hasEl) {
    rows.push([
      "EL0 … EL4",
      de
        ? "Exposure Level einer Trust- oder Chip-Boundary (Vorgabe für ihre Interfaces) oder eines Interfaces (EN 50742 Anhang B)"
        : "Exposure level of a trust or chip boundary (default for its interfaces) or of an interface (EN 50742 Annex B)",
    ]);
  }
  if (hasPel) {
    rows.push([
      "PEL0 … PEL4",
      de ? "Physisches Exposure Level einer Physical Boundary" : "Physical exposure level of a physical boundary",
    ]);
  }
  if (hasZone) {
    rows.push([
      marks.badges ? "Safety · ELn" : de ? "gelber, gestrichelter Rahmen" : "yellow dashed frame",
      de
        ? "Trust Boundary, die als Safety-Zone markiert ist (gelb, gestrichelt): der sicherheitsrelevante Teil der Maschine"
        : "Trust boundary marked as the safety zone (yellow, dashed): the safety-related part of the machine",
    ]);
  }
  return {
    title: de ? "Legende zum Diagramm" : "Diagram legend",
    headers: de ? ["Markierung", "Bedeutung"] : ["Mark", "Meaning"],
    rows,
    total: [],
  };
}
