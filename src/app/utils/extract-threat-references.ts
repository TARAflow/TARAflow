// src/app/utils/extract-threat-references.ts
//
// The threats of one STRIDE method as the Risk tab sees them (ThreatReference):
// assets, proposed mitigations / verifications, anchors for the exposure level.
// Moved unchanged out of workspace-layout.tsx so the example generators
// (src/tests/examples) build risks the way the app does.

import type { StrideMethod, ThreatData } from "features/threats";
import { resolveMitigationDrafts, resolveVerificationDrafts } from "features/threats";
import type { ThreatReference } from "shared";
import { buildElementToAssetIds, resolveThreatAssetIds } from "./threat-asset-links";

export function extractThreatReferences(
  threatData: ThreatData | null | undefined,
  strideMethod: StrideMethod,
  assets: Parameters<typeof buildElementToAssetIds>[0],
  dfdElements: Parameters<typeof buildElementToAssetIds>[1],
): ThreatReference[] {
  if (!threatData) return [];

  const tables =
    strideMethod === "per-element"
      ? threatData.perElementTables
      : threatData.perInteractionTables;

  if (!tables || tables.length === 0) return [];

  const elementToAssetIds = buildElementToAssetIds(assets, dfdElements);

  const references: ThreatReference[] = [];
  for (const table of tables) {
    if (!table.threats || table.threats.length === 0) continue;
    for (const threat of table.threats) {
      let elementName: string | undefined;
      let dataFlowName: string | undefined;

      if (strideMethod === "per-element") {
        elementName =
          threat.linkedElement?.elementName ||
          threat.linkedElement?.elementId;
      } else {
        dataFlowName = threat.dataFlow?.dataFlowName;
        if (!dataFlowName && threat.dataFlow) {
          dataFlowName = `${threat.dataFlow.sourceName} → ${threat.dataFlow.targetName}`;
        }
      }

      const linkedAssetIds = resolveThreatAssetIds(threat, elementToAssetIds);

      references.push({
        id: threat.id,
        displayId: threat.displayId,
        strideCategory: threat.strideCategory,
        threatDescription: threat.threatDescription,
        attackDescription: threat.attackDescription,
        causeDescription: threat.causeDescription,
        linkedAssetIds,
        relevance: threat.relevance ?? "unrated",
        ...(threat.review ? { review: threat.review } : {}),
        proposedMitigations: resolveMitigationDrafts(
          threat.proposedMitigations ?? [],
        ).map((m) => ({
          id: m.id,
          text: m.text,
          notes: m.notes,
          isCustom: m.isCustom,
        })),
        proposedVerifications: resolveVerificationDrafts(
          threat.proposedVerifications ?? [],
        ).map((v) => ({
          id: v.id,
          text: v.text,
          notes: v.notes,
          isCustom: v.isCustom,
        })),
        sourceStrideMethod: strideMethod,
        elementName,
        dataFlowName,
        trustBoundaryId: table.displayIdentifier,
        trustBoundaryName: table.trustBoundaryName,
        // EL-anchor resolution (§11.1) reads the DFD's exposureLevel off the
        // threat's raw anchor: per-element (incl. a DataFlow-typed element,
        // STRIDE_PER_ELEMENT_TYPE.DataFlow = T,I,D) via linkedElement, and
        // per-interaction via dataFlow. These must survive onto the
        // ThreatReference or applyExposureLevelToFactorRatings has no anchor
        // to resolve and EN 50742 EL silently stays 0 in the Risk tab.
        linkedElement: threat.linkedElement ?? null,
        dataFlow: threat.dataFlow ?? null,
        // Table group of a flow between multiprocesses (D20): the attacked side.
        ...(threat.interactionContext?.victimRole
          ? { interactionContext: { victimRole: threat.interactionContext.victimRole } }
          : {}),
      });
    }
  }
  return references;
}
