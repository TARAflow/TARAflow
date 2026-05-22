// ==================== PROJECT CONTEXT ====================
// Single source of truth for all project state and operations.
// Consumed by WorkspaceLayout and any future feature that needs
// project access without prop drilling.

import { createContext, useContext } from "react";
import type { Project, ProjectMetadata } from "../models/project-types";

// ==================== CONTEXT TYPE ====================

export interface ProjectContextValue {
  // ── State (read-only for consumers) ──────────────────────────────────────

  projects: Project[];
  activeProject: Project | undefined;
  activeProjectId: string | null;
  openProjects: Project[];
  recentProjectsMetadata: ProjectMetadata[];
  isLoading: boolean;
  activePhase: number;

  // ── Navigation ────────────────────────────────────────────────────────────

  setActivePhase: (phase: number) => void;

  // ── Core write channel ────────────────────────────────────────────────────
  // All feature tabs call this when their data changes.
  // Implemented with useRef internally — no stale-closure risk.

  updateProject: (project: Project) => Promise<void>;

  // ── Project lifecycle ─────────────────────────────────────────────────────

  switchProject: (projectId: string) => void;
  saveProject: (projectId: string) => Promise<void>;
}

// ==================== CONTEXT ============================================

export const ProjectContext = createContext<ProjectContextValue | null>(null);

// ==================== HOOK ===============================================

/**
 * Typed access to ProjectContext.
 * Throws if used outside of ProjectShell — catches mis-use at dev time.
 */
export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error(
      "useProjectContext must be used inside <ProjectShell>. " +
        "Make sure WorkspaceLayout is rendered as a child of ProjectShell.",
    );
  }
  return ctx;
}