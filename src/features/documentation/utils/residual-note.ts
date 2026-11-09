// ==================== "NOT CREDITED" NOTE IN THE REPORT ====================
// Multi-project TARA I7 (4): the report data already carries the credited
// residual (app/services/doc-residual.ts) — a risk whose residual is not
// credited shows its values before treatment. This note says why, next to
// the residual: "Not credited: M-C-012 (SD2 · Smoke Detector): ASM-03 open".

import type { DocComputedValues } from "../models/doc-types";
import { blockerLines, type ResidualCause } from "../../../shared/services/credited-residual";

type TranslateFn = (key: string, defaultValue?: string) => string;

const CAUSE_FALLBACK: Record<string, string> = {
  pending: "not implemented yet",
  aou_open: "{{ref}} open",
  aou_not_fulfilled: "{{ref}} not fulfilled",
  aou_invalid_in_component: "{{ref}} invalid in the component",
  overridden_here: "marked not effective here: {{ref}}",
};

/** One cause in the document language. */
export function residualCauseText(c: ResidualCause, t: TranslateFn): string {
  const text = t(`tabs.doc.residual.cause.${c.kind}`, CAUSE_FALLBACK[c.kind] ?? c.kind);
  return text.replace("{{ref}}", c.ref ?? "");
}

/** The note for one risk, or undefined when its residual counts. */
export function uncreditedNote(
  riskId: string,
  computed: Pick<DocComputedValues, "uncreditedResiduals"> | undefined,
  t: TranslateFn,
): string | undefined {
  const blockers = computed?.uncreditedResiduals?.get(riskId);
  if (!blockers || blockers.length === 0) return undefined;
  const lines = blockerLines(blockers, (c) => residualCauseText(c, t));
  return `${t("tabs.doc.residual.notCredited", "Not credited")}: ${lines.join("; ")}`;
}
