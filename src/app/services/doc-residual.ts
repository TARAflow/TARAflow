// ==================== CREDITED RESIDUAL IN THE REPORT ====================
// Multi-project TARA I7 (4), phase 3d-2a: the report counts only the
// residual risk that holds. Applied ONCE, when the report data is built —
// the app's transform (doc-transform.ts) and the CLI reporter
// (taraflow-reporter/cli/to-doc-project-data.ts) both call docResidualView,
// so every reader in the generation path (risk tables, the ISO scenario
// roll-up, the traceability chain, PDF fills) sees the credited values
// without reading them itself. The blockers go along in
// DocComputedValues.uncreditedResiduals for the "not credited" note.

import { withCreditedResidual, type UncreditedResiduals } from "../../shared";
import type { Project } from "../models/project-types";
import { uncreditedResiduals } from "../utils/component-treatments";

export interface DocResidualView {
  /** The risk register with the credited residual (a risk that counts stays the same object). */
  risks: Project["risks"] | null;
  uncredited: UncreditedResiduals;
}

export function docResidualView(project: Pick<Project, "components" | "risks">): DocResidualView {
  const uncredited = uncreditedResiduals(project);
  const risks = project.risks ?? null;
  if (!risks || uncredited.size === 0) return { risks, uncredited };
  return { risks: { ...risks, risks: risks.risks.map((r) => withCreditedResidual(r, uncredited)) }, uncredited };
}
