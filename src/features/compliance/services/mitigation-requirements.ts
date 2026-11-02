// ==================== MITIGATION → REQUIREMENTS ====================
// Which IEC 62443-4-2 requirements a catalog mitigation meets, and for which
// element types (iec-62443-4-2-cra-coverage.md D-29):
//
//   referenced  the hand-kept `iec62443` ids of the catalog — deliberate,
//               valid for any element the mitigation's risks concern (type C
//               rows need them: there is no property to derive from)
//   derived     from `affectsProperties`: an effect whose expected value
//               satisfies an A / B rule target of the effect's element type
//               meets that requirement — bound to that element type
//
// Pure: the catalog comes in as plain shapes, the feature imports no other.

import { ALL_EVIDENCE_RULES, EVIDENCE_RULES } from "../data/evidence-rules";
import type { PropertyCheck, RequirementId } from "../models/compliance-types";

/** One `affectsProperties` entry of the mitigation catalog. */
export interface PropertyEffect {
  targetType: string;
  property: string;
  expectedValue: unknown;
}

/** The parts of a catalog mitigation the matrix reads. */
export interface MitigationRequirementSource {
  id: string;
  iec62443?: readonly string[];
  affectsProperties?: readonly PropertyEffect[];
}

export interface MitigationRequirement {
  requirementId: RequirementId;
  /** Derived: the element types the effect sets; absent = referenced, any element. */
  elementTypes?: readonly string[];
}

function accepts(check: PropertyCheck, value: unknown): boolean {
  if (check.in) return check.in.includes(value);
  if (check.notIn) return value !== undefined && !check.notIn.includes(value);
  return value !== undefined;
}

/** Requirements an effect meets: some A / B rule target of its type accepts the value. */
export function requirementsMetBy(effect: PropertyEffect): RequirementId[] {
  return ALL_EVIDENCE_RULES.filter(
    (rule) =>
      rule.type !== "C" &&
      rule.targets.some(
        (target) =>
          ((target.elementTypes as readonly string[]).includes(effect.targetType) &&
            [...(target.satisfiedIf ?? []), ...(target.satisfiedIfAll ?? [])].some(
              (check) => check.property === effect.property && accepts(check, effect.expectedValue),
            )) ||
          // P-7: the rule reads the interface the flow passes.
          (effect.targetType === "Interface" &&
            (target.interfaceIf ?? []).some((check) => check.property === effect.property && accepts(check, effect.expectedValue))),
      ),
  ).map((rule) => rule.id);
}

/** Referenced and derived requirements of one mitigation; one entry per id and binding. */
export function mitigationRequirements(mitigation: MitigationRequirementSource): MitigationRequirement[] {
  const referenced = (mitigation.iec62443 ?? []).filter((id): id is RequirementId => EVIDENCE_RULES.has(id as RequirementId));
  const derivedTypes = new Map<RequirementId, Set<string>>();
  for (const effect of mitigation.affectsProperties ?? []) {
    for (const id of requirementsMetBy(effect)) {
      if (referenced.includes(id)) continue;
      if (!derivedTypes.has(id)) derivedTypes.set(id, new Set());
      derivedTypes.get(id)!.add(effect.targetType);
    }
  }
  return [
    ...referenced.map((requirementId) => ({ requirementId })),
    ...[...derivedTypes].map(([requirementId, types]) => ({ requirementId, elementTypes: [...types] })),
  ];
}

/** Element types an A / B rule checks — incl. the interfaces its flows pass (P-7); empty for C rules and rules on the component as a whole. */
export function ruleElementTypes(id: RequirementId): Set<string> {
  const rule = EVIDENCE_RULES.get(id);
  if (!rule || rule.type === "C") return new Set();
  return new Set(rule.targets.flatMap((t) => [...(t.elementTypes as readonly string[]), ...(t.interfaceIf?.length ? ["Interface"] : [])]));
}

/** Open flows of a rule that reads their interfaces leave those interfaces open too (P-7). */
function withPassedInterfaces(id: RequirementId, open: ReadonlySet<string>): ReadonlySet<string> {
  const readsInterfaces = EVIDENCE_RULES.get(id)?.targets.some((t) => t.interfaceIf?.length);
  return readsInterfaces && open.has("DataFlow") ? new Set([...open, "Interface"]) : open;
}

/**
 * Catalog mitigations to suggest for a row (D-29): they meet one of its
 * requirements on a type of the elements still open. A referenced id counts
 * when the mitigation sets no property of the rule's types (a deliberately
 * wider reference) or sets one on an open type; without open elements (C
 * rows, statements needed) every mitigation meeting the requirement is shown.
 */
export function suggestMitigations<T extends MitigationRequirementSource>(
  catalog: readonly T[],
  requirementIds: readonly RequirementId[],
  openElementTypes: ReadonlySet<string> = new Set(),
): T[] {
  const wanted = new Set(requirementIds);
  return catalog.filter((mitigation) =>
    mitigationRequirements(mitigation).some((req) => {
      if (!wanted.has(req.requirementId)) return false;
      if (openElementTypes.size === 0) return true;
      const open = withPassedInterfaces(req.requirementId, openElementTypes);
      if (req.elementTypes) return req.elementTypes.some((type) => open.has(type));
      const ruleTypes = ruleElementTypes(req.requirementId);
      const effectTypes = (mitigation.affectsProperties ?? []).map((e) => e.targetType).filter((type) => ruleTypes.has(type));
      return effectTypes.length === 0 || effectTypes.some((type) => open.has(type));
    }),
  );
}
