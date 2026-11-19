// ==================== DEVIATIONS FROM A COMPONENT ====================
// Multi-project TARA phase 6a-3 (design §8.3, review 2026-11-09 / -11): per
// imported component ONE list for its platform team — what this TARA decided
// differently from the component, and what only the component can fix:
//
//   - goals this TARA added to a component asset; without a component threat
//     for them the signal "request a new revision" (patch 51)
//   - threat relevances this TARA overrode (boundary flows, I3)
//   - component measures marked "not effective here" (I7 (5))
//   - assumptions of use not fulfilled in an instance, with this TARA's
//     evidence
//   - intrinsic factors of the component this TARA rated anew (with the
//     rationale — the component likely delivers the same rating elsewhere)
//
// Not a deviation, listed apart (review 2026-11-12): the supporting claims of
// the component this TARA cites (4c) — this TARA relies on them, a change of
// the claim affects it.
//
// Structured data, built by the app layer; the texts in a language through
// `t` from that data — the report (document language) and "Copy as text" in
// the Overview (app language) share them, never English commit lines
// (review 2026-11-11). Shared because two features render it.

export type ComponentDeviation =
  | { kind: "goal_added"; prefix: string; asset: string; goal: string; level?: string; rationale?: string; revision: boolean }
  | { kind: "relevance_overridden"; prefix: string; threat: string; from: string; to: string; rationale: string }
  | { kind: "measure_not_effective"; prefix: string; measure: string; rationale: string }
  | { kind: "assumption_not_fulfilled"; prefix: string; assumption: string; rationale?: string; evidence?: AssumptionEvidence }
  | { kind: "factor_overridden"; prefix: string; risk: string; factor: string; from: number; to: number; rationale?: string }
  | { kind: "claim_cited"; prefix: string; claim: string; requirements: string[] };

export type ComponentDeviationKind = ComponentDeviation["kind"];

/** What this TARA names as the evidence of an assumption: its measures with their state, its elements, a note. */
export interface AssumptionEvidence {
  measures: { label: string; state: "implemented" | "pending" | "not_chosen" }[];
  elements: string[];
  note?: string;
}

/** "M-C-004 Firewall (implemented); P-3 Gateway; checked on site" — the report's evidence cell, the deviation list. */
export function evidenceText(e: AssumptionEvidence, t: TranslateFn): string {
  const state = (s: AssumptionEvidence["measures"][number]["state"]) =>
    t(`tabs.doc.imported.evidenceState.${s}`, s === "implemented" ? "implemented" : s === "pending" ? "not implemented yet" : "chosen by no risk");
  return [...e.measures.map((m) => `${m.label} (${state(m.state)})`), ...e.elements, ...(e.note ? [e.note] : [])].join("; ");
}

/** The order of the groups: what only the component can fix first. */
export const DEVIATION_KINDS: readonly ComponentDeviationKind[] = [
  "goal_added",
  "measure_not_effective",
  "assumption_not_fulfilled",
  "relevance_overridden",
  "factor_overridden",
];

/** Not deviations: what this TARA relies on — a change in the component affects it. */
export const RELIANCE_KINDS: readonly ComponentDeviationKind[] = ["claim_cited"];

type TranslateFn = (key: string, defaultValue?: string) => string;
const K = "tabs.doc.imported.deviation";
const fill = (text: string, values: Record<string, string>) => text.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => values[k] ?? "");

const HEADING: Record<ComponentDeviationKind, string> = {
  goal_added: "Goals added by this TARA",
  measure_not_effective: "Measures not effective here",
  assumption_not_fulfilled: "Assumptions of use not fulfilled",
  relevance_overridden: "Threat relevances overridden",
  factor_overridden: "Factors rated anew by this TARA",
  claim_cited: "Claims this TARA cites",
};

/** The heading of one group. */
export function deviationHeading(kind: ComponentDeviationKind, t: TranslateFn): string {
  return t(`${K}.heading.${kind}`, HEADING[kind]);
}

/** One deviation as a line (without its instance prefix). */
export function deviationText(d: ComponentDeviation, t: TranslateFn): string {
  const relevance = (r: string) => t(`tabs.doc.imported.relevance.${r}`, r.replace(/_/g, " "));
  switch (d.kind) {
    case "goal_added":
      return fill(t(`${K}.goalAdded`, "{{goal}}{{level}} added to {{asset}}{{rationale}}{{revision}}"), {
        goal: t(`tabs.doc.methodology.goalName.${d.goal}`, d.goal),
        level: d.level ? ` (${d.level})` : "",
        asset: d.asset,
        rationale: d.rationale ? ` — ${d.rationale}` : "",
        revision: d.revision ? ` — ${t(`${K}.revision`, "the component has no threat for it: request a new revision")}` : "",
      });
    case "relevance_overridden":
      return fill(t(`${K}.relevance`, "{{threat}}: {{from}} → {{to}} — {{rationale}}"), {
        threat: d.threat,
        from: relevance(d.from),
        to: relevance(d.to),
        rationale: d.rationale,
      });
    case "measure_not_effective":
      return fill(t(`${K}.measure`, "{{measure}} — {{rationale}}"), { measure: d.measure, rationale: d.rationale });
    case "assumption_not_fulfilled":
      return fill(t(`${K}.assumption`, "{{assumption}}{{rationale}}{{evidence}}"), {
        assumption: d.assumption,
        rationale: d.rationale ? ` — ${d.rationale}` : "",
        evidence: d.evidence ? ` (${fill(t(`${K}.evidence`, "evidence: {{evidence}}"), { evidence: evidenceText(d.evidence, t) })})` : "",
      });
    case "factor_overridden":
      return fill(t(`${K}.factor`, "{{risk}}: {{factor}} {{from}} → {{to}}{{rationale}}"), {
        risk: d.risk,
        factor: t(`risks.factors.${d.factor}.name`, d.factor),
        from: String(d.from),
        to: String(d.to),
        rationale: d.rationale ? ` — ${d.rationale}` : "",
      });
    case "claim_cited":
      return fill(t(`${K}.claim`, "{{claim}} — cited for {{requirements}}"), { claim: d.claim, requirements: d.requirements.join(", ") });
  }
}

/** The deviations grouped in DEVIATION_KINDS order, each line with its instance prefix. */
export function deviationGroups(items: readonly ComponentDeviation[], t: TranslateFn): { kind: ComponentDeviationKind; heading: string; lines: string[] }[] {
  return groupsOf(DEVIATION_KINDS, items, t);
}

/** What this TARA relies on (cited claims), grouped like the deviations. */
export function relianceGroups(items: readonly ComponentDeviation[], t: TranslateFn): { kind: ComponentDeviationKind; heading: string; lines: string[] }[] {
  return groupsOf(RELIANCE_KINDS, items, t);
}

function groupsOf(kinds: readonly ComponentDeviationKind[], items: readonly ComponentDeviation[], t: TranslateFn) {
  return kinds.flatMap((kind) => {
    const lines = items.filter((d) => d.kind === kind).map((d) => `${d.prefix}: ${deviationText(d, t)}`);
    return lines.length > 0 ? [{ kind, heading: deviationHeading(kind, t), lines }] : [];
  });
}

/**
 * The list as Markdown for the platform team (mail, ticket, wiki): a title
 * with the component and its state, the contact, one group per kind.
 */
export function deviationsMarkdown(
  component: { name: string; at: string; responsible?: string },
  items: readonly ComponentDeviation[],
  t: TranslateFn,
): string {
  const out = [`## ${fill(t(`${K}.title`, "Deviations from {{component}}"), { component: `${component.name} @ ${component.at}` })}`, ""];
  if (component.responsible) out.push(fill(t(`${K}.contact`, "For: {{responsible}}"), { responsible: component.responsible }), "");
  const groups = deviationGroups(items, t);
  if (groups.length === 0) out.push(t(`${K}.none`, "No deviations — this TARA uses the component as it is."), "");
  for (const g of groups) out.push(`### ${g.heading}`, "", ...g.lines.map((l) => `- ${l}`), "");
  // Apart: not a deviation — what this TARA relies on (review 2026-11-12).
  const reliance = relianceGroups(items, t);
  if (reliance.length > 0) {
    out.push(`## ${t(`${K}.relianceTitle`, "This TARA relies on — a change affects it")}`, "");
    for (const g of reliance) out.push(`### ${g.heading}`, "", ...g.lines.map((l) => `- ${l}`), "");
  }
  return out.join("\n").trimEnd() + "\n";
}
