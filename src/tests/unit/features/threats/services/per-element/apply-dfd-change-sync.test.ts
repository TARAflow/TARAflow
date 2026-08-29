// features/threats/services/per-element/apply-dfd-change-sync.test.ts
import { describe, it, expect } from "vitest";
import { syncPerElementThreatsForGraph } from "features/threats/services/per-element/apply-dfd-change-sync";

// ── Fakes ───────────────────────────────────────────────────────────────────
function dfThreat(id: string, link: string, dispId: string, stride = "T") {
  return {
    id,
    strideCategory: stride,
    sequenceNumber: 1,
    source: "generated",
    linkedElement: {
      elementId: link,
      elementName: "flow",
      elementType: "DataFlow",
      displayId: dispId,
    },
  } as any;
}

function graphWith(conns: Array<{ id: string; displayId: string }>) {
  return {
    elementsById: new Map(),
    connectionsById: new Map(
      conns.map((c) => [c.id, { ...c, label: "flow" }]),
    ),
    effectiveElementTrustBoundary: new Map(),
  } as any;
}

function bundle(threats: any[]) {
  return {
    configuration: { activeMethod: "per-element", custom: "keepme" },
    perElementTables: [
      {
        trustBoundaryId: null,
        trustBoundaryName: "Data Flows",
        displayIdentifier: "[DF]",
        threats,
      },
    ],
    perInteractionTables: [{ trustBoundaryName: "PI", threats: [] }],
    lastModified: "old",
  } as any;
}

const ctx = {} as any; // dfdContext is unused by synchronizeThreats

// ── Tests ───────────────────────────────────────────────────────────────────
describe("syncPerElementThreatsForGraph", () => {
  it("rewrites threat ids on renumber, keeping the stable element link", () => {
    // Mirrors the real log: conns 131/140 swapped DF-7 <-> DF-6.
    const input = bundle([
      dfThreat("DF7-T-1", "131", "DF-7"),
      dfThreat("DF6-T-1", "140", "DF-6"),
    ]);
    const graph = graphWith([
      { id: "131", displayId: "DF-6" },
      { id: "140", displayId: "DF-7" },
    ]);

    const out = syncPerElementThreatsForGraph(input, graph, ctx);
    const byLink = Object.fromEntries(
      out.perElementTables[0].threats.map((t: any) => [
        t.linkedElement.elementId,
        t,
      ]),
    );

    // New identity contract: id is stable, displayId tracks the renumber.
    expect(byLink["131"].displayId).toBe("DF6-T-1");
    expect(byLink["131"].id).toBe("DF7-T-1"); // stable, unchanged
    expect(byLink["131"].linkedElement.displayId).toBe("DF-6");
    expect(byLink["140"].displayId).toBe("DF7-T-1");
    expect(byLink["140"].id).toBe("DF6-T-1"); // stable, unchanged
    expect(byLink["140"].linkedElement.displayId).toBe("DF-7");
  });

  it("preserves configuration and perInteractionTables (not the hardcoded ones)", () => {
    const input = bundle([dfThreat("DF7-T-1", "131", "DF-7")]);
    const graph = graphWith([{ id: "131", displayId: "DF-9" }]);

    const out = syncPerElementThreatsForGraph(input, graph, ctx);

    expect(out.configuration).toEqual(input.configuration);
    expect((out.configuration as any).custom).toBe("keepme");
    expect(out.perInteractionTables).toBe(input.perInteractionTables);
  });

  it("is a no-op (same reference) when already in sync", () => {
    const input = bundle([
      dfThreat("DF7-T-1", "131", "DF-7"),
      dfThreat("DF6-T-1", "140", "DF-6"),
    ]);
    const graph = graphWith([
      { id: "131", displayId: "DF-7" },
      { id: "140", displayId: "DF-6" },
    ]);

    expect(syncPerElementThreatsForGraph(input, graph, ctx)).toBe(input);
  });

  it("does NOT delete orphaned threats (removeOrphaned is false)", () => {
    const input = bundle([
      dfThreat("DF7-T-1", "131", "DF-7"),
      dfThreat("DF6-T-1", "999", "DF-6"), // element 999 removed from graph
    ]);
    const graph = graphWith([{ id: "131", displayId: "DF-7" }]);

    const out = syncPerElementThreatsForGraph(input, graph, ctx);
    const ids = out.perElementTables[0].threats.map((t: any) => t.id);

    expect(ids).toContain("DF7-T-1");
    expect(ids).toContain("DF6-T-1");
  });
});