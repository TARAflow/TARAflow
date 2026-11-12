// ==================== TO-DO LIST ====================
// What is still open up to the SL-T, per element (iec-62443-4-2-cra-coverage.md
// IEC-8, D-29): for every open row whose SL-C level is needed by the target of
// its FR, the elements that fail it or lack a property, with the properties
// the rule reads on that element type; rows only a statement can meet are
// listed apart, and so are rows one element of the component meets ("any"
// rules: update, backup — listing them at every element would be noise).
// The tab shows it as "what to do next". A standard without levels
// (EN 50742 A) has no target: every open row is listed.

import { BLACK_BOX_FIELDS } from "shared";
import { RULES_BY_ID } from "../data/requirement-registry";
import type { RowReason } from "./row-reasons";
import type { AnyEdition, FoundationalRequirement, SecurityLevel } from "../models/compliance-types";
import type { ComplianceResult, RowResult } from "../models/evaluation-types";

/**
 * A property the to-do names: its model path — the UI shows it under the DFD
 * form's label in the UI language (0.19 i18n follow-up; before, English words
 * built from the path). `on`: the neighbour's element types whose property it is.
 */
export interface TodoProperty {
  path: string;
  on?: string[];
}

export interface TodoItem {
  label: string;
  group: string;
  /**
   * "not-met": the model shows it not met; "missing": a property is unset (or
   * a neighbour's); "inside": a multiprocess without child page stands in for
   * processes / stores the model does not show (D-30).
   */
  kind: "not-met" | "missing" | "inside";
  /**
   * "missing": the fields this element leaves unset (RowResult.unsetFields);
   * without them (a neighbour's unknown) the properties the rule reads.
   * "not-met": the properties that satisfy the rule on this element type;
   * "inside": the black-box fields that answer the row.
   */
  properties: TodoProperty[];
  /** The planned run closes it for this element (chosen open mitigations). */
  plannedClosed: boolean;
}

export interface ElementTodo {
  elementId: string;
  items: TodoItem[];
}

export interface ComponentTodo {
  label: string;
  group: string;
  /** Properties one element of these types must show. */
  properties: TodoProperty[];
  elementTypes: string[];
  plannedClosed: boolean;
}

export interface TodoList {
  /** Elements with open items, most items first. */
  elements: ElementTodo[];
  /** Open rows one element of the component meets (quantifier "any"). */
  component: ComponentTodo[];
  /** Open rows within the target that only a statement (or a mitigation reference) can meet. */
  statements: { label: string; group: string }[];
  /** EN 50742 A: open rows on risk evidence, with the risks to treat or rate. */
  risks: { label: string; group: string; risks: string[] }[];
  /** EN 50742 A: open rows on project data (hazards, WoO, system definition), with what is missing. */
  project: { label: string; group: string; reasoning?: string; reason?: RowReason }[];
}

/** SL-T per FR, or "all" for a standard without levels. */
export type TodoTarget = Partial<Record<FoundationalRequirement, SecurityLevel>> | "all";

/** The row's SL-C level is needed for the target of its FR. */
function withinTarget(row: RowResult, target: TodoTarget): boolean {
  if (target === "all") return true;
  const level = target[row.group as FoundationalRequirement];
  return level !== undefined && (row.minSl ?? 1) <= level;
}

/** Unique by path and neighbour types, in first-seen order. */
function uniqueProperties(items: TodoProperty[]): TodoProperty[] {
  const seen = new Set<string>();
  return items.filter((p) => {
    const key = `${p.path}|${p.on?.join("/") ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function propertiesFor(edition: AnyEdition, row: RowResult, type: string | undefined, kind: TodoItem["kind"]): TodoProperty[] {
  const ids = edition.rows.find((r) => r.label === row.label)?.requirementIds ?? [];
  const out: TodoProperty[] = [];
  for (const id of ids) {
    for (const target of RULES_BY_ID.get(id)?.targets ?? []) {
      if (type && !(target.elementTypes as readonly string[]).includes(type)) continue;
      for (const check of target.satisfiedIf ?? []) out.push({ path: check.property });
      if (kind === "missing") {
        for (const check of target.appliesIf ?? []) out.push({ path: check.property });
        for (const n of [target.endpointIf, target.connectedIf]) {
          for (const check of n?.checks ?? []) out.push({ path: check.property, on: [...n!.elementTypes] });
        }
      }
    }
  }
  return uniqueProperties(out);
}

/** D-30c: the black-box "inside" fields that answer the row's Process / DataStore checks. */
function insideFieldsFor(edition: AnyEdition, row: RowResult): TodoProperty[] {
  const ids = edition.rows.find((r) => r.label === row.label)?.requirementIds ?? [];
  const out = new Set<string>();
  for (const id of ids) {
    for (const target of RULES_BY_ID.get(id)?.targets ?? []) {
      for (const type of ["Process", "DataStore"] as const) {
        if (!(target.elementTypes as readonly string[]).includes(type)) continue;
        const map: Readonly<Record<string, string>> = BLACK_BOX_FIELDS[type];
        for (const check of [...(target.appliesIf ?? []), ...(target.satisfiedIf ?? []), ...(target.satisfiedIfAll ?? [])]) {
          if (map[check.property]) out.add(map[check.property]);
        }
      }
    }
  }
  return [...out].map((path) => ({ path }));
}

export function buildTodoList(
  edition: AnyEdition,
  achieved: ComplianceResult,
  planned: ComplianceResult,
  target: TodoTarget,
  typeOf?: (id: string) => string | undefined,
): TodoList {
  const plannedRow = new Map(planned.rows.map((r) => [r.label, r]));
  const byElement = new Map<string, TodoItem[]>();
  const statements: TodoList["statements"] = [];
  const component: ComponentTodo[] = [];
  const risks: TodoList["risks"] = [];
  const project: TodoList["project"] = [];

  for (const row of achieved.rows) {
    if (!withinTarget(row, target)) continue;
    if (row.status === "needs-statement") {
      statements.push({ label: row.label, group: row.group });
      continue;
    }
    if (row.status !== "gap" && row.status !== "unknown") continue;
    const p = plannedRow.get(row.label);
    const rules = (edition.rows.find((r) => r.label === row.label)?.requirementIds ?? []).map((id) => RULES_BY_ID.get(id));
    // EN 50742 A: risk and project evidence — the risk tab or the project data, not the DFD.
    if (rules.some((rule) => rule?.external) && row.failing.length === 0 && row.unknown.length === 0) {
      if (row.risks?.length) risks.push({ label: row.label, group: row.group, risks: row.risks });
      else project.push({ label: row.label, group: row.group, reasoning: row.reasoning, ...(row.reason ? { reason: row.reason } : {}) });
      continue;
    }
    if (rules.length > 0 && rules.every((rule) => rule?.quantifier === "any")) {
      component.push({
        label: row.label,
        group: row.group,
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
        group: row.group,
        kind,
        properties:
          kind === "inside"
            ? insideFieldsFor(edition, row)
            : kind === "missing" && row.unsetFields?.[id]?.length
              ? // only what this element leaves unset (0.19 i18n follow-up)
                row.unsetFields[id].map((path) => ({ path }))
              : propertiesFor(edition, row, typeOf?.(id), kind),
        plannedClosed: p?.status === "met" || !stillOpen.has(id),
      };
      byElement.set(id, [...(byElement.get(id) ?? []), item]);
    };
    for (const id of row.failing) add(id, "not-met");
    const targetTypes = new Set(rules.flatMap((rule) => rule?.targets.flatMap((t) => t.elementTypes as readonly string[]) ?? []));
    for (const id of row.unknown) {
      const type = typeOf?.(id);
      add(id, type && !targetTypes.has(type) ? "inside" : "missing");
    }
  }

  const elements = [...byElement]
    .map(([elementId, items]) => ({ elementId, items }))
    .sort((a, b) => b.items.length - a.items.length || a.elementId.localeCompare(b.elementId));
  return { elements, component, statements, risks, project };
}
