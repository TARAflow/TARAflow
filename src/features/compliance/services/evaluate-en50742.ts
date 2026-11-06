// ==================== EN 50742 A: RISK AND PROJECT EVIDENCE ====================
// The rows of en-50742-rq-coverage.md §9.2 with evidence R or P, read from
// the En50742View (CM-12). Pure. Three-valued as the property checks (D-12):
// an unrated risk, an unset WoO or a missing hazard import is `unknown`,
// never met and never n/a; a clear "no" is a gap, and a gap wins over
// unknown (step 9 of the evaluator).
//
// Interfaces (7.1): the app layer finds the interfaces and flows on a path
// to a safety function (backwards along the flows from the asset's DFD
// elements, CM-12b); each one above EL0 needs a risk with SRSL there, or the
// threat excluded with a justification ("won't"). A safety function without
// DFD elements leaves the row unknown.

import type { ExternalEvidence, ProjectCheckId } from "../models/compliance-types";
import type { En50742Risk, En50742View, SrslLevel, SrslSummary } from "../models/en50742-view";
import type { EvaluationRun } from "../models/evaluation-types";

export interface ExternalOutcome {
  status: "met" | "gap" | "unknown" | "needs-statement" | "n/a";
  /** Elements (interfaces, flows) that fail the row. */
  failing?: string[];
  /** Elements whose EL is unset. */
  unknown?: string[];
  /** Risks (labels) that fail the row or are not rated yet. */
  risks?: string[];
  reasoning?: string;
}

const met = (): ExternalOutcome => ({ status: "met" });
const labels = (risks: readonly En50742Risk[]) => risks.map((r) => r.label);

/** Risks the SRSL rows look at: the threat is not excluded. */
const inPlay = (view: En50742View) => view.risks.filter((r) => !r.excluded);

/** The risk has the control for `clause` (any mandated one where one suffices). */
function hasControl(risk: En50742Risk, clause: string, run: EvaluationRun): boolean {
  const counts = (c: { done: boolean; planned: boolean }) => (run === "achieved" ? c.done : c.planned);
  return risk.controls.some((c) => counts(c) && (risk.anyOfMandated ? risk.mandated.includes(c.clause) : c.clause === clause));
}

/** Every mandated control of the risk is in place. */
const allMandatedInPlace = (risk: En50742Risk, run: EvaluationRun) => risk.mandated.every((clause) => hasControl(risk, clause, run));

/** Risks applicable for a clause check: no SRSL yet → unknown, mandated → judged. */
function judgeRisks(
  view: En50742View,
  mandates: (risk: En50742Risk) => boolean,
  satisfied: (risk: En50742Risk) => boolean,
  none: string,
): ExternalOutcome {
  const risks = inPlay(view).filter((r) => r.srsl !== undefined);
  const unrated = risks.filter((r) => r.srsl === null);
  const applicable = risks.filter((r) => r.srsl !== null && mandates(r));
  const failing = applicable.filter((r) => !satisfied(r));
  if (failing.length > 0) return { status: "gap", risks: labels([...failing, ...unrated]), reasoning: "mandated control missing or not done" };
  if (unrated.length > 0) return { status: "unknown", risks: labels(unrated), reasoning: "risks without SRSL — rate EL, attacker capability and severity" };
  if (applicable.length === 0) return { status: "n/a", reasoning: none };
  return met();
}

function riskOutcome(check: "mandated" | "all-mandated" | "remaining", clause: string | undefined, view: En50742View, run: EvaluationRun): ExternalOutcome {
  if (check === "mandated") {
    return judgeRisks(view, (r) => r.mandated.includes(clause!), (r) => hasControl(r, clause!, run), "no risk mandates the clause at its SRSL");
  }
  if (check === "all-mandated") {
    return judgeRisks(view, (r) => r.mandated.length > 0, (r) => allMandatedInPlace(r, run), "no risk mandates a protection measure");
  }
  // Information for use: a remaining requirement is passed on — the model
  // cannot show the text, so a statement names them.
  const risks = inPlay(view);
  const unrated = risks.filter((r) => r.srsl === null);
  const remaining = risks.filter((r) => r.accepted || (typeof r.srsl === "number" && !allMandatedInPlace(r, run)));
  if (remaining.length > 0) {
    return { status: "needs-statement", risks: labels(remaining), reasoning: "name these risks in the information for use" };
  }
  if (unrated.length > 0) return { status: "unknown", risks: labels(unrated), reasoning: "risks without SRSL" };
  return { status: "n/a", reasoning: "no remaining requirement" };
}

function projectOutcome(check: ProjectCheckId, view: En50742View): ExternalOutcome {
  const risks = inPlay(view);
  switch (check) {
    case "hazards-linked": {
      if (view.hazards.total === 0) return { status: "unknown", reasoning: "no hazard data imported" };
      if (view.hazards.unlinked.length > 0) {
        return { status: "gap", reasoning: `hazards without a contributing input: ${view.hazards.unlinked.join(", ")}` };
      }
      if (view.safetyFunctions.length === 0) return { status: "unknown", reasoning: "no safety-function asset (asset with a physical impact)" };
      const withoutRisks = view.safetyFunctions.filter((sf) => !view.risks.some((r) => r.safetyFunctionIds.includes(sf.id)));
      if (withoutRisks.length > 0) return { status: "gap", reasoning: `safety functions without risks: ${withoutRisks.map((s) => s.name).join(", ")}` };
      return met();
    }
    case "system-definition": {
      const missing = [
        !view.windowOfOpportunity && "window of opportunity",
        !view.systemDefinition.boundary && "system boundary",
        !view.systemDefinition.environment && "operational environment",
      ].filter((m): m is string => !!m);
      return missing.length > 0 ? { status: "unknown", reasoning: `not set yet: ${missing.join(", ")}` } : met();
    }
    case "interfaces-assessed": {
      const assessed = (id: string) => view.risks.some((r) => r.anchorId === id && (r.excluded || typeof r.srsl === "number"));
      const pending = (id: string) => view.risks.some((r) => r.anchorId === id && !r.excluded && r.srsl === null);
      const failing = view.interfaces.exposed.filter((id) => !assessed(id) && !pending(id));
      const open = view.interfaces.exposed.filter((id) => !assessed(id) && pending(id));
      if (failing.length > 0) {
        return { status: "gap", failing, unknown: [...open, ...view.interfaces.unrated], reasoning: "on a path to a safety function, exposed, no risk with SRSL" };
      }
      if (open.length > 0 || view.interfaces.unrated.length > 0) {
        return { status: "unknown", unknown: [...open, ...view.interfaces.unrated], reasoning: "SRSL or EL not rated yet" };
      }
      const unlinked = view.safetyFunctions.filter((sf) => !sf.linked);
      if (unlinked.length > 0) return { status: "unknown", reasoning: `safety functions without DFD elements: ${unlinked.map((s) => s.name).join(", ")}` };
      if (view.safetyFunctions.length === 0) return { status: "unknown", reasoning: "no safety-function asset (asset with a physical impact)" };
      if (view.interfaces.exposed.length === 0) return { status: "n/a", reasoning: "no interface above EL0 on a path to a safety function" };
      return met();
    }
    case "srsl-complete": {
      if (view.safetyFunctions.length === 0) return { status: "unknown", reasoning: "no safety-function asset (asset with a physical impact)" };
      const riskOf = (sfId: string) => risks.filter((r) => r.safetyFunctionIds.includes(sfId));
      const withoutRisks = view.safetyFunctions.filter((sf) => riskOf(sf.id).length === 0);
      if (withoutRisks.length > 0) return { status: "gap", reasoning: `safety functions without risks: ${withoutRisks.map((s) => s.name).join(", ")}` };
      const unrated = risks.filter((r) => r.safetyFunctionIds.length > 0 && r.srsl === null);
      if (unrated.length > 0) return { status: "unknown", risks: labels(unrated), reasoning: "risks without SRSL" };
      const noSrsl = view.safetyFunctions.filter((sf) => !riskOf(sf.id).some((r) => typeof r.srsl === "number"));
      if (noSrsl.length > 0) return { status: "unknown", reasoning: `no EL-rated interface yet: ${noSrsl.map((s) => s.name).join(", ")}` };
      return met();
    }
    case "srsl-consistent": {
      const zero = risks.filter((r) => r.srsl === 0);
      const contradicting = zero.filter((r) => r.exposed === true);
      if (contradicting.length > 0) return { status: "gap", risks: labels(contradicting), reasoning: "SRSL 0 on an interface above EL0" };
      const open = [...zero.filter((r) => r.exposed === undefined), ...risks.filter((r) => r.srsl === null)];
      if (open.length > 0) return { status: "unknown", risks: labels(open), reasoning: "SRSL or EL not rated yet" };
      if (!risks.some((r) => typeof r.srsl === "number")) return { status: "n/a", reasoning: "no SRSL determined" };
      return met();
    }
  }
}

/** The row's outcome from risk or project evidence. */
export function externalOutcome(evidence: ExternalEvidence, view: En50742View, run: EvaluationRun): ExternalOutcome {
  return evidence.kind === "project"
    ? projectOutcome(evidence.check, view)
    : riskOutcome(evidence.check, evidence.check === "mandated" ? evidence.clause : undefined, view, run);
}

/** "Applies from SRSL n": some risk reaches it; unknown while risks are unrated. */
export function srslReached(min: number, view: En50742View): "yes" | "no" | "unknown" {
  const risks = inPlay(view);
  if (risks.some((r) => typeof r.srsl === "number" && r.srsl >= min)) return "yes";
  if (risks.length === 0 || risks.some((r) => r.srsl === null)) return "unknown";
  return "no";
}

/** The `srsl` header: per safety function the highest SRSL of its risks (coverage §9.3). */
export function srslSummary(view: En50742View): SrslSummary {
  return {
    windowOfOpportunity: view.windowOfOpportunity,
    safetyFunctions: view.safetyFunctions.map((sf) => {
      const levels = inPlay(view)
        .filter((r) => r.safetyFunctionIds.includes(sf.id) && typeof r.srsl === "number")
        .map((r) => r.srsl as SrslLevel);
      return { id: sf.id, name: sf.name, interfaces: sf.interfaces, srsl: levels.length > 0 ? (Math.max(...levels) as SrslLevel) : null };
    }),
  };
}
