// src/tests/unit/app/hooks/use-project-update-handlers.test.ts
//
// FX-8: the writing tab handlers stay with the project they were made for.
// A save that lands after a project switch — the DFD editor's debounced
// save flushed on unmount, a late threat generation — writes into THAT
// project, read at call time (its latest state), never into the project
// active by then.

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Project } from "app/models/project-types";

vi.mock("app/services/dfd-update-patch", () => ({
  // The patch names the project it was built from — pinning is what counts here.
  buildDfdUpdate: (current: Project) => ({
    patch: { id: current.id, info: { ...current.info, name: `dfd of ${current.info.name}` } },
    rejectedA2AOps: [],
  }),
}));
vi.mock("app/services/local-user-settings", () => ({ rememberLocalSettings: vi.fn() }));
vi.mock("app/services/project-mitigation-usage", () => ({
  projectMitigationUsage: (current: Project) => ({ threats: [current.id], risks: [], attackTrees: [] }),
  mergeProjectMitigationConflicts: () => [],
  mergeProjectMitigationRefs: (current: Project) => ({ info: current.info }),
}));

import { useProjectUpdateHandlers } from "app/hooks/use-project-update-handlers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const project = (id: string, name: string): Project =>
  ({
    id,
    info: { name },
    itemDefinition: { assumptions: [] },
    threats: { perElementTables: [], perInteractionTables: [] },
    risks: { risks: [] },
    attackTree: null,
  }) as unknown as Project;

function setup() {
  const projectsRef = { current: [project("A", "Alpha"), project("B", "Beta")] };
  const updateProject = vi.fn(async (_patch: Any) => {});
  const { result, rerender } = renderHook(
    ({ projectId }) => useProjectUpdateHandlers({ projectId, projectsRef, updateProject }),
    { initialProps: { projectId: "A" } },
  );
  const ofA = result.current;
  rerender({ projectId: "B" }); // the switch
  return { projectsRef, updateProject, ofA, ofB: result.current };
}

const ids = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map(([patch]) => (patch as { id: string }).id);

describe("useProjectUpdateHandlers — pinned to their project (FX-8)", () => {
  it("every writing handler of A writes into A after the switch to B", async () => {
    const { ofA, updateProject } = setup();
    await ofA.handleDFDUpdate({ dfd: {}, phaseStatus: {}, lastModified: "" } as Any);
    await ofA.handleThreatsUpdate({ threats: { perElementTables: [] }, phaseStatus: {} } as Any);
    ofA.handleCreateAssumption("Housing is sealed");
    ofA.handleComplianceChange({ standards: {} } as Any);
    ofA.handleConceptChange({ goals: [] } as Any);
    ofA.handleDocUpdate({ documentation: {}, phaseStatus: {} } as Any);
    ofA.handleIntegrationUpdate({ integration: null } as Any);
    expect(ids(updateProject)).toEqual(["A", "A", "A", "A", "A", "A", "A"]);
    expect(updateProject.mock.calls[0][0].info.name).toBe("dfd of Alpha");
  });

  it("project mitigations of A: usage and merge read and write A", () => {
    const { ofA, updateProject } = setup();
    expect(ofA.projectMitigationRefs.usage("M-C-001").threats).toEqual(["A"]);
    ofA.projectMitigationRefs.merge("M-C-001", "M-C-002");
    expect(ids(updateProject)).toEqual(["A"]);
    expect(updateProject.mock.calls[0][0].info.name).toBe("Alpha");
  });

  it("the handlers handed out after the switch write into B", async () => {
    const { ofB, updateProject } = setup();
    await ofB.handleThreatsUpdate({ threats: {}, phaseStatus: {} } as Any);
    ofB.handleComplianceChange({} as Any);
    expect(ids(updateProject)).toEqual(["B", "B"]);
  });

  it("a late call sees the latest state of its project, not a snapshot", () => {
    const { ofA, projectsRef, updateProject } = setup();
    projectsRef.current = [
      { ...projectsRef.current[0], itemDefinition: { assumptions: [{ id: "A-1", text: "x" }] } } as Any,
      projectsRef.current[1],
    ];
    ofA.handleCreateAssumption("second");
    const assumptions = updateProject.mock.calls[0][0].itemDefinition.assumptions;
    expect(assumptions.map((a: Any) => a.text)).toEqual(["x", "second"]);
  });

  it("a closed project: the late call writes nothing", async () => {
    const { ofA, projectsRef, updateProject } = setup();
    projectsRef.current = [projectsRef.current[1]];
    await ofA.handleDFDUpdate({ dfd: {}, phaseStatus: {}, lastModified: "" } as Any);
    ofA.handleDocUpdate({ documentation: {}, phaseStatus: {} } as Any);
    expect(updateProject).not.toHaveBeenCalled();
  });

  it("same project → same handlers (no needless re-renders of the tabs)", () => {
    const projectsRef = { current: [project("A", "Alpha")] };
    const updateProject = vi.fn(async () => {});
    const { result, rerender } = renderHook(() => useProjectUpdateHandlers({ projectId: "A", projectsRef, updateProject }));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
