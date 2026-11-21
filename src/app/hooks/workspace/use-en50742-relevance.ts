// ==================== EN 50742 RELEVANCE OF THE RISKS ====================
// O17 / O18 (user 2026-11-20): in an EN 50742 project only the risks whose
// threat sits on a relevant interface or data flow — crossing the safety
// zone, else on a path to a safety function — get EL, attacker capability,
// WoO and an SRSL. The Risk tab gets the decision with its reason on every
// threat reference (ThreatReference.en50742); the risk feature applies it.

import { useCallback, useMemo } from "react";
import type { TFunction } from "i18next";
import { EMPTY_PROJECT_TAGS, en50742ApproachFromTags, type ThreatReference } from "shared";
import type { Project } from "../../models/project-types";
import { prepareProjectCompliance } from "../../services/compliance-report";
import { srslOpenRiskIds } from "features/compliance";
import {
  attackPathExposureLevel,
  dfdRefResolver,
  threatIsolation,
  threatIsolationText,
  threatRelevance,
  threatRelevanceText,
} from "../../utils/en50742-relevance";

export function useEn50742Relevance(project: Project | undefined, t: TFunction) {
  // A or B tag, whatever the base method (0.20: also with ETSI TVRA)
  const en50742 = en50742ApproachFromTags(project?.info?.tags ?? EMPTY_PROJECT_TAGS) !== undefined;
  const dfd = project?.dfd;
  const assets = project?.assets;
  const prepared = useMemo(
    () => (project && en50742 ? prepareProjectCompliance(project) : undefined),
    // The relevance reads the DFD (zones, flows, interfaces) and the
    // safety-function assets — not the threats, risks or ratings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [en50742, dfd, assets],
  );
  const relevance = useMemo(() => prepared?.en50742Relevance(), [prepared]);
  // Patch 22: SRSL0 only for a completely isolated safety function.
  const isolation = useMemo(() => prepared?.en50742Isolation(), [prepared]);

  const labelOf = useMemo(() => {
    const labels = new Map<string, string>();
    for (const e of [...(dfd?.elements ?? []), ...(dfd?.connections ?? [])] as { id: string; displayId?: string; name?: string; label?: string }[]) {
      labels.set(e.id, [e.displayId, e.name ?? e.label].filter(Boolean).join(" ") || e.id);
    }
    for (const a of assets?.assets ?? []) labels.set(a.id, a.name || a.id);
    return (id: string) => labels.get(id) ?? id;
  }, [dfd, assets]);

  // Attack paths: leaf refs (display ids) → element / flow, and their ELs.
  const resolveRef = useMemo(() => dfdRefResolver(dfd), [dfd]);
  const exposureLevelOf = useMemo(() => {
    const levels = new Map<string, string>();
    for (const e of [...(dfd?.elements ?? []), ...(dfd?.connections ?? [])] as { id: string; properties?: { exposureLevel?: string } }[]) {
      if (e.properties?.exposureLevel) levels.set(e.id, e.properties.exposureLevel);
    }
    return (id: string) => levels.get(id);
  }, [dfd]);

  const relevantKeys = useMemo(() => (relevance ? new Set(relevance.relevant.keys()) : undefined), [relevance]);
  const withRelevance = useCallback(
    (refs: ThreatReference[]): ThreatReference[] =>
      relevance
        ? refs.map((ref) => {
            const r = threatRelevance(ref, relevance, resolveRef);
            const pathEl =
              r.relevant && ref.attackPathLeaves ? attackPathExposureLevel(ref.attackPathLeaves, resolveRef, exposureLevelOf, relevantKeys) : undefined;
            const iso = isolation ? threatIsolation(ref.linkedAssetIds, isolation) : undefined;
            return {
              ...ref,
              en50742: {
                relevant: r.relevant,
                reason: threatRelevanceText(r, labelOf, t),
                ...(pathEl ? { exposureLevel: pathEl } : {}),
                ...(iso
                  ? {
                      functionIsolated: iso.isolated,
                      ...(iso.isolated ? {} : { isolationReason: threatIsolationText(iso.notIsolated, labelOf, t) }),
                    }
                  : {}),
              },
            };
          })
        : refs,
    [relevance, isolation, labelOf, resolveRef, exposureLevelOf, relevantKeys, t],
  );
  // The relevant interfaces and flows — the Threats tab asks for a reason
  // before a threat on one of them is dismissed (patch 28).
  const relevantAnchorIds = relevantKeys;
  // Patch 29: the risks whose SRSL controls are open — the Risks tab keeps
  // them open in its progress (EN 50742 A only: B has no SRSL).
  // `prepared` holds the DFD only; the view reads the current risks and
  // threats, so it is built from the current project here.
  const risks = project?.risks;
  const threats = project?.threats;
  const approachA = en50742ApproachFromTags(project?.info?.tags ?? EMPTY_PROJECT_TAGS) === "A";
  const srslOpenRiskIdsOf = useMemo(
    () => {
      if (!project || !approachA) return undefined;
      const context = prepareProjectCompliance(project);
      return context ? srslOpenRiskIds(context.en50742View()) : undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approachA, risks, threats, dfd, assets],
  );
  return { withRelevance, relevantAnchorIds, srslOpenRiskIds: srslOpenRiskIdsOf };
}
