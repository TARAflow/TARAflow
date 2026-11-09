// ==================== CREDITED RESIDUAL RISK ====================
// The residual risk a reader may count (multi-project TARA I7 (4), phase
// 3d-2a). TARAflow does not compute the residual risk from measures — the
// analyst rates the factors after treatment (mitigatedFactorRatings,
// calculatedRiskAfterMitigation; under ISO/SAE 21434 isoRisk.residual from
// matrix H.8). When a measure the risk relies on does not hold in this
// context, the residual risk is NOT CREDITED: every reader that evaluates or
// shows a residual risk (matrix, tables, sidebar, report) then sees the
// values before treatment. The stored after-values stay and count again once
// the cause is gone.
//
// Generic on purpose (shared/, used by the risks and the documentation
// feature): the app layer passes a set — risk id → what blocks the residual
// (a measure, its context, the state, the causes) — derived from its read
// models (component treatments). Readers meaning the STORED values (editing
// the after-values, recalculation, the audit diff, serialisation,
// completeness checks) read them directly — see the allow list of the source
// guard test (src/tests/unit/shared/credited-residual-guard.test.ts).

/** Why a measure does not hold: a kind ("pending", "aou_open", "aou_not_fulfilled", "aou_invalid_in_component", …) and what it refers to. */
export interface ResidualCause {
  kind: string;
  /** e.g. the assumption's display id "ASM-03"; the machine's rationale for "overridden_here". */
  ref?: string;
}

/** One reason a residual risk is not credited. */
export interface ResidualBlocker {
  /** The measure, e.g. "M-C-012". */
  measure: string;
  /** Where it does not hold, e.g. "SD2 · Smoke Detector". */
  context: string;
  state: "not_effective" | "unclear";
  causes: readonly ResidualCause[];
}

/** Risk id → what blocks its residual risk. Absent / empty → every residual counts. */
export type UncreditedResiduals = ReadonlyMap<string, readonly ResidualBlocker[]>;

interface IsoValue<B> {
  feasibility: B;
  value: number;
}

/** The fields a credited view needs (structural — Risk of the risks feature, its copy in the report data). */
export interface ResidualInput<F, B> {
  id: string;
  calculatedRiskBeforeMitigation: number;
  calculatedRiskAfterMitigation: number;
  factorRatings?: readonly F[];
  mitigatedFactorRatings?: readonly F[];
  isoRisk?: IsoValue<B> & { residual?: IsoValue<B> };
}

export interface CreditedResidual<F, B> {
  /** false: the residual risk is not credited — the values below are those before treatment. */
  credited: boolean;
  blockers: readonly ResidualBlocker[];
  /** The risk after treatment that counts (generic R = L × I). */
  riskAfter: number;
  /** The factor ratings after treatment that count. */
  mitigatedFactorRatings: readonly F[];
  /** ISO/SAE 21434: the residual that counts (absent when nothing is rated after treatment). */
  isoResidual?: IsoValue<B>;
}

const NONE: readonly ResidualBlocker[] = [];

export function creditedResidual<F, B>(
  risk: ResidualInput<F, B>,
  uncredited?: UncreditedResiduals | null,
): CreditedResidual<F, B> {
  const blockers = uncredited?.get(risk.id) ?? NONE;
  const iso = risk.isoRisk;
  if (blockers.length === 0) {
    return {
      credited: true,
      blockers,
      riskAfter: risk.calculatedRiskAfterMitigation,
      mitigatedFactorRatings: risk.mitigatedFactorRatings ?? [],
      ...(iso?.residual ? { isoResidual: iso.residual } : {}),
    };
  }
  // Not credited: the values before treatment count. Under ISO the residual
  // is the scenario's value before treatment — if one was rated after it.
  return {
    credited: false,
    blockers,
    riskAfter: risk.calculatedRiskBeforeMitigation,
    mitigatedFactorRatings: risk.factorRatings ?? [],
    ...(iso?.residual ? { isoResidual: { feasibility: iso.feasibility, value: iso.value } } : {}),
  };
}

/**
 * The risk with its after-values replaced by the credited ones — for READ-ONLY
 * consumers that take whole risks (the ISO scenario roll-up, the matrices).
 * Never hand the result to an editor: saving it would overwrite the stored
 * after-values with the values before treatment.
 */
export function withCreditedResidual<F, B, R extends ResidualInput<F, B>>(risk: R, uncredited?: UncreditedResiduals | null): R {
  const c = creditedResidual<F, B>(risk, uncredited);
  if (c.credited) return risk;
  return {
    ...risk,
    calculatedRiskAfterMitigation: c.riskAfter,
    mitigatedFactorRatings: c.mitigatedFactorRatings,
    ...(risk.isoRisk ? { isoRisk: { ...risk.isoRisk, ...(c.isoResidual ? { residual: c.isoResidual } : {}) } } : {}),
  };
}

/** An accepted risk whose residual risk no longer counts — "acceptance to review", derived (I7 (4)). */
export function acceptanceToReview(risk: { id: string; treatment?: string }, uncredited?: UncreditedResiduals | null): boolean {
  return risk.treatment === "accept" && (uncredited?.get(risk.id)?.length ?? 0) > 0;
}

/** "M-C-012 (SD2 · Smoke Detector): ASM-03 open" — one line per blocker; the caller names the causes in its language. */
export function blockerLines(blockers: readonly ResidualBlocker[], causeText: (c: ResidualCause) => string): string[] {
  return blockers.map((b) => {
    const causes = b.causes.map(causeText).filter(Boolean);
    return `${b.measure} (${b.context})${causes.length > 0 ? `: ${causes.join(", ")}` : ""}`;
  });
}
