// A form edit (a description) saves the records only — the DFD's
// completeness and phase status follow from the records and the last
// validation's findings (same rule as on a diagram save).
import { describe, it, expect } from "vitest";
import { withCompleteness } from "features/dfd/services/dfd-completeness";
import type { DFDData } from "features/dfd/models/dfd-types";

const dfd = (described: boolean[], findings: { errors?: number; warnings?: number } = {}) =>
  ({
    xml: "",
    elements: described.map((d, i) => ({ id: `e${i}`, ...(d ? { description: "x" } : {}) })),
    connections: [{ id: "f", description: "flow" }],
    assets: [],
    stats: {
      totalElements: described.length,
      dataFlows: 1,
      assets: 2,
      describedAssets: 2,
      describedElements: 99,
      describedConnections: 99,
    },
    validation: {
      isComplete: true,
      errors: Array.from({ length: findings.errors ?? 0 }, () => ({ key: "e" })),
      warnings: Array.from({ length: findings.warnings ?? 0 }, () => ({ key: "w" })),
      lastValidated: "t",
    },
  }) as unknown as DFDData;

describe("withCompleteness", () => {
  it("complete when everything is described and nothing was found", () => {
    const r = withCompleteness(dfd([true, true]));
    expect(r.phaseStatus).toBe("complete");
    expect(r.dfd.validation!.isComplete).toBe(true);
    expect(r.dfd.stats).toMatchObject({ describedElements: 2, describedConnections: 1 });
  });

  it("a description emptied: in progress, counts updated", () => {
    const r = withCompleteness(dfd([true, false]));
    expect(r.phaseStatus).toBe("in-progress");
    expect(r.dfd.validation!.isComplete).toBe(false);
    expect(r.dfd.stats!.describedElements).toBe(1);
  });

  it("findings of the last validation still count: errors → incomplete, warnings → in progress", () => {
    expect(withCompleteness(dfd([true, true], { errors: 1 })).phaseStatus).toBe("incomplete");
    expect(withCompleteness(dfd([true, true], { warnings: 1 })).phaseStatus).toBe("in-progress");
  });

  it("no status without stats or validation (not yet validated)", () => {
    const d = { ...dfd([true]), validation: undefined } as unknown as DFDData;
    expect(withCompleteness(d).phaseStatus).toBeUndefined();
  });
});
