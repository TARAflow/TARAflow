// src/app/utils/matrix-requirement-options.ts
//
// IEC-8b: what the project mitigation form offers as IEC 62443-4-2
// references — every requirement of the active 62443 editions, labelled with
// the row that names it and the short title ("CR 7.8 — …"), in edition order;
// and the requirements a mitigation's DFD effects meet already (D-29).

import { REQUIREMENT_TEXTS, requirementsMetBy, type StandardModule } from "features/compliance";
import type { MatrixRequirements } from "shared/hooks/matrix-requirements";

/** Undefined when no IEC 62443-4-2 edition is active — the form then shows no field. */
export function matrixRequirementOptions(standards: readonly StandardModule[]): MatrixRequirements | undefined {
  const editions = standards.filter((s) => s.family === "iec-62443-4-2").map((s) => s.edition);
  if (editions.length === 0) return undefined;
  const labels = new Map<string, string>();
  for (const edition of editions) {
    for (const row of edition.rows) {
      for (const id of row.requirementIds) {
        if (labels.has(id)) continue;
        const title = REQUIREMENT_TEXTS[id as keyof typeof REQUIREMENT_TEXTS]?.title;
        labels.set(id, title ? `${row.label} — ${title}` : row.label);
      }
    }
  }
  return {
    options: [...labels].map(([id, label]) => ({ id, label })),
    derivedFrom: (effects) => [...new Set(effects.flatMap((e) => requirementsMetBy(e)))].filter((id) => labels.has(id)),
  };
}
