// ==================== ASSET-DERIVED DATA ====================
// Asset-side projections the tabs read: the hazard → asset links, the asset
// data reference for threats / risks / hazards, the threat ↔ goal links of
// the asset tab, the risk work per threat, and the asset graph's hazard and
// registry inputs. The features stay independent (assets ⊥ hazards,
// assets ⊥ threats, threats ⊥ risks) — they are joined here, in the app
// layer. Split out of workspace-layout.tsx (MT-1).

import { useMemo } from "react";
import {
  getDisabledThreatGenerators,
  regulationPresetFromTags,
  EMPTY_PROJECT_TAGS,
  type AssetDataReference,
} from "shared";
import type { ThreatRiskAttachment } from "features/threats";
import type { Project } from "../../models/project-types";
import { buildAssetHazardLinks } from "../../utils/build-asset-hazard-links";
import { buildAssetDataReference } from "../../utils/build-asset-data-reference";
import { buildThreatGoalLinks } from "../../utils/build-threat-goal-links";
import { withComponentThreats } from "../../utils/component-threats";

export function useAssetDerivedData(activeProject: Project | undefined) {
  const hazards = activeProject?.hazards;
  const assetStore = activeProject?.assets;

  // Hazard Items and their edges for the asset graph (FR-V11, read-only); a
  // stable object so the graph is rebuilt only when the hazard data changes.
  const graphHazards = useMemo(
    () => (hazards ? { items: hazards.hazards, relations: hazards.relations } : null),
    [hazards],
  );

  // The asset registry for the asset graph: the manual assets (e.g. hazard
  // protection targets) are not in the dfd.assets mirror.
  const graphRegistry = useMemo(
    () =>
      assetStore
        ? {
            assets: assetStore.assets.map((a) => ({
              id: a.id,
              displayId: a.displayId,
              name: a.name,
              assetGroup: a.assetGroup,
              ...(a.properties?.protectionNeed ? { protectionNeed: String(a.properties.protectionNeed) } : {}),
            })),
            relations: assetStore.relations ?? [],
          }
        : null,
    [assetStore],
  );

  // Hazard → asset projection (§6): endangeredBy / contributesTo per asset.
  // Read-only; the assets feature never imports features/hazards.
  const hazardRef = useMemo(() => buildAssetHazardLinks(hazards ?? null), [hazards]);

  // Risk work per threat id — lets the Threats tab warn before an action
  // would drop a threat that carries a risk assessment.
  const risks = activeProject?.risks?.risks;
  const riskAttachments = useMemo(() => {
    const out: Record<string, ThreatRiskAttachment> = {};
    for (const r of risks ?? []) {
      out[r.threatId] = { mitigationCount: r.selectedMitigations?.length ?? 0 };
    }
    return out;
  }, [risks]);

  // Threats → linked assets, for the threat ↔ goal cross-checks of the asset
  // tab. Same generators and link rule as the risk register.
  // Stored threats plus those of imported components (patch 14).
  const components = activeProject?.components;
  const storedThreats = activeProject?.threats;
  const dfd = activeProject?.dfd;
  const threats = useMemo(
    () => (components ? withComponentThreats(storedThreats, { components, dfd: dfd ?? null }) : storedThreats),
    [storedThreats, components, dfd],
  );
  const assets = assetStore?.assets;
  const attackTrees = activeProject?.attackTrees;
  const tags = activeProject?.info?.tags;
  const threatGoalLinks = useMemo(
    () =>
      buildThreatGoalLinks({
        threats,
        assets,
        dfdElements: (dfd as any)?.elements,
        attackTrees,
        disabledStrideMethods: getDisabledThreatGenerators(
          regulationPresetFromTags(tags ?? EMPTY_PROJECT_TAGS),
        ),
      }),
    [threats, assets, dfd, attackTrees, tags],
  );

  const impactScale = assetStore?.configuration?.impactScale;
  const impactCriteria = assetStore?.configuration?.impactCriteria;
  const assetDataRef = useMemo((): AssetDataReference | undefined => {
    if (!assets || assets.length === 0) return undefined;
    return buildAssetDataReference(assets, hazardRef, impactScale ?? "4-level", impactCriteria);
  }, [assets, impactScale, impactCriteria, hazardRef]);

  return { graphHazards, graphRegistry, hazardRef, riskAttachments, threatGoalLinks, assetDataRef };
}
