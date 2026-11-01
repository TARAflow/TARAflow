// ==================== TO-DO LIST ====================
// What is still open up to the SL-T, per element (iec-62443-4-2-cra-coverage.md
// IEC-8, D-29): for every open row whose SL-C level is needed by the target of
// its FR, the elements that fail it or lack a property, with the properties
// the rule reads on that element type; rows only a statement can meet are
// listed apart, and so are rows one element of the component meets ("any"
// rules: update, backup — listing them at every element would be noise).
// The tab shows it as "what to do next".

import { EVIDENCE_RULES } from "../data/evidence-rules";
import type { Edition, FoundationalRequirement, SecurityLevel } from "../models/compliance-types";
import type { ComplianceResult, RowResult } from "../models/evaluation-types";
import { words } from "./describe-requirement";

export interface TodoItem {
  label: string;
  fr: FoundationalRequirement;
  /** "not-met": the model shows it not met; "missing": a property is unset (or a neighbour's). */
  kind: "not-met" | "missing";
  /** Properties the rule reads on this element type, as words ("integrity protection"). */
  properties: string[];
  /** The planned run closes it for this element (chosen open mitigations). */
  plannedClosed: boolean;
}

export interface ElementTodo {
  elementId: string;
  items: TodoItem[];
}

export interface ComponentTodo {
  label: string;
  fr: FoundationalRequirement;
  /** Properties one element of these types must show. */
  properties: string[];
  elementTypes: string[];
  plannedClosed: boolean;
}

export interface TodoList {
  /** Elements with open items, most items first. */
  elements: ElementTodo[];
  /** Open rows one element of the component meets (quantifier "any"). */
  component: ComponentTodo[];
  /** Open rows within the target that only a statement (or a mitigation reference) can meet. */
  statements: { label: string; fr: FoundationalRequirement }[];
}

/** The row's SL-C level is needed for the target of its FR. */
function withinTarget(row: RowResult, target: Partial<Record<FoundationalRequirement, SecurityLevel>>): boolean {
  const level = target[row.fr];
  return level !== undefined && (row.minSl ?? 1) <= level;
}

function propertiesFor(edition: Edition, row: RowResult, type: string | undefined, kind: TodoItem["kind"]): string[] {
  const ids = edition.rows.find((r) => r.label === row.label)?.requirementIds ?? [];
  const out = new Set<string>();
  for (const id of ids) {
    for (const target of EVIDENCE_RULES.get(id)?.targets ?? []) {
      if (type && !(target.elementTypes as readonly string[]).includes(type)) continue;
      for (const check of target.satisfiedIf ?? []) out.add(words(check.property));
      if (kind === "missing") {
        for (const check of target.appliesIf ?? []) out.add(words(check.property));
        for (const n of [target.endpointIf, target.connectedIf]) {
          for (const check of n?.checks ?? []) out.add(`${words(check.property)} (${n!.elementTypes.join(" / ")})`);
        }
      }
    }
  }
  return [...out];
}

export function buildTodoList(
  edition: Edition,
  achieved: ComplianceResult,
  planned: ComplianceResult,
  target: Partial<Record<FoundationalRequirement, SecurityLevel>>,
  typeOf?: (id: string) => string | undefined,
): TodoList {
  const plannedRow = new Map(planned.rows.map((r) => [r.label, r]));
  const byElement = new Map<string, TodoItem[]>();
  const statements: TodoList["statements"] = [];
  const component: ComponentTodo[] = [];

  for (const row of achieved.rows) {
    if (!withinTarget(row, target)) continue;
    if (row.status === "needs-statement") {
      statements.push({ label: row.label, fr: row.fr });
      continue;
    }
    if (row.status !== "gap" && row.status !== "unknown") continue;
    const p = plannedRow.get(row.label);
    const rules = (edition.rows.find((r) => r.label === row.label)?.requirementIds ?? []).map((id) => EVIDENCE_RULES.get(id));
    if (rules.length > 0 && rules.every((rule) => rule?.quantifier === "any")) {
      component.push({
        label: row.label,
        fr: row.fr,
        properties: propertiesFor(edition, row, undefined, "not-met"),
        elementTypes: [...new Set(rules.flatMap((rule) => rule!.targets.flatMap((t) => t.elementTypes as readonly string[])))],
        plannedClosed: p?.status === "met",
      });
      continue;
    }
    const stillOpen = new Set([...(p?.failing ?? []), ...(p?.unknown ?? [])]);
    const add = (id: string, kind: TodoItem["kind"]) => {
      const item: TodoItem = {
        label: row.label,
        fr: row.fr,
        kind,
        properties: propertiesFor(edition, row, typeOf?.(id), kind),
        plannedClosed: p?.status === "met" || !stillOpen.has(id),
      };
      byElement.set(id, [...(byElement.get(id) ?? []), item]);
    };
    for (const id of row.failing) add(id, "not-met");
    for (const id of row.unknown) add(id, "missing");
  }

  const elements = [...byElement]
    .map(([elementId, items]) => ({ elementId, items }))
    .sort((a, b) => b.items.length - a.items.length || a.elementId.localeCompare(b.elementId));
  return { elements, component, statements };
}
