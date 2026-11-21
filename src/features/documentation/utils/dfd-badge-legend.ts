// ==================== DFD BADGE LEGEND ====================
// The legend of the marks the app writes into the diagram (0.20): the EL
// badges at the top right of boundaries and interfaces and the yellow,
// dashed safety zone. Read from the stored diagram itself, so the legend
// names exactly what the figure shows — nothing if the project setting
// turned the badges off or no level is set.
//
// The marks are <object type="elbadge" label="EL2"> cells (DFD_BADGE_TYPE
// in dfd/services/parsers/xml-parser.ts) and the attribute tfSafetyPrevious
// on the safety zone (dfd-badges.ts). Kept as literals here: the generation
// path imports no DFD service (depcruise-doc).

import type { DocLanguage } from "../models/doc-types";
import type { StatsTable } from "./threat-risk-stats";

const BADGE_OBJECT = /<object\b[^>]*\btype="elbadge"[^>]*>/g;
const LABEL = /\blabel="([^"]*)"/;

/** The legend table, or undefined when the diagram holds no mark. */
export function dfdBadgeLegend(xml: string | undefined, lang: DocLanguage): StatsTable | undefined {
  if (!xml) return undefined;
  const labels = (xml.match(BADGE_OBJECT) ?? []).map((tag) => LABEL.exec(tag)?.[1] ?? "");
  const hasEl = labels.some((l) => /(^|\s)EL[0-4]$/.test(l));
  const hasPel = labels.some((l) => /^PEL[0-4]$/.test(l));
  const hasZone = labels.some((l) => l.startsWith("Safety")) || xml.includes("tfSafetyPrevious=");
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
      "Safety · ELn",
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
