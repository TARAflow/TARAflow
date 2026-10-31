// ==================== ITEM DEFINITION FINDINGS ====================
// ISO/SAE 21434 conformance plan Phase 1 stage A, A-4 (decisions 8, 24): what
// the Definition sub-tab still lacks. The preset decides which sections are
// mandatory — under `iso-21434` the item boundary (RQ-09-01 a), the
// preliminary architecture (c) and the operational environment (RQ-09-02);
// other presets have no mandatory section (decision 8: EN 50742 and ETSI TVRA
// stay open, `standard` none). In every preset:
//   - the purpose (the project description) — the General phase needs it;
//   - an invalid assumption that a trust boundary still relies on;
//   - an open assumption past its review date (info);
//   - a link to a model item that no longer exists (info).
// Pure: no React, no i18n — the view renders the codes.

import type { ItemDefinition, ItemSectionId, RegulationPresetId } from "shared";

export type ItemFindingCode =
  | "ITEM_PURPOSE_MISSING"
  | "ITEM_SECTION_MISSING"
  | "ITEM_ASSUMPTION_INVALID_IN_USE"
  | "ITEM_ASSUMPTION_REVIEW_DUE"
  | "ITEM_LINK_REMOVED";

export interface ItemFinding {
  code: ItemFindingCode;
  severity: "warning" | "info";
  /** The requirement it comes from, e.g. "RQ-09-01 a" (iso-21434 only). */
  requirement?: string;
  section?: ItemSectionId;
  /** Assumption display id. */
  assumption?: string;
  /** Labels of the boundaries that rely on it. */
  boundaries?: readonly string[];
  /** Number of links to removed items. */
  count?: number;
}

/** Mandatory sections per preset, with the requirement they answer. */
const MANDATORY: Partial<Record<RegulationPresetId, readonly [ItemSectionId, string][]>> = {
  "iso-21434": [
    ["boundary", "RQ-09-01 a"],
    ["architecture", "RQ-09-01 c"],
    ["environment", "RQ-09-02"],
  ],
};

export interface ItemFindingsInput {
  description: string | undefined;
  itemDefinition: ItemDefinition | undefined;
  presetId: RegulationPresetId;
  /** assumption id → boundaries that link it */
  assumptionUsage?: Readonly<Record<string, readonly string[]>>;
  /** Ids of the model items that exist; absent = links are not checked. */
  modelItemIds?: ReadonlySet<string>;
  /** ISO date (YYYY-MM-DD) of today, for review dates. */
  today: string;
}

export function itemDefinitionFindings(input: ItemFindingsInput): ItemFinding[] {
  const def = input.itemDefinition;
  const iso = input.presetId === "iso-21434";
  const findings: ItemFinding[] = [];

  if (!input.description?.trim()) {
    findings.push({
      code: "ITEM_PURPOSE_MISSING",
      severity: "warning",
      section: "functions",
      ...(iso ? { requirement: "RQ-09-01 b" } : {}),
    });
  }

  for (const [section, requirement] of MANDATORY[input.presetId] ?? []) {
    const s = def?.sections[section];
    const filled = !!(s?.text?.trim() || s?.source?.document?.trim() || s?.modelRefs?.length);
    if (!filled) findings.push({ code: "ITEM_SECTION_MISSING", severity: "warning", section, requirement });
  }

  for (const a of def?.assumptions ?? []) {
    const users = input.assumptionUsage?.[a.id] ?? [];
    if (a.status === "invalid" && users.length > 0) {
      findings.push({
        code: "ITEM_ASSUMPTION_INVALID_IN_USE",
        severity: "warning",
        assumption: a.displayId,
        boundaries: users,
      });
    }
    if (a.status === "open" && a.reviewBy && a.reviewBy < input.today) {
      findings.push({ code: "ITEM_ASSUMPTION_REVIEW_DUE", severity: "info", assumption: a.displayId });
    }
  }

  if (input.modelItemIds && def) {
    for (const [section, s] of Object.entries(def.sections) as [ItemSectionId, { modelRefs?: string[] }][]) {
      const removed = (s?.modelRefs ?? []).filter((id) => !input.modelItemIds!.has(id)).length;
      if (removed > 0) findings.push({ code: "ITEM_LINK_REMOVED", severity: "info", section, count: removed });
    }
    const removedAssets = def.functions.filter(
      (f) => f.functionAssetId && !input.modelItemIds!.has(f.functionAssetId),
    ).length;
    if (removedAssets > 0) {
      findings.push({ code: "ITEM_LINK_REMOVED", severity: "info", section: "functions", count: removedAssets });
    }
  }

  return findings;
}
