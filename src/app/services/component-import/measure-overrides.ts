// ==================== MEASURE OVERRIDES ====================
// Multi-project TARA I7 (5), phase 3d-2b: the machine marks a measure of the
// component "not effective here" in one instance — downgrade only (there is
// no "effective here" against the component's evidence), with a mandatory
// rationale. The treatments read model treats it like "not effective", so
// the residual risk of every risk relying on it is not credited (3d-2a).
// Pure: returns the new components block; the app writes it (the audit diff
// detects it with the instance).

import type { Project } from "../../models/project-types";

type Components = NonNullable<Project["components"]>;

/** Marks (rationale) or withdraws (null) "not effective here" for one measure of one instance. */
export function withMeasureOverride(
  components: Components,
  instanceId: string,
  measureId: string,
  rationale: string | null,
  today: string,
): Components {
  if (rationale !== null && !rationale.trim()) throw new Error("Marking a measure not effective here needs a rationale.");
  return {
    ...components,
    instances: components.instances.map((i) => {
      if (i.id !== instanceId) return i;
      const others = (i.measureOverrides ?? []).filter((o) => o.measureId !== measureId);
      const next = rationale !== null ? [...others, { measureId, rationale: rationale.trim(), date: today }] : others;
      const { measureOverrides: _old, ...rest } = i;
      return next.length > 0 ? { ...rest, measureOverrides: next } : rest;
    }),
  };
}

/** Overrides naming a measure the component no longer chooses for any risk (e.g. after an update). */
export function unknownMeasureOverrides(instance: Components["instances"][number], imported: Components["imports"][number]): string[] {
  const chosen = new Set(imported.snapshot.risks.flatMap((r) => r.selectedMitigations.map((m) => m.id).filter((id): id is string => !!id)));
  return (instance.measureOverrides ?? []).map((o) => o.measureId).filter((id) => !chosen.has(id));
}
