// ==================== DFD STATISTICS TABLE ====================
// The statistics of the DFD chapter: one row per element type present, the
// data flows, and the total as the sum of the rows. Before, five fixed rows
// (external entities, processes, data stores, flows, trust boundaries) were
// shown with dfd.stats.totalElements as "Total" — a number that left out
// the flows and counted multiprocesses, sensors, interfaces … without a row
// (Headlamp: rows 16, total 20).

// Deep paths: the generation path imports no feature barrel (depcruise-doc).
import type { DFDData } from "../../dfd/models/dfd-types";
import type { DFDElementType } from "../../dfd/models/dfd-element-types";
import { getDFDElementTypePluralText } from "../../dfd/models/dfd-formatters";
import type { DocLanguage } from "../models/doc-types";
import type { StatsTable } from "./threat-risk-stats";

type TranslateFn = (key: string, defaultValue?: string) => string;

const TYPE_ORDER: DFDElementType[] = [
  "ExternalEntity",
  "Process",
  "Multiprocess",
  "DataStore",
  "Sensor",
  "Actuator",
  "Interface",
  "TrustBoundary",
  "ChipBoundary",
  "PhysicalBoundary",
];

export function dfdStatsTable(
  dfd: Pick<DFDData, "elements" | "connections">,
  lang: DocLanguage,
  t: TranslateFn,
): StatsTable {
  const de = lang === "de";
  const counts = new Map<DFDElementType, number>();
  for (const e of dfd.elements ?? []) {
    if (e.type === "DataFlow") continue;
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  }
  const types = [
    ...TYPE_ORDER.filter((type) => counts.has(type)),
    ...[...counts.keys()].filter((type) => !TYPE_ORDER.includes(type)),
  ];
  const flows = dfd.connections?.length ?? 0;
  const rows = [
    ...types.map((type) => [getDFDElementTypePluralText(type, t), String(counts.get(type))]),
    [de ? "Datenflüsse" : "Data Flows", String(flows)],
  ];
  const total = rows.reduce((sum, [, n]) => sum + Number(n), 0);
  return {
    title: de ? "DFD-Statistiken" : "DFD Statistics",
    headers: de ? ["Element-Typ", "Anzahl"] : ["Element Type", "Count"],
    rows,
    total: [de ? "Gesamt" : "Total", String(total)],
  };
}
