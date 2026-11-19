// ==================== COMPLIANCE VIEW ====================
// Requirement matrices (Compliance tab, D-9): the tags select the standards,
// one sub-tab each (K-1); the model is prepared only while the tab is open
// (the analysis view is rebuilt for it), the frame evaluates the selected
// standard. Split out of workspace-layout.tsx (MT-1).

import { useMemo } from "react";
import { activeStandards, proposeDeviceCategories } from "features/compliance";
import { PhaseId } from "../../models/phase-types";
import type { Project } from "../../models/project-types";
import {
  complianceNameOf,
  complianceTypeOf,
  prepareProjectCompliance,
} from "../../services/compliance-report";
import { matrixRequirementOptions } from "../../utils/matrix-requirement-options";

export function useComplianceView(activeProject: Project | undefined, activePhase: number) {
  const tags = activeProject?.info?.tags;
  const complianceStandards = useMemo(() => activeStandards(tags), [tags]);
  // IEC-8b: the 62443 requirements a project mitigation can reference (form
  // in the threat / risk dialogs).
  const matrixRequirements = useMemo(() => matrixRequirementOptions(complianceStandards), [complianceStandards]);

  const complianceView = useMemo(() => {
    if (!activeProject || complianceStandards.length === 0 || activePhase !== PhaseId.Compliance) return undefined;
    const evaluation = prepareProjectCompliance(activeProject);
    if (!evaluation) return undefined;
    const elements = activeProject.dfd?.elements ?? [];
    const componentId = activeProject.compliance?.componentId;
    const component = elements.find((e) => e.id === componentId);
    return {
      ...evaluation,
      nameOf: complianceNameOf(activeProject),
      typeOf: complianceTypeOf(activeProject),
      componentOptions: elements
        .filter((e) => e.type === "Multiprocess" || e.type === "Process")
        .map((e) => ({ id: e.id, label: [e.displayId, e.name].filter(Boolean).join(" ") })),
      deviceProposal: proposeDeviceCategories(
        component ? { type: component.type, properties: component.properties as unknown as Record<string, unknown> } : undefined,
        elements.some((e) => e.type === "ChipBoundary" && evaluation.scope.has(e.id)),
      ),
    };
    // The evidence the evaluation reads — not every project change (e.g. the
    // current phase or the phase status) re-evaluates the matrix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activePhase,
    complianceStandards,
    activeProject?.dfd,
    activeProject?.threats,
    activeProject?.risks,
    activeProject?.attackTrees,
    activeProject?.assets,
    activeProject?.compliance,
    // EN 50742 A (CM-12): WoO, hazards and the system definition are evidence too.
    activeProject?.info,
    activeProject?.hazards,
    activeProject?.itemDefinition,
    // IEC-6: supporting claims cover matrix rows.
    activeProject?.cybersecurityConcept,
  ]);

  return { complianceStandards, matrixRequirements, complianceView };
}
