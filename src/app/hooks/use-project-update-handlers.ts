// ==================== USE PROJECT UPDATE HANDLERS ====================
// The tab handlers that write into the project, pinned to the project the
// tab was opened with (FX-8) — like the Asset, Hazard, Risk and Audit
// handlers. A save that lands after a project switch (the DFD editor's
// debounced save flushed on unmount, a threat generation that finishes
// late) belongs to the project it was made in; reading "whatever is active
// now" wrote it into the incoming project.
//
// Each handler resolves its project by id from `projectsRef` at call time:
// the latest state of THAT project, never a stale snapshot.

import { useMemo, type MutableRefObject } from "react";
import {
  emptyItemDefinition,
  newAssumption,
  issuedAssumptionNumber,
  withAssumptions,
  type Assumption,
  type ComplianceData,
  type CybersecurityConcept,
} from "shared";
import type { DFDUpdateResult } from "features/dfd";
import type { ThreatUpdateResult } from "features/threats";
import type { DocUpdateResult } from "features/documentation";
import type { IntegrationTabData } from "features/integration";
import type { Project } from "../models/project-types";
import { buildDfdUpdate } from "../services/dfd-update-patch";
import { rememberLocalSettings } from "../services/local-user-settings";
import {
  mergeProjectMitigationConflicts,
  mergeProjectMitigationRefs,
  projectMitigationUsage,
} from "../services/project-mitigation-usage";

type UpdateProject = (patch: Partial<Project> & { id: string }) => Promise<void>;

export interface ProjectUpdateHandlerDeps {
  /** The project the tabs show now — the handlers stay with it. */
  projectId: string;
  projectsRef: MutableRefObject<Project[]>;
  updateProject: UpdateProject;
  /** Asset relations the DFD update could not apply (stale data, rules). */
  onRejectedRelations?: (rejected: readonly { reason: string }[]) => void;
}

export function makeProjectUpdateHandlers({
  projectId,
  projectsRef,
  updateProject,
  onRejectedRelations,
}: ProjectUpdateHandlerDeps) {
  const project = () => projectsRef.current.find((p) => p.id === projectId);

  return {
    handleDFDUpdate: async (updates: DFDUpdateResult) => {
      const current = project();
      if (!current) return;
      const { patch, rejectedA2AOps } = buildDfdUpdate(current, updates);
      if (rejectedA2AOps.length > 0) onRejectedRelations?.(rejectedA2AOps);
      await updateProject(patch);
    },

    handleThreatsUpdate: async (updates: ThreatUpdateResult) => {
      const current = project();
      if (!current) return;
      await updateProject({ id: current.id, threats: updates.threats, phaseStatus: updates.phaseStatus });
    },

    // Trust boundary form → a new Item Definition assumption (A-3). Synchronous:
    // the form links the returned id right away.
    handleCreateAssumption: (text: string): Assumption => {
      const current = project();
      const def = current?.itemDefinition ?? emptyItemDefinition();
      const created = newAssumption(def.assumptions, text, issuedAssumptionNumber(def));
      if (current) {
        void updateProject({ id: current.id, itemDefinition: withAssumptions(def, [...def.assumptions, created]) });
      }
      return created;
    },

    // Compliance tab → project.compliance (iec-62443-4-2-cra-coverage.md D-8).
    handleComplianceChange: (compliance: ComplianceData) => {
      const current = project();
      if (current) void updateProject({ id: current.id, compliance });
    },

    // Risk dialog → goals and claims (ISO 21434 plan Phase 4, decision 25).
    handleConceptChange: (cybersecurityConcept: CybersecurityConcept) => {
      const current = project();
      if (current) void updateProject({ id: current.id, cybersecurityConcept });
    },

    handleDocUpdate: (updates: DocUpdateResult) => {
      const current = project();
      if (!current) return;
      void updateProject({ id: current.id, documentation: updates.documentation, phaseStatus: updates.phaseStatus });
    },

    handleIntegrationUpdate: (data: IntegrationTabData) => {
      const current = project();
      if (!current) return;
      rememberLocalSettings(current.id, null, data.integration);
      void updateProject({ id: current.id, integration: data.integration });
    },

    // Project mitigations M-C-nnn (custom mitigation catalog CM-3): usage and
    // merge span threats, risks and attack trees.
    projectMitigationRefs: {
      usage: (id: string) => {
        const current = project();
        return current ? projectMitigationUsage(current, id) : { threats: [], risks: [], attackTrees: [] };
      },
      mergeConflicts: (fromId: string, intoId: string) => {
        const current = project();
        return current ? mergeProjectMitigationConflicts(current, fromId, intoId) : [];
      },
      merge: (fromId: string, intoId: string) => {
        const current = project();
        if (!current || mergeProjectMitigationConflicts(current, fromId, intoId).length > 0) return;
        void updateProject({ id: current.id, ...mergeProjectMitigationRefs(current, fromId, intoId) });
      },
    },
  };
}

export type ProjectUpdateHandlers = ReturnType<typeof makeProjectUpdateHandlers>;

/** The handlers for the project shown now; new handlers only when the project changes. */
export function useProjectUpdateHandlers(deps: ProjectUpdateHandlerDeps): ProjectUpdateHandlers {
  const { projectId, projectsRef, updateProject, onRejectedRelations } = deps;
  return useMemo(
    () => makeProjectUpdateHandlers({ projectId, projectsRef, updateProject, onRejectedRelations }),
    [projectId, projectsRef, updateProject, onRejectedRelations],
  );
}
