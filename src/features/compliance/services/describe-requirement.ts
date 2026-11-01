// ==================== DESCRIBE A REQUIREMENT ====================
// What the tooltip and the report say about a matrix row (D-27): the short
// title, our own summary and "how TARAflow checks it" — generated from the
// evidence rule, so it always matches what the evaluator does.

import type { EvidenceRule, EvidenceTarget, NeighbourCheck, PropertyCheck, RequirementId } from "../models/compliance-types";
import { EVIDENCE_RULES } from "../data/evidence-rules";
import { REQUIREMENT_TEXTS } from "../data/requirement-texts";

export type DescribeLanguage = "en" | "de";

export interface RequirementDescription {
  id: RequirementId;
  title: string;
  summary: string;
  /** How the evaluator decides the row, in the given language. */
  check: string;
  /** Unmodelled criteria (type B), in the given language. */
  checklist: string[];
}

const WORDS = {
  en: {
    every: "every",
    atLeastOne: "at least one",
    with: "with",
    connectedTo: "connected to",
    fromOrTo: "from or to",
    set: "set",
    setNot: "set, not",
    or: "or",
    appliesWhen: "Applies when",
    model: "Checked in the model",
    noModel: "Not derivable from the model — a statement, a mitigation of the risk treatment or a claim meets it.",
    wholeComponent: "the component as a whole",
    crossesComponent: "across the component border (not human input, not physical coupling)",
  },
  de: {
    every: "jedes",
    atLeastOne: "mindestens ein",
    with: "mit",
    connectedTo: "verbunden mit",
    fromOrTo: "von oder zu",
    set: "gesetzt",
    setNot: "gesetzt, nicht",
    or: "oder",
    appliesWhen: "Gilt, wenn",
    model: "Im Modell geprüft",
    noModel: "Nicht aus dem Modell ableitbar — eine Aussage, eine Massnahme der Risikobehandlung oder ein Claim erfüllt sie.",
    wholeComponent: "die Komponente als Ganzes",
    crossesComponent: "über die Komponentengrenze (keine menschliche Eingabe, keine physische Kopplung)",
  },
} as const;

/** "implementedControls.debugProtection" → "debug protection". */
const words = (path: string) =>
  (path.split(".").pop() ?? path).replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();

function checkText(check: PropertyCheck, w: (typeof WORDS)[DescribeLanguage]): string {
  const name = words(check.property);
  if (check.in) return `${name} = ${check.in.map(String).join(" / ")}`;
  if (check.notIn) return `${name} ${w.setNot} ${check.notIn.map(String).join(" / ")}`;
  return `${name} ${w.set}`;
}

function neighbourText(n: NeighbourCheck, prefix: string, w: (typeof WORDS)[DescribeLanguage]): string {
  return `${prefix} ${n.elementTypes.join(" / ")} (${n.checks.map((c) => checkText(c, w)).join(", ")})`;
}

function targetText(target: EvidenceTarget, quantifier: string, w: (typeof WORDS)[DescribeLanguage]): string {
  const parts = [`${quantifier} ${target.elementTypes.join(" / ")}`];
  if (target.crossesComponent) parts.push(w.crossesComponent);
  if (target.appliesIf?.length) parts.push(`${w.with} ${target.appliesIf.map((c) => checkText(c, w)).join(", ")}`);
  if (target.endpointIf) parts.push(neighbourText(target.endpointIf, w.fromOrTo, w));
  if (target.connectedIf) parts.push(neighbourText(target.connectedIf, w.connectedTo, w));
  const head = parts.join(" ");
  return target.satisfiedIf?.length ? `${head}: ${target.satisfiedIf.map((c) => checkText(c, w)).join(` ${w.or} `)}` : head;
}

export function describeRule(rule: EvidenceRule, lang: DescribeLanguage): string {
  const w = WORDS[lang];
  const sentences: string[] = [];
  if (rule.appliesWhen?.length) {
    sentences.push(`${w.appliesWhen}: ${rule.appliesWhen.map((t) => targetText(t, w.atLeastOne, w)).join(` ${w.or} `)}.`);
  }
  if (rule.type === "C") {
    sentences.push(w.noModel);
  } else {
    const quantifier = rule.quantifier === "any" ? w.atLeastOne : w.every;
    const targets = rule.targets.length > 0 ? rule.targets.map((t) => targetText(t, quantifier, w)).join(`; ${w.or} `) : w.wholeComponent;
    sentences.push(`${w.model}: ${targets}.`);
  }
  return sentences.join(" ");
}

export function describeRequirement(id: RequirementId, lang: DescribeLanguage): RequirementDescription {
  const text = REQUIREMENT_TEXTS[id];
  const rule = EVIDENCE_RULES.get(id)!;
  const checklist = lang === "de" && text.checklistDe ? [...text.checklistDe] : [...(rule.checklist ?? [])];
  return { id, title: text.title, summary: lang === "de" ? text.de : text.en, check: describeRule(rule, lang), checklist };
}

/** The language of a UI / document language code ("de", "de-CH", "en" …). */
export const describeLanguageOf = (code: string | undefined): DescribeLanguage => (code?.startsWith("de") ? "de" : "en");
