// ==================== PHASE INDICATORS ====================
// The phase bar's badges and the Overview's phase progress: threat
// generation drift, the stored DFD validated now, hazard / risk findings,
// verification status, and the audit hints. Split out of
// workspace-layout.tsx (MT-1).

import { useMemo } from "react";
import type { TFunction } from "i18next";
import { EMPTY_PROJECT_TAGS, type AssetDataReference, type DFDReference } from "shared";
import { verificationStatusText } from "features/overview";
import { hazardValidator, hazardFindingLines } from "features/hazards";
import { dfdService, type DFDGraphAnalysisContext } from "features/dfd";
import { projectGenerationDrift, NO_DRIFT, type ThreatProjectData } from "features/threats";
import { riskFindingLines, riskFindings } from "features/risks";
import { useAuditHints } from "features/audit";
import type { Project } from "../../models/project-types";
import { phaseIndicators } from "../../utils/phase-indicators";
import type { verificationStatus } from "../../services/verification-state";

export interface PhaseIndicatorsInput {
  activeProject: Project | undefined;
  activePhase: number;
  /** The DFD tab's project object — validated as saved. */
  dfdTabProject: Parameters<typeof dfdService.validateSavedState>[0] | null;
  dfdContext: DFDGraphAnalysisContext | null;
  dfdGraphRef: unknown;
  dfdReference: DFDReference | null;
  /** Parts of imported components — no generated threats (patch 12). */
  excludedElementIds?: ReadonlySet<string>;
  assetDataRef: AssetDataReference | undefined;
  verificationStatus: ReturnType<typeof verificationStatus> | undefined;
  t: TFunction;
}

export function usePhaseIndicators({
  activeProject,
  activePhase,
  dfdTabProject,
  dfdContext,
  dfdGraphRef,
  dfdReference,
  excludedElementIds,
  assetDataRef,
  verificationStatus: verification,
  t,
}: PhaseIndicatorsInput) {
  // ── Threat generation drift (phase tab badge) ────────────────────────────
  // Same check as the Threats tab banner, evaluated here so the badge appears
  // right after e.g. a security-goal change in the Asset tab. Runs the threat
  // generator without writing — cheap for typical DFD sizes; memoized on the
  // inputs the generator reads.
  const threats = activeProject?.threats;
  const dfdElements = activeProject?.dfd?.elements;
  const dfdConnections = activeProject?.dfd?.connections;
  const tags = activeProject?.info?.tags;
  const threatDriftCounts = useMemo(() => {
    if (!activeProject?.threats || !dfdContext) return undefined;
    const driftProject = {
      id: activeProject.id,
      name: activeProject.info?.name || "",
      threats: activeProject.threats,
      phaseStatus: activeProject.phaseStatus,
      dfdElements: dfdElements ?? [],
      dfdConnections: dfdConnections ?? [],
      dfdGraph: dfdGraphRef,
      assetDataRef,
      dfd: dfdReference,
      info: { tags: tags ?? EMPTY_PROJECT_TAGS },
      ...(excludedElementIds ? { excludedElementIds } : {}),
      lastModified: "",
    } as unknown as ThreatProjectData;
    let drift = NO_DRIFT;
    try {
      drift = projectGenerationDrift(driftProject, dfdContext);
    } catch {
      // A badge must never break the workspace; the tab shows details.
    }
    return { obsolete: drift.obsolete.length, added: drift.addedCount };
    // The generator reads threats, the DFD, the tags and the references;
    // id, name and phaseStatus only label the call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threats, dfdElements, dfdConnections, tags, dfdContext, dfdGraphRef, assetDataRef, dfdReference, excludedElementIds]);

  // ── DFD validated now, not the validation stored in the file ─────────────
  const dfdSavedValidation = useMemo(
    () => (dfdTabProject ? dfdService.validateSavedState(dfdTabProject) : null),
    [dfdTabProject],
  );

  // ── Audit hints (user 2026-10-30): no audit repository for the project
  //    file, verification entries not committed — chip + tooltip ──────────
  const auditHints = useAuditHints({
    id: activeProject?.id ?? "",
    filePath: activeProject?.filePath,
    verificationIds: activeProject?.cybersecurityConcept?.verifications?.map((v) => v.id) ?? [],
    refreshKey: `${activePhase}|${activeProject?.audit?.lastModified ?? ""}`,
  });
  const auditHintLines = useMemo(() => {
    const lines: string[] = [];
    if (auditHints?.repoMissing) {
      lines.push(t("phases.audit.repoMissing", { defaultValue: "No audit repository for this project file — set it up in the Audit tab." }));
    }
    if (auditHints && auditHints.uncommittedVerifications > 0) {
      lines.push(
        t("phases.audit.uncommitted", {
          count: auditHints.uncommittedVerifications,
          defaultValue: "{{count}} TARA verification(s) not committed — commit in the Audit tab.",
        }),
      );
    }
    return lines;
  }, [auditHints, t]);

  // ── One computation keyed by PhaseId (tabs + Overview phase progress) ────
  const indicators = useMemo(
    () =>
      activeProject
        ? phaseIndicators({
            phaseStatus: activeProject.phaseStatus,
            info: activeProject.info,
            dfdValidation: dfdSavedValidation,
            dfdStatus: dfdSavedValidation ? dfdService.phaseStatusOf(dfdSavedValidation) : undefined,
            // The Hazard tab's validation, only where the phase is shown.
            hazardValidation:
              activeProject.info?.safetyRelevant && activeProject.hazards?.hazards.length
                ? hazardFindingLines(
                    hazardValidator.validate(activeProject.hazards, assetDataRef?.assets).findings,
                    t,
                  )
                : null,
            riskValidation: activeProject.risks?.risks?.length
              ? riskFindingLines(riskFindings(activeProject.risks), t)
              : null,
            threatDrift: threatDriftCounts,
            verification: verification
              ? { kind: verification.kind, text: verificationStatusText(verification, t) }
              : undefined,
            t,
          })
        : null,
    [activeProject, dfdSavedValidation, threatDriftCounts, assetDataRef, verification, t],
  );

  return { threatDriftCounts, auditHintLines, indicators };
}
