// ==================== OVERVIEW DATA ====================
// What the Overview (and the Audit tab's verification panel) read: the
// items the Item Definition can link to, the assumption usage, the
// methodology summary, and the TARA verification hash / input / status.
// Split out of workspace-layout.tsx (MT-1).

import { useMemo } from "react";
import { regulationPresetFromTags, EMPTY_PROJECT_TAGS } from "shared";
import type { Project } from "../../models/project-types";
import { buildAssumptionUsage, buildItemModelItems } from "../../utils/build-item-model-items";
import { buildMethodologySummary } from "../../utils/build-methodology-summary";
import { buildVerificationChecklist } from "../../utils/build-verification-checklist";
import { verificationStateHash, verificationStatus } from "../../services/verification-state";

const today = () => new Date().toISOString().slice(0, 10);

export function useOverviewData(activeProject: Project | undefined) {
  const hasProject = !!activeProject;
  const dfd = activeProject?.dfd;
  const assets = activeProject?.assets;

  // What the Item Definition can link to (Overview → Definition, A-2).
  const itemModelItems = useMemo(
    () => (hasProject ? buildItemModelItems({ dfd: dfd ?? null, assets: assets ?? null }) : []),
    [hasProject, dfd, assets],
  );
  // Which trust boundaries rely on which assumption (A-3).
  const assumptionUsage = useMemo(
    () => (hasProject ? buildAssumptionUsage({ dfd: dfd ?? null }) : {}),
    [hasProject, dfd],
  );

  // Methodology sub-tab of the Overview (A-4): the record, read-only.
  const methodologySummary = useMemo(
    () => (activeProject ? buildMethodologySummary(activeProject) : undefined),
    // The record reads only the tags and the three configurations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeProject?.info?.tags,
      activeProject?.assets?.configuration,
      activeProject?.risks?.configuration,
      activeProject?.attackTrees?.configuration,
    ],
  );

  // TARA verification (plan Phase 4, decision 25): the hash of the current
  // analysis content, the checklist of a new entry, and — under iso-21434 —
  // the status the Overview shows.
  const verificationHash = useMemo(
    () => (activeProject ? verificationStateHash(activeProject) : ""),
    // Exactly the analysis content verificationStateHash covers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeProject?.info?.description,
      activeProject?.itemDefinition,
      activeProject?.hazards,
      activeProject?.dfd,
      activeProject?.assets,
      activeProject?.threats,
      activeProject?.attackTrees,
      activeProject?.risks,
      activeProject?.cybersecurityConcept,
    ],
  );

  // TARA verification (RQ-09-07) only under iso-21434 — the Audit tab shows
  // no verification panel otherwise (user 2026-10-30, amends decision 25).
  const tags = activeProject?.info?.tags;
  const isoMode = regulationPresetFromTags(tags ?? EMPTY_PROJECT_TAGS) === "iso-21434";
  const verificationInput = useMemo(
    () =>
      activeProject && isoMode
        ? {
            currentStateHash: verificationHash,
            checklist: buildVerificationChecklist(activeProject, today()),
            ...(activeProject.info?.version ? { projectVersion: activeProject.info.version } : {}),
          }
        : undefined,
    // The checklist follows the analysis content, which the hash stands for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verificationHash, activeProject?.info?.version, tags],
  );

  const verifications = activeProject?.cybersecurityConcept?.verifications;
  const maxAgeDays = activeProject?.audit?.config?.verificationMaxAgeDays;
  const verificationStatusValue = useMemo(
    () =>
      hasProject && isoMode
        ? verificationStatus(verifications, verificationHash, today(), maxAgeDays)
        : undefined,
    [hasProject, isoMode, verifications, verificationHash, maxAgeDays],
  );

  return {
    itemModelItems,
    assumptionUsage,
    methodologySummary,
    verificationInput,
    verificationStatus: verificationStatusValue,
  };
}
