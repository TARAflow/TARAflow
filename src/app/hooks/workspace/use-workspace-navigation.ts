// ==================== WORKSPACE NAVIGATION ====================
// Phase changes and the jump requests between tabs ("show in table",
// "show in graph", "open hazard", "show element"), split out of
// workspace-layout.tsx (MT-1). Also the safety gate: a hidden Hazard phase
// is never rendered.

import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import type { useToast } from "shared";
import { PhaseId } from "../../models/phase-types";
import type { Project } from "../../models/project-types";
import type { ComponentImportRunner } from "features/dfd";

type Toast = ReturnType<typeof useToast>;

export interface WorkspaceNavigationInput {
  activeProject: Project | undefined;
  activeProjectRef: MutableRefObject<Project | undefined>;
  activePhase: number;
  setActivePhase: (phase: number) => void;
  updateProject: (patch: Partial<Project> & { id: string }) => Promise<void>;
  toast: Toast;
}

export function useWorkspaceNavigation({
  activeProject,
  activeProjectRef,
  activePhase,
  setActivePhase,
  updateProject,
  toast,
}: WorkspaceNavigationInput) {
  // "Show in graph" from the asset table (FR-V13): DFD tab, asset graph view.
  const [graphFocusRequest, setGraphFocusRequest] = useState<{
    assetId: string;
  } | null>(null);
  // "Show in the diagram" from the Compliance to-do list: DFD tab, drawing,
  // the element selected.
  const [elementFocusRequest, setElementFocusRequest] = useState<{
    elementId: string;
    /** A tab of the element form to open (e.g. the component tab). */
    tab?: string;
  } | null>(null);
  // A component runner (update / refresh) started outside the DFD tab, e.g.
  // from the Overview's component accordion (6d): DFD tab, the editor path.
  const [componentRunRequest, setComponentRunRequest] = useState<{ runner: ComponentImportRunner } | null>(null);
  // "Show in table" from the asset graph (FR-V13, way back).
  const [tableHighlightRequest, setTableHighlightRequest] = useState<{
    assetId: string;
  } | null>(null);
  // "Open in Hazard tab" from a hazard's card in the asset graph (G9).
  const [hazardOpenRequest, setHazardOpenRequest] = useState<{
    hazardId: string;
  } | null>(null);

  const handlePhaseChange = useCallback(
    (phaseId: number) => {
      const current = activeProjectRef.current;
      if (!current) return;

      if (current.settings?.strictMode) {
        const currentStatus =
          current.phaseStatus[phaseId as keyof typeof current.phaseStatus];
        if (currentStatus === "not-started" && phaseId > 0) {
          const prevPhase =
            current.phaseStatus[
              (phaseId - 1) as keyof typeof current.phaseStatus
            ];
          if (prevPhase !== "complete") {
            toast.warning(
              "⚠️ Warning: Previous phase is not complete. Strict mode is enabled.",
            );
          }
        }
      }

      // A "show in table" mark belongs to that one jump; leaving the Assets
      // tab drops it, so a later visit does not mark the row again.
      if (phaseId !== PhaseId.Assets) setTableHighlightRequest(null);
      if (phaseId !== PhaseId.Hazard) setHazardOpenRequest(null);
      setActivePhase(phaseId);
      updateProject({ id: current.id, currentPhase: phaseId });
    },
    [activeProjectRef, setActivePhase, toast, updateProject],
  );

  // ── Safety gating ─────────────────────────────────────────────────────────
  // If safety relevance is turned off while the Hazard tab is active,
  // fall back to Overview so we never render a hidden/empty phase.
  useEffect(() => {
    if (!activeProject) return;
    const safetyRelevant = activeProject.info?.safetyRelevant ?? false;
    if (!safetyRelevant && activePhase === PhaseId.Hazard) {
      setActivePhase(PhaseId.General);
    }
  }, [activeProject, activePhase, setActivePhase]);

  // ── Jumps between tabs (request first, then the phase change) ─────────────
  const showInTable = useCallback(
    (assetId: string) => {
      setTableHighlightRequest({ assetId });
      handlePhaseChange(PhaseId.Assets);
    },
    [handlePhaseChange],
  );
  const showInGraph = useCallback(
    (assetId: string) => {
      setGraphFocusRequest({ assetId });
      handlePhaseChange(PhaseId.DFD);
    },
    [handlePhaseChange],
  );
  const openHazard = useCallback(
    (hazardId: string) => {
      handlePhaseChange(PhaseId.Hazard);
      setHazardOpenRequest({ hazardId });
    },
    [handlePhaseChange],
  );
  const showElement = useCallback(
    (elementId: string, tab?: string) => {
      setElementFocusRequest(tab ? { elementId, tab } : { elementId });
      handlePhaseChange(PhaseId.DFD);
    },
    [handlePhaseChange],
  );
  const runInDfd = useCallback(
    (runner: ComponentImportRunner) => {
      setComponentRunRequest({ runner });
      handlePhaseChange(PhaseId.DFD);
    },
    [handlePhaseChange],
  );

  return {
    handlePhaseChange,
    graphFocusRequest,
    elementFocusRequest,
    componentRunRequest,
    runInDfd,
    tableHighlightRequest,
    hazardOpenRequest,
    showInTable,
    showInGraph,
    openHazard,
    showElement,
  };
}
