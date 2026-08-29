import { describe, it, expect } from "vitest";
// NOTE: align relative paths with the sibling tests in this folder.
import { elementThreatSync } from "../../../../../../features/threats/services/per-element/element-sync";
import type {
  ThreatTable,
  Threat,
} from "../../../../../../features/threats/models/threat-types";
import type { ElementChange } from "../../../../../../features/threats/models/per-element-types";

/**
 * applyChangedReferences is the "silent" half of sync (Class A): it refreshes a
 * threat's linkedElement mirror and regenerates threat.id from the precomputed
 * newId, and it must NEVER add or remove threats. The live DFD-change path runs
 * it on every save (rename / renumber / retype) without a banner.
 */

function threat(id: string, eid: string, name: string, displayId: string): Threat {
  return {
    id,
    displayId: id,
    strideCategory: "S",
    sequenceNumber: 1,
    linkedElement: {
      elementId: eid,
      elementName: name,
      elementType: "Process",
      displayId,
    },
  } as unknown as Threat;
}

function table(threats: Threat[]): ThreatTable {
  return {
    trustBoundaryId: null,
    trustBoundaryName: "No Trust Boundary",
    threats,
  } as unknown as ThreatTable;
}

function change(
  threatId: string,
  newId: string,
  ref: { id: string; name: string; type: string; displayId: string },
  changes: ("name" | "id" | "type")[],
): ElementChange {
  return {
    threatId,
    oldRef: {} as any,
    newRef: ref as any,
    newDisplayId: newId,
    changes,
  };
}

describe("applyChangedReferences", () => {
  it("regenerates threat.displayId from newDisplayId on renumber and refreshes linkedElement", () => {
    const tables = [table([threat("P1-S-1", "e1", "Auth", "P-1")])];
    const changes = [
      change("P1-S-1", "P2-S-1", {
        id: "e1",
        name: "Auth",
        type: "Process",
        displayId: "P-2",
      }, ["id"]),
    ];

    const { tables: out, updated } = elementThreatSync.applyChangedReferences(
      tables,
      changes,
    );

    expect(updated).toBe(1);
    const t = out[0].threats[0];
    expect(t.displayId).toBe("P2-S-1"); // display label tracks renumber
    expect(t.id).toBe("P1-S-1"); // identity is stable
    expect(t.linkedElement?.displayId).toBe("P-2");
    expect(t.linkedElement?.elementName).toBe("Auth");
  });

  it("refreshes the name on rename (no id change keeps the id)", () => {
    const tables = [table([threat("P1-S-1", "e1", "Old", "P-1")])];
    const changes = [
      change("P1-S-1", "P1-S-1", {
        id: "e1",
        name: "New",
        type: "Process",
        displayId: "P-1",
      }, ["name"]),
    ];

    const { tables: out } = elementThreatSync.applyChangedReferences(
      tables,
      changes,
    );
    expect(out[0].threats[0].id).toBe("P1-S-1");
    expect(out[0].threats[0].linkedElement?.elementName).toBe("New");
  });

  it("leaves non-matching threats untouched and never changes the count", () => {
    const tables = [
      table([
        threat("P1-S-1", "e1", "Auth", "P-1"),
        threat("DS1-T-1", "e2", "Store", "DS-1"),
      ]),
    ];
    const before = tables[0].threats.length;
    const changes = [
      change("P1-S-1", "P2-S-1", {
        id: "e1",
        name: "Auth",
        type: "Process",
        displayId: "P-2",
      }, ["id"]),
    ];

    const { tables: out, updated } = elementThreatSync.applyChangedReferences(
      tables,
      changes,
    );

    expect(updated).toBe(1);
    expect(out[0].threats).toHaveLength(before); // non-destructive
    expect(out[0].threats[1].id).toBe("DS1-T-1"); // untouched
  });

  it("is a no-op for an empty change set", () => {
    const tables = [table([threat("P1-S-1", "e1", "Auth", "P-1")])];
    const { tables: out, updated } = elementThreatSync.applyChangedReferences(
      tables,
      [],
    );
    expect(updated).toBe(0);
    expect(out).toBe(tables); // same reference returned
  });
});
