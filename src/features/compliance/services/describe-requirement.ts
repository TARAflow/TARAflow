// ==================== DESCRIBE A REQUIREMENT ====================
// What the tooltip and the report say about a matrix row (D-27): the short
// title, our own summary and "how TARAflow checks it" — generated from the
// evidence rule, so it always matches what the evaluator does.

import type { AnyRequirementId, EvidenceRule, EvidenceTarget, NeighbourCheck, PropertyCheck } from "../models/compliance-types";
import { RULES_BY_ID, TEXTS_BY_ID } from "../data/requirement-registry";

export type DescribeLanguage = "en" | "de";

export interface RequirementDescription {
  id: AnyRequirementId;
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
    and: "and",
    appliesWhen: "Applies when",
    model: "Checked in the model",
    noModel: "Not derivable from the model — a statement, a mitigation of the risk treatment or a claim meets it.",
    wholeComponent: "the component as a whole",
    risks: "Checked on the risks: the SRSL and the mandated controls of the risk treatment (with the next step; until then a statement meets it).",
    project: "Checked on the project data: hazards, risks, safety functions, way of operation and system definition (with the next step; until then a statement meets it).",
    fromSrsl: "Applies from SRSL",
    crossesComponent: "across the component border (not human input, not physical coupling)",
    conditions: {
      authenticates: "that authenticates",
      humanUsers: "with human users",
      passwordInUse: "that a password reaches",
      humanPasswordUse: "where humans log in with a password",
      roleBasedAuthorization: "with role-based authorization",
      guessableLogin: "that logins with a guessable authenticator reach",
      componentLevel: "that stands for the component (a multiprocess, or the process under evaluation)",
      updatable: "that is updated",
      automaticUpdates: "that installs updates automatically",
      machinePasswordUse: "where software processes or devices log in with a password",
    },
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
    and: "und",
    appliesWhen: "Gilt, wenn",
    model: "Im Modell geprüft",
    noModel: "Nicht aus dem Modell ableitbar — eine Aussage, eine Massnahme der Risikobehandlung oder ein Claim erfüllt sie.",
    wholeComponent: "die Komponente als Ganzes",
    risks: "An den Risiken geprüft: SRSL und verlangte Massnahmen der Risikobehandlung (mit dem nächsten Schritt; bis dahin erfüllt sie eine Aussage).",
    project: "An den Projektdaten geprüft: Gefährdungen, Risiken, Sicherheitsfunktionen, Betriebsart und Systemdefinition (mit dem nächsten Schritt; bis dahin erfüllt sie eine Aussage).",
    fromSrsl: "Gilt ab SRSL",
    crossesComponent: "über die Komponentengrenze (keine menschliche Eingabe, keine physische Kopplung)",
    conditions: {
      authenticates: "das authentifiziert",
      humanUsers: "mit menschlichen Benutzern",
      passwordInUse: "das ein Passwort erreicht",
      humanPasswordUse: "bei dem sich Menschen mit Passwort anmelden",
      roleBasedAuthorization: "mit rollenbasierter Autorisierung",
      guessableLogin: "das Logins mit erratbarem Merkmal erreichen",
      componentLevel: "das für die Komponente steht (ein Multiprocess oder der bewertete Process)",
      updatable: "das aktualisiert wird",
      automaticUpdates: "das Updates automatisch installiert",
      machinePasswordUse: "bei dem sich Software-Prozesse oder Geräte mit Passwort anmelden",
    },
  },
} as const;

/** "implementedControls.debugProtection" → "debug protection". */
export const words = (path: string) =>
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
  for (const id of target.when ?? []) parts.push(w.conditions[id]);
  if (target.appliesIf?.length) parts.push(`${w.with} ${target.appliesIf.map((c) => checkText(c, w)).join(", ")}`);
  if (target.endpointIf) parts.push(neighbourText(target.endpointIf, w.fromOrTo, w));
  if (target.connectedIf) parts.push(neighbourText(target.connectedIf, w.connectedTo, w));
  const head = parts.join(" ");
  const anyOf = target.satisfiedIf?.length ? target.satisfiedIf.map((c) => checkText(c, w)).join(` ${w.or} `) : "";
  const allOf = target.satisfiedIfAll?.length ? target.satisfiedIfAll.map((c) => checkText(c, w)).join(` ${w.and} `) : "";
  const condition = [anyOf, allOf].filter(Boolean).join(` ${w.and} `);
  return condition ? `${head}: ${condition}` : head;
}

export function describeRule(rule: EvidenceRule<AnyRequirementId>, lang: DescribeLanguage): string {
  const w = WORDS[lang];
  const sentences: string[] = [];
  if (rule.minSrsl) sentences.push(`${w.fromSrsl} ${rule.minSrsl}.`);
  if (rule.external) return [...sentences, rule.external.kind === "risk" ? w.risks : w.project].join(" ");
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

export function describeRequirement(id: AnyRequirementId, lang: DescribeLanguage): RequirementDescription {
  const text = TEXTS_BY_ID[id];
  const rule = RULES_BY_ID.get(id)!;
  const checklist = lang === "de" && text.checklistDe ? [...text.checklistDe] : [...(rule.checklist ?? [])];
  return { id, title: text.title, summary: lang === "de" ? text.de : text.en, check: describeRule(rule, lang), checklist };
}

/**
 * The open checklist items of a row, in the language of `descriptions`:
 * `open` holds the evaluator's items (RowResult.checklist, English rule
 * texts) — items the model answers are not among them (CM-5b).
 */
export function localizedChecklist(descriptions: readonly RequirementDescription[], open: readonly string[]): string[] {
  if (open.length === 0) return [];
  return descriptions.flatMap((d) => {
    const items = RULES_BY_ID.get(d.id)?.checklist ?? [];
    return items.flatMap((item, i) => (open.includes(item) ? [d.checklist[i] ?? item] : []));
  });
}

/** The language of a UI / document language code ("de", "de-CH", "en" …). */
export const describeLanguageOf = (code: string | undefined): DescribeLanguage => (code?.startsWith("de") ? "de" : "en");
