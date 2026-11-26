// Merging two project mitigations (0.20 item 15): a scope override that is
// the same in another key order is no conflict.
import { describe, it, expect } from "vitest";
import { mergeProjectMitigationConflicts } from "app/services/project-mitigation-usage";
import type { Project } from "app/models/project-types";

const project = (into: object, from: object) =>
  ({
    risks: {
      risks: [
        {
          id: "R-1",
          threatDisplayId: "T-1",
          selectedMitigations: [
            { id: "M-A", status: "open", ...into },
            { id: "M-B", status: "open", ...from },
          ],
        },
      ],
    },
  }) as unknown as Pick<Project, "risks">;

describe("mergeProjectMitigationConflicts — key order", () => {
  it("the same scope override in another key order: no conflict", () => {
    const p = project({ scopeOverride: { kind: "elements", ids: ["e1"] } }, { scopeOverride: { ids: ["e1"], kind: "elements" } });
    expect(mergeProjectMitigationConflicts(p, "M-B", "M-A")).toEqual([]);
  });

  it("characterization: a different override or status is a conflict; equal values none", () => {
    expect(mergeProjectMitigationConflicts(project({ scopeOverride: { kind: "elements", ids: ["e1"] } }, { scopeOverride: { kind: "elements", ids: ["e2"] } }), "M-B", "M-A")).toEqual(["T-1"]);
    expect(mergeProjectMitigationConflicts(project({ status: "implemented" }, { status: "planned" }), "M-B", "M-A")).toEqual(["T-1"]);
    expect(mergeProjectMitigationConflicts(project({ ticketId: "J-1" }, { ticketId: "J-1" }), "M-B", "M-A")).toEqual([]);
  });
});
