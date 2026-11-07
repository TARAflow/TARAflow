// src/tests/unit/app/hooks/workspace/use-workspace-navigation.test.ts
//
// MT-1: phase change, strict-mode warning, safety gate and the jump
// requests between tabs, on the hook alone (the layout-level behaviour is
// covered by tests/component/workspace-layout.characterization.test.tsx).

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Project } from "app/models/project-types";
import { PhaseId } from "app/models/phase-types";
import { useWorkspaceNavigation } from "app/hooks/workspace/use-workspace-navigation";

const project = (patch: Record<string, unknown> = {}): Project =>
  ({
    id: "p1",
    info: { name: "P", safetyRelevant: true },
    settings: { strictMode: false },
    phaseStatus: {},
    ...patch,
  }) as unknown as Project;

function setup(p: Project, activePhase: number = PhaseId.General) {
  const setActivePhase = vi.fn();
  const updateProject = vi.fn(async () => {});
  const toast = { warning: vi.fn() } as never;
  const activeProjectRef = { current: p as Project | undefined };
  const hook = renderHook(
    ({ phase, proj }: { phase: number; proj: Project }) =>
      useWorkspaceNavigation({
        activeProject: proj,
        activeProjectRef,
        activePhase: phase,
        setActivePhase,
        updateProject,
        toast,
      }),
    { initialProps: { phase: activePhase, proj: p } },
  );
  return { ...hook, setActivePhase, updateProject, toast: toast as { warning: ReturnType<typeof vi.fn> }, activeProjectRef };
}

describe("useWorkspaceNavigation", () => {
  it("changes the phase and records it on the project", () => {
    const s = setup(project());
    act(() => s.result.current.handlePhaseChange(PhaseId.Threats));
    expect(s.setActivePhase).toHaveBeenCalledWith(PhaseId.Threats);
    expect(s.updateProject).toHaveBeenCalledWith({ id: "p1", currentPhase: PhaseId.Threats });
  });

  it("does nothing without an active project", () => {
    const s = setup(project());
    s.activeProjectRef.current = undefined;
    act(() => s.result.current.handlePhaseChange(PhaseId.Threats));
    expect(s.setActivePhase).not.toHaveBeenCalled();
  });

  it("warns in strict mode when the previous phase is not complete", () => {
    const s = setup(
      project({
        settings: { strictMode: true },
        phaseStatus: { [PhaseId.Threats]: "not-started", [PhaseId.Threats - 1]: "in-progress" },
      }),
    );
    act(() => s.result.current.handlePhaseChange(PhaseId.Threats));
    expect(s.toast.warning).toHaveBeenCalledTimes(1);
    expect(s.setActivePhase).toHaveBeenCalledWith(PhaseId.Threats);
  });

  it("does not warn in strict mode when the previous phase is complete", () => {
    const s = setup(
      project({
        settings: { strictMode: true },
        phaseStatus: { [PhaseId.Threats]: "not-started", [PhaseId.Threats - 1]: "complete" },
      }),
    );
    act(() => s.result.current.handlePhaseChange(PhaseId.Threats));
    expect(s.toast.warning).not.toHaveBeenCalled();
  });

  it("falls back to the Overview when the Hazard phase is active without safety relevance", () => {
    const s = setup(project({ info: { name: "P", safetyRelevant: false } }), PhaseId.Hazard);
    expect(s.setActivePhase).toHaveBeenCalledWith(PhaseId.General);
  });

  it("keeps the Hazard phase with safety relevance", () => {
    const s = setup(project(), PhaseId.Hazard);
    expect(s.setActivePhase).not.toHaveBeenCalled();
  });

  it("show in table: request set, Assets opened; leaving Assets clears it", () => {
    const s = setup(project());
    act(() => s.result.current.showInTable("a1"));
    expect(s.result.current.tableHighlightRequest).toEqual({ assetId: "a1" });
    expect(s.setActivePhase).toHaveBeenLastCalledWith(PhaseId.Assets);
    act(() => s.result.current.handlePhaseChange(PhaseId.Risk));
    expect(s.result.current.tableHighlightRequest).toBeNull();
  });

  it("open hazard: request set, Hazard opened; leaving Hazard clears it", () => {
    const s = setup(project());
    act(() => s.result.current.openHazard("h1"));
    expect(s.result.current.hazardOpenRequest).toEqual({ hazardId: "h1" });
    expect(s.setActivePhase).toHaveBeenLastCalledWith(PhaseId.Hazard);
    act(() => s.result.current.handlePhaseChange(PhaseId.Assets));
    expect(s.result.current.hazardOpenRequest).toBeNull();
  });

  it("show in graph / show element: DFD opened with the request; they survive a phase change", () => {
    const s = setup(project());
    act(() => s.result.current.showInGraph("a2"));
    act(() => s.result.current.showElement("e1"));
    expect(s.setActivePhase).toHaveBeenLastCalledWith(PhaseId.DFD);
    act(() => s.result.current.handlePhaseChange(PhaseId.Risk));
    expect(s.result.current.graphFocusRequest).toEqual({ assetId: "a2" });
    expect(s.result.current.elementFocusRequest).toEqual({ elementId: "e1" });
  });

  it("keeps the callbacks stable across renders", () => {
    const s = setup(project());
    const first = s.result.current;
    s.rerender({ phase: PhaseId.Risk, proj: project() });
    expect(s.result.current.handlePhaseChange).toBe(first.handlePhaseChange);
    expect(s.result.current.showInTable).toBe(first.showInTable);
  });
});
