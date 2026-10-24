// ==================== THREAT / RISK STATISTICS ====================
// The statistics of the report's threat and risk chapters (2026-10-22,
// analyst): below the chapter title a table per element type — threats per
// STRIDE category, risks per risk level before mitigation — with a total
// row; for a leveled DFD one summary line below each group heading
// ("44 threats — S 2 · T 10 · …", "17 risks — Critical 2 · High 9 · …").
// Classic and leveled DFDs alike.

import type { DocLanguage } from "../models/doc-types";
import type { RiskRoundingMethod, RiskScaleType } from "../../risks/models/risk-scale-types";
import { RISK_SCALES, getRiskLabel } from "../../risks/models/risk-scale-types";

export interface StatsTable {
  /** Section title where a format needs one (StrictDoc). */
  title: string;
  headers: string[];
  rows: string[][];
  total: string[];
}

/** The element fields of a threat the statistics read. */
export interface StatsThreat {
  strideCategory: string;
  linkedElement?: { elementType?: string } | null;
  dataFlow?: unknown;
}

export interface StatsRisk {
  calculatedRiskBeforeMitigation: number;
  /** ISO/SAE 21434 risk value (3a); used instead of `I × L` when scale.iso. */
  isoRisk?: { value: number };
}

const STRIDE = ["S", "T", "R", "I", "D", "E"] as const;

/** Element types in the order of the DFD palette; others after them. */
const TYPE_ORDER = [
  "ExternalEntity",
  "Process",
  "Multiprocess",
  "DataStore",
  "DataFlow",
  "Interface",
  "Sensor",
  "Actuator",
  "TrustBoundary",
  "PhysicalBoundary",
  "ChipBoundary",
];

const TEXT = {
  en: {
    statistics: "Statistics",
    type: "Element type",
    threats: "Threats",
    risks: "Risks",
    total: "Total",
    unrated: "Not rated",
    threatsLine: (n: number) => `${n} ${n === 1 ? "threat" : "threats"}`,
    risksLine: (n: number) => `${n} ${n === 1 ? "risk" : "risks"}`,
    level: (label: string) => label,
  },
  de: {
    statistics: "Statistik",
    type: "Element-Typ",
    threats: "Bedrohungen",
    risks: "Risiken",
    total: "Gesamt",
    unrated: "Nicht bewertet",
    threatsLine: (n: number) => `${n} ${n === 1 ? "Bedrohung" : "Bedrohungen"}`,
    risksLine: (n: number) => `${n} ${n === 1 ? "Risiko" : "Risiken"}`,
    level: (label: string) =>
      ({ Low: "Niedrig", Medium: "Mittel", High: "Hoch", "Very High": "Sehr hoch", Critical: "Kritisch" })[
        label
      ] ?? label,
  },
} as const;

/** The element type a threat's statistics row is: its flow, else its element. */
export const threatElementType = (threat: StatsThreat): string =>
  threat.dataFlow ? "DataFlow" : (threat.linkedElement?.elementType ?? "-");

const byTypeOrder = (a: string, b: string) => {
  const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b);
  return (ia < 0 ? TYPE_ORDER.length : ia) - (ib < 0 ? TYPE_ORDER.length : ib) || a.localeCompare(b);
};

function groupByType<T>(items: readonly T[], typeOf: (item: T) => string): [string, T[]][] {
  const byType = new Map<string, T[]>();
  for (const item of items) {
    const type = typeOf(item);
    byType.set(type, [...(byType.get(type) ?? []), item]);
  }
  return [...byType].sort(([a], [b]) => byTypeOrder(a, b));
}

const strideCounts = (threats: readonly StatsThreat[]) =>
  STRIDE.map((c) => threats.filter((t) => t.strideCategory === c).length);

export function threatStatsTable(
  threats: readonly StatsThreat[],
  lang: DocLanguage,
  typeLabel: (type: string) => string,
): StatsTable {
  const text = TEXT[lang];
  return {
    title: text.statistics,
    headers: [text.type, text.threats, ...STRIDE],
    rows: groupByType(threats, threatElementType).map(([type, list]) => [
      typeLabel(type),
      String(list.length),
      ...strideCounts(list).map(String),
    ]),
    total: [text.total, String(threats.length), ...strideCounts(threats).map(String)],
  };
}

/** "44 threats — S 2 · T 10 · R 3 · I 8 · D 10 · E 2" */
export function threatGroupSummary(threats: readonly StatsThreat[], lang: DocLanguage): string {
  const counts = strideCounts(threats);
  return `${TEXT[lang].threatsLine(threats.length)} — ${STRIDE.map((c, i) => `${c} ${counts[i]}`).join(" · ")}`;
}

interface RiskScale {
  scale: RiskScaleType;
  roundingMethod?: RiskRoundingMethod;
  /** iso-21434: count the risk values 1–5 (labelled "4 – High"), not `I × L`. */
  iso?: boolean;
}

/** ISO risk value words — display only (decision 23); not the RISK_SCALES labels. */
const ISO_VALUE_WORDS = {
  en: ["Minimal", "Low", "Medium", "High", "Critical"],
  de: ["Minimal", "Niedrig", "Mittel", "Hoch", "Kritisch"],
} as const;

/** Counts per level, highest first, then "not rated". */
function levelCounts(
  risks: readonly StatsRisk[],
  { scale, roundingMethod, iso }: RiskScale,
  lang: DocLanguage = "en",
) {
  if (iso) {
    const values = [5, 4, 3, 2, 1];
    const levels = values.map((v) => `${v} – ${ISO_VALUE_WORDS[lang][v - 1]}`);
    const counts = values.map((v) => risks.filter((r) => r.isoRisk?.value === v).length);
    const unrated = risks.filter((r) => !r.isoRisk?.value).length;
    return { levels, counts, unrated };
  }
  const levels = [...RISK_SCALES[scale].levels].reverse().map((l) => l.label);
  const counts = new Map<string, number>(levels.map((l) => [l, 0]));
  let unrated = 0;
  for (const r of risks) {
    const label = getRiskLabel(r.calculatedRiskBeforeMitigation, scale, roundingMethod);
    if (counts.has(label)) counts.set(label, counts.get(label)! + 1);
    else unrated++;
  }
  return { levels, counts: levels.map((l) => counts.get(l)!), unrated };
}

export function riskStatsTable<R extends StatsRisk>(
  risks: readonly R[],
  typeOf: (risk: R) => string,
  scale: RiskScale,
  lang: DocLanguage,
  typeLabel: (type: string) => string,
): StatsTable {
  const text = TEXT[lang];
  const all = levelCounts(risks, scale, lang);
  const withUnrated = all.unrated > 0;
  const cells = (list: readonly StatsRisk[]) => {
    const c = levelCounts(list, scale, lang);
    return [...c.counts.map(String), ...(withUnrated ? [String(c.unrated)] : [])];
  };
  return {
    title: text.statistics,
    headers: [
      text.type,
      text.risks,
      ...all.levels.map(text.level),
      ...(withUnrated ? [text.unrated] : []),
    ],
    rows: groupByType(risks, typeOf).map(([type, list]) => [typeLabel(type), String(list.length), ...cells(list)]),
    total: [text.total, String(risks.length), ...cells(risks)],
  };
}

/** "17 risks — Critical 2 · High 9 · Medium 6" (levels with risks only). */
export function riskGroupSummary(risks: readonly StatsRisk[], scale: RiskScale, lang: DocLanguage): string {
  const text = TEXT[lang];
  const c = levelCounts(risks, scale, lang);
  const parts = c.levels
    .map((l, i) => [text.level(l), c.counts[i]] as const)
    .filter(([, n]) => n > 0)
    .map(([l, n]) => `${l} ${n}`);
  if (c.unrated > 0) parts.push(`${text.unrated} ${c.unrated}`);
  return parts.length > 0 ? `${text.risksLine(risks.length)} — ${parts.join(" · ")}` : text.risksLine(risks.length);
}
