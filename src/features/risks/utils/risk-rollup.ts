// ==================== RISK ROLL-UP ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md §10, Phase 6f): the risk
// matrix rolled up per decomposed multiprocess — risks per level of its
// subtree and the highest level. Each threat counts once (its highest
// risk). A pure view; nothing is stored.

import { dfdItemOf, type DfdScopeMultiprocess, type ThreatReference } from "shared";
import type { Risk } from "../models/risk-assessment-types";
import type { RiskConfiguration } from "../models/risk-config-types";
import { RISK_SCALES, calculateLevelIndex } from "../models/risk-scale-types";

export type RiskRollupMode = "before" | "after";

export interface RiskRollupRow {
  tfId: string;
  label: string;
  depth: number;
  /** Rated threats per level, index = level index of the scale. */
  counts: number[];
  /** Level index of the highest risk; undefined while nothing is rated. */
  max?: number;
  /** Threats of the subtree with a risk, rated or not. */
  threats: number;
}

/** "after": the risk after mitigation where rated, else before. */
const valueOf = (risk: Risk, mode: RiskRollupMode) =>
  mode === "after" && risk.calculatedRiskAfterMitigation > 0
    ? risk.calculatedRiskAfterMitigation
    : risk.calculatedRiskBeforeMitigation;

export function riskRollupRows(
  multiprocesses: readonly DfdScopeMultiprocess[],
  risks: readonly Risk[],
  threats: readonly ThreatReference[],
  configuration: Pick<RiskConfiguration, "scale" | "roundingMethod">,
  mode: RiskRollupMode,
): RiskRollupRow[] {
  const levels = RISK_SCALES[configuration.scale].levels.length;
  const itemOf = new Map(threats.map((t) => [t.id, dfdItemOf({
    elementId: t.linkedElement?.elementId,
    connectionId: t.dataFlow?.connectionId,
  })]));
  // Highest value per threat and the DFD item it belongs to.
  const byThreat = new Map<string, { item: string; value: number }>();
  for (const risk of risks) {
    const item = itemOf.get(risk.threatId);
    if (!item) continue;
    const value = valueOf(risk, mode);
    const seen = byThreat.get(risk.threatId);
    if (!seen || value > seen.value) byThreat.set(risk.threatId, { item, value });
  }

  return multiprocesses.map((mp) => {
    const inside = new Set(mp.items);
    const counts = new Array<number>(levels).fill(0);
    let threatCount = 0;
    for (const { item, value } of byThreat.values()) {
      if (!inside.has(item)) continue;
      threatCount++;
      if (value > 0) counts[calculateLevelIndex(value, levels, configuration.roundingMethod)]++;
    }
    const max = counts.reduce<number | undefined>((m, c, i) => (c > 0 ? i : m), undefined);
    return { tfId: mp.tfId, label: mp.label, depth: mp.depth, counts, max, threats: threatCount };
  });
}
