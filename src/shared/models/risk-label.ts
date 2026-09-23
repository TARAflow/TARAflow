// ==================== RISK LABEL ====================
// Single Responsibility: the human-readable label of a risk.
//
// Risk.id is an opaque, stable key ("R-<threat UUID>") — it must never be shown
// to a user. The readable label is derived from the threat display id the risk
// currently points at, so it follows a DFD renumber automatically once the
// risk sync has refreshed Risk.threatDisplayId.
//
// Dependency-free on purpose: used by the Risk tab, attack trees, audit diffs,
// Jira export and the document generators (incl. the CLI bundle).

/** Minimal shape needed to label a risk. */
export interface RiskLabelSource {
  id: string;
  threatDisplayId?: string | null;
}

/** "R-<threat display id>", falling back to the raw id for legacy data. */
export function formatRiskLabel(risk: RiskLabelSource): string {
  const label = risk.threatDisplayId?.trim();
  return label ? `R-${label}` : risk.id;
}
