// ==================== CLOSED-LOOP DATA ====================
// Control instances derived from threats / risks / DFD and the security
// drift against the DFD (closed loop), plus the attack-path anchor targets
// the Risk tab's coverage badge uses. Split out of workspace-layout.tsx
// (MT-1).

import { useMemo } from "react";
import { getAllMitigations } from "features/threats";
import type { Project } from "../../models/project-types";
import { attackPathControlTargets } from "../../utils/attack-path-control-targets";
import { useControlInstanceDerivation } from "../use-control-instance-derivation";
import { useSecurityDrift } from "../use-security-drift";

export function useClosedLoopData(
  activeProject: Project | undefined,
  /** The project mitigation catalog (M-C-nnn) — getAllMitigations() includes it. */
  customMitigations: unknown,
) {
  // getAllMitigations() reads the module-level catalog and the project
  // mitigation registry; it changes only with the project mitigations, so it
  // is memoized on them for a stable reference across renders.
  const mitigationCatalog = useMemo(
    () => getAllMitigations(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customMitigations],
  );

  // Attack-path risks reach the closed loop through their tree's anchor
  // (closed-loop review CL-3).
  const attackTrees = activeProject?.attackTrees;
  const assets = activeProject?.assets?.assets;
  const dfd = activeProject?.dfd;
  const anchorTargets = useMemo(
    () => attackPathControlTargets(attackTrees, assets, dfd),
    [attackTrees, assets, dfd],
  );

  const controlInstances = useControlInstanceDerivation(
    activeProject?.threats ?? null,
    activeProject?.risks ?? null,
    dfd ?? null,
    mitigationCatalog,
    anchorTargets,
  );

  const securityDrifts = useSecurityDrift(controlInstances, dfd ?? null);

  return { anchorTargets, controlInstances, securityDrifts };
}
