// ==================== REPORT THREATS ====================
// A risk's threat, for the risk chapters (group, element type, anchor): the
// project's own threats and those of its imported components. The imported
// ones are never stored — the app layer derives them from the snapshots
// (DocProjectData.computed.importedThreatRecords). Without them the risks of
// an imported component fell into "Not in the DFD" with the element type
// "-" (manual test 2026-11-17).

import type { DocProjectData } from "../models/doc-types";

type ReportThreat = NonNullable<DocProjectData["computed"]["importedThreatRecords"]>[number];

/** Threat id → threat: own threats (both methods) and imported ones. */
export function reportThreatsById(project: DocProjectData): Map<string, ReportThreat> {
  const own = [
    ...(project.threats?.perElementTables ?? []).flatMap((t) => t.threats),
    ...(project.threats?.perInteractionTables ?? []).flatMap((t) => t.threats),
  ];
  return new Map([...own, ...(project.computed.importedThreatRecords ?? [])].map((t) => [t.id, t]));
}
