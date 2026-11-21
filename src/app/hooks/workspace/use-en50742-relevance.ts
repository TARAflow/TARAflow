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
import { threatRelevance, threatRelevanceText } from "../../utils/en50742-relevance";

export function useEn50742Relevance(project: Project | undefined, t: TFunction) {
  // A or B tag, whatever the base method (0.20: also with ETSI TVRA)
  const en50742 = en50742ApproachFromTags(project?.info?.tags ?? EMPTY_PROJECT_TAGS) !== undefined;
  const dfd = project?.dfd;
  const assets = project?.assets;
  const relevance = useMemo(
    () => (project && en50742 ? prepareProjectCompliance(project)?.en50742Relevance() : undefined),
    // The relevance reads the DFD (zones, flows, interfaces) and the
    // safety-function assets — not the threats, risks or ratings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [en50742, dfd, assets],
  );

  const labelOf = useMemo(() => {
    const labels = new Map<string, string>();
    for (const e of [...(dfd?.elements ?? []), ...(dfd?.connections ?? [])] as { id: string; displayId?: string; name?: string; label?: string }[]) {
      labels.set(e.id, [e.displayId, e.name ?? e.label].filter(Boolean).join(" ") || e.id);
    }
    for (const a of assets?.assets ?? []) labels.set(a.id, a.name || a.id);
    return (id: string) => labels.get(id) ?? id;
  }, [dfd, assets]);

  return useCallback(
    (refs: ThreatReference[]): ThreatReference[] =>
      relevance
        ? refs.map((ref) => {
            const r = threatRelevance(ref, relevance);
            return { ...ref, en50742: { relevant: r.relevant, reason: threatRelevanceText(r, labelOf, t) } };
          })
        : refs,
    [relevance, labelOf, t],
  );
}
