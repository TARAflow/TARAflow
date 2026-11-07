// ==================== RISK DIALOG — useMitigationSelection ====================
// Split out of risk-dialog.tsx (MT-2): the mitigation catalog, selecting a mitigation
// with its linked verifications, and the DFD coverage of the proposals.

import { useMemo, useCallback } from "react";
import type { RiskDialogProps } from "./types";
import type { useRiskDialogState } from "./use-risk-dialog-state";
import { getAllMitigations } from "../../../threats/services/threat-catalog-service";
import { useMitigationCatalogVersion } from "shared/hooks/use-mitigation-catalog-version";
import { computeAllMitigationCoverage } from "shared";
import { mitigationSelectionKey, toSelectedMitigation } from "../../models/risk-mitigation-types";

export type UseMitigationSelectionInput = Pick<RiskDialogProps, "threats" | "dfdData"> &
  Pick<ReturnType<typeof useRiskDialogState>, "currentRisk" | "setLocal">;

export function useMitigationSelection({
  threats,
  dfdData,
  currentRisk,
  setLocal,
}: UseMitigationSelectionInput) {
  const catalogVersion = useMitigationCatalogVersion();
  // getAllMitigations() reads the catalog registry; catalogVersion changes
  // whenever the project mitigations change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mitigationCatalog = useMemo(() => getAllMitigations(), [catalogVersion]);

  // Custom (non-catalog) mitigations are selected as { notes } WITHOUT an id;
  // only catalog entries carry an id. See mitigationSelectionKey.
  const toggleMitigation = useCallback(
    (entry: { id?: string; notes?: string }) => {
      const key = mitigationSelectionKey(entry);
      const id = entry.id;
      setLocal((prev) => {
        if (!prev) return prev;
        const has = prev.selectedMitigations.some(
          (m) => mitigationSelectionKey(m) === key,
        );
        const updatedMitigations = has
          ? prev.selectedMitigations.filter(
              (m) => mitigationSelectionKey(m) !== key,
            )
          : [...prev.selectedMitigations, toSelectedMitigation(entry)];

        // Auto-select / auto-deselect linked verifications from catalog
        const catalogEntry = id
          ? mitigationCatalog.find((m) => m.id === id)
          : undefined;
        const linkedVerifications = catalogEntry?.verifications ?? [];

        let updatedVerifications = prev.selectedVerifications;
        if (!has && linkedVerifications.length > 0) {
          // Selecting: add verifications not already present
          const toAdd = linkedVerifications.filter(
            (v) => !updatedVerifications.includes(v),
          );
          updatedVerifications = [...updatedVerifications, ...toAdd];
        } else if (has && linkedVerifications.length > 0) {
          // Deselecting: remove verifications that were auto-linked
          // Keep any that are also linked by another currently-selected mitigation
          const otherSelectedIds = updatedMitigations.map((m) => m.id ?? "");
          const stillNeeded = new Set(
            otherSelectedIds.flatMap(
              (otherId) =>
                mitigationCatalog.find((m) => m.id === otherId)
                  ?.verifications ?? [],
            ),
          );
          updatedVerifications = updatedVerifications.filter(
            (v) => !linkedVerifications.includes(v) || stillNeeded.has(v),
          );
        }

        return {
          ...prev,
          selectedMitigations: updatedMitigations,
          selectedVerifications: updatedVerifications,
        };
      });
    },
    [mitigationCatalog],
  );

  // Coverage: check which mitigations are already implemented in DFD
  const mitigationCoverage = useMemo(() => {
    if (!currentRisk || !dfdData || !mitigationCatalog.length) return new Map();
    // ThreatReference (with linkedElement + dataFlow) satisfies ThreatForCoverage structurally
    const threat = threats?.find((t) => t.id === currentRisk.threatId);
    if (!threat) return new Map();
    const ids = (currentRisk.proposedMitigations ?? [])
      .map((m) => m.id ?? "")
      .filter(Boolean);
    return computeAllMitigationCoverage(
      ids,
      threat,
      dfdData,
      mitigationCatalog,
    );
  }, [currentRisk, dfdData, mitigationCatalog, threats]);

  return {
    mitigationCatalog,
    toggleMitigation,
    mitigationCoverage,
  };
}
