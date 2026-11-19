// ==================== CITED COMPONENT CLAIMS ====================
// Multi-project TARA phase 4c (design §8.1; decided with the user and the
// second instance 2026-11-09): the machine cites a SUPPORTING claim of an
// imported component as evidence for requirement-matrix rows, like it links
// a claim of its own — stored per instance (ComponentInstance.citedClaims,
// the qualified requirement ids it is cited for). Whether a citation counts
// is derived, never stored, by the same rule as the component's measures
// (I7): only when every assumption of use behind the claim
// (claim.assumptionIds) is fulfilled in this instance with implemented
// evidence, or not applicable — otherwise "unclear" (open, evidence not
// implemented) or "not effective" (not fulfilled, invalid in the
// component). And it covers only the instance's elements (the matrix checks
// the row's open elements against `concernsElementIds`). Pure.

import type { Project } from "../../models/project-types";
import { aouContextOf, effectivenessOf, type MeasureEffectiveness } from "../../utils/component-treatments";
import { implementedMachineMeasures } from "./assumption-status";
import { componentOwnership } from "./component-scope";
import { instanceLabel } from "./instance-quantity";

type Components = NonNullable<Project["components"]>;

/** A supporting claim of an instance as the matrix and the row dialog see it. */
export interface InstanceClaim {
  instanceId: string;
  claimId: string;
  /** "SD1 CLM-03" */
  displayId: string;
  statement: string;
  responsibleParty?: string;
  /** "SD1 · Smoke Detector" */
  instanceLabel: string;
  /** The component's own requirement links (qualified) — the suggestion. */
  componentRequirements: string[];
  /** Where the machine cites it (qualified); empty = not cited. */
  citedRequirements: string[];
  /** In this instance, by its assumptions (I7). */
  state: MeasureEffectiveness;
  /** The instance's elements and flows — the only ones the citation covers. */
  concernsElementIds: string[];
}

/** Every supporting claim of every instance, with its citation and state. */
export function instanceClaims(project: Pick<Project, "components" | "risks">): InstanceClaim[] {
  const components: Components | null | undefined = project.components;
  if (!components) return [];
  const done = implementedMachineMeasures(project.risks?.risks);
  const owners = componentOwnership({ components });
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  return components.instances.flatMap((instance) => {
    const imported = importsById.get(instance.importId);
    if (!imported) return [];
    const snapshot = imported.snapshot;
    const { aouStatus, evidencePending } = aouContextOf(instance, done);
    const cited = new Map((instance.citedClaims ?? []).map((c) => [c.claimId, c.requirements]));
    const concerns = [...owners].filter(([, o]) => o.prefix === instance.prefix).map(([id]) => id);
    return (snapshot.concept?.claims ?? [])
      .filter((c) => c.kind === "supporting")
      .map((c): InstanceClaim => {
        const relies = (snapshot.assumptions ?? []).filter((a) => c.assumptionIds.includes(a.id));
        return {
          instanceId: instance.id,
          claimId: c.id,
          displayId: `${instance.prefix} ${c.displayId}`,
          statement: c.statement,
          ...(c.responsibleParty ? { responsibleParty: c.responsibleParty } : {}),
          instanceLabel: instanceLabel(instance, imported.name),
          componentRequirements: [...(c.requirements ?? [])],
          citedRequirements: [...(cited.get(c.id) ?? [])],
          state: effectivenessOf("implemented", relies, aouStatus, undefined, evidencePending).effectiveness,
          concernsElementIds: concerns,
        };
      });
  });
}

/** Cites (cite = true) or withdraws a claim of an instance for a row's requirements. */
export function withCitedClaim(
  components: Components,
  instanceId: string,
  claimId: string,
  requirements: readonly string[],
  cite: boolean,
  today: string,
): Components {
  return {
    ...components,
    instances: components.instances.map((i) => {
      if (i.id !== instanceId) return i;
      const current = (i.citedClaims ?? []).find((c) => c.claimId === claimId);
      const others = (i.citedClaims ?? []).filter((c) => c.claimId !== claimId);
      const reqs = cite
        ? [...new Set([...(current?.requirements ?? []), ...requirements])]
        : (current?.requirements ?? []).filter((r) => !requirements.includes(r));
      const next = reqs.length > 0 ? [...others, { claimId, requirements: reqs, date: cite ? today : (current?.date ?? today) }] : others;
      const { citedClaims: _old, ...rest } = i;
      return next.length > 0 ? { ...rest, citedClaims: next } : rest;
    }),
  };
}
