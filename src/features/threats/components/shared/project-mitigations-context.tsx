// features/threats/components/shared/project-mitigations-context.tsx
//
// Lets the threat dialogs create and edit project mitigations M-C-nnn
// (custom mitigation catalog design CM-3) without threading callbacks through
// the tables. Provided by the Threats tab, which owns
// threats.configuration; absent (null) = read-only, the buttons stay hidden.

import React, { createContext, useContext } from "react";
import type { ProjectMitigation } from "../../models/threat-types";
import type { ProjectMitigationInput } from "../../services/project-mitigations";

export interface ProjectMitigationsApi {
  entries: readonly ProjectMitigation[];
  /** Adds the entry to the project; returns its id. */
  add: (input: ProjectMitigationInput) => string;
  update: (id: string, input: ProjectMitigationInput) => void;
}

const ProjectMitigationsContext = createContext<ProjectMitigationsApi | null>(null);

export const ProjectMitigationsProvider: React.FC<{ value: ProjectMitigationsApi | null; children: React.ReactNode }> = ({
  value,
  children,
}) => <ProjectMitigationsContext.Provider value={value}>{children}</ProjectMitigationsContext.Provider>;

export function useProjectMitigations(): ProjectMitigationsApi | null {
  return useContext(ProjectMitigationsContext);
}
