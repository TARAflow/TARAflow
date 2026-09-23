// src/tests/unit/features/threats/services/threat-sequence.test.ts
//
// Manual threats must keep unique display labels:
//   - a new manual threat is numbered max+1 over ALL threats sharing its label
//     stem (every table, generated and manual), and persists that number;
//   - after a regeneration re-attaches manual threats, a manual threat whose
//     label the generator just issued is moved to the next free number.
// Both failure modes were seen in a real project (Nussbaum DataTrack):
// DS4-I-1 existed twice (manual + generated) and a manual "-2" collapsed
// onto "-1" at the next relabel because sequenceNumber was left at 1.

import { describe, it, expect } from "vitest";
import type { Threat, ThreatTable } from "features/threats/models/threat-types";
import {
  labelStem,
  labelSeq,
  nextSequenceNumber,
  withSequenceNumber,
  resolveManualSequenceCollisions,
} from "features/threats/services/threat-sequence";
import {
  mergeGeneratedTables,
  elementThreatNaturalKey,
} from "features/threats/services/threat-identity";

function threat(id: string, displayId: string, over: Partial<Threat> = {}): Threat {
  return {
    id,
    displayId,
    strideCategory: "I",
    sequenceNumber: labelSeq(displayId) ?? 1,
    trustBoundaryId: "tb-md",
    trustBoundaryName: "Mobile Device [MDTB]",
    trustBoundaryDisplayId: "MDTB",
    linkedElement: {
      elementId: "ds-4",
      elementName: "Inspector Cache",
      elementType: "DataStore",
      displayId: "DS-4",
    },
    dataFlow: null,
    threatDescription: displayId,
    attackDescription: "",
    causeDescription: "",
    linkedAssetIds: [],
    source: "generated:cianaaa",
    proposedMitigations: [],
    proposedVerifications: [],
    relevance: "unrated",
    ...over,
  } as Threat;
}

const manual = (id: string, displayId: string, over: Partial<Threat> = {}) =>
  threat(id, displayId, { source: "manual", ...over });

function table(threats: Threat[]): ThreatTable {
  return {
    trustBoundaryId: "tb-md",
    trustBoundaryName: "Mobile Device [MDTB]",
    displayIdentifier: "[MDTB]",
    threats,
  };
}

const labels = (tables: ThreatTable[]) =>
  tables.flatMap((t) => t.threats).map((t) => t.displayId);

describe("label helpers", () => {
  it("splits every label format at its trailing number", () => {
    expect(labelStem("DS4-I-1")).toBe("DS4-I");
    expect(labelStem("TB1-IF-USB1-T-12")).toBe("TB1-IF-USB1-T");
    expect(labelStem("TB1-DF3-T-IN-2")).toBe("TB1-DF3-T-IN");
    expect(labelSeq("TB1-DF3-T-IN-2")).toBe(2);
    expect(labelSeq("no-number-here")).toBeNull();
  });

  it("withSequenceNumber keeps label and sequenceNumber in step", () => {
    const t = withSequenceNumber(manual("m", "DS4-I-1"), 3);
    expect(t.displayId).toBe("DS4-I-3");
    expect(t.sequenceNumber).toBe(3);
  });
});

describe("nextSequenceNumber", () => {
  it("is max+1 over the stem, not count+1 (gaps are never re-issued)", () => {
    const all = [threat("a", "DS4-I-1"), threat("b", "DS4-I-3")];
    expect(nextSequenceNumber(all, "DS4-I")).toBe(4);
  });

  it("counts threats from other tables and other STRIDE stems correctly", () => {
    const all = [
      threat("a", "DS4-I-1"),
      threat("b", "DS4-T-5", { strideCategory: "T" }),
      manual("c", "DS4-I-2"),
    ];
    expect(nextSequenceNumber(all, "DS4-I")).toBe(3);
    expect(nextSequenceNumber(all, "DS6-I")).toBe(1);
  });

  it("respects a persisted sequenceNumber ahead of the label", () => {
    const all = [threat("a", "DS4-I-1", { sequenceNumber: 4 })];
    expect(nextSequenceNumber(all, "DS4-I")).toBe(5);
  });
});

describe("resolveManualSequenceCollisions", () => {
  it("moves a manual threat off a label a generated threat owns", () => {
    const tables = [table([threat("g", "DS4-I-1"), manual("m", "DS4-I-1")])];
    const out = resolveManualSequenceCollisions(tables);

    expect(labels(out)).toEqual(["DS4-I-1", "DS4-I-2"]);
    const moved = out[0].threats[1];
    expect(moved.id).toBe("m"); // identity untouched
    expect(moved.sequenceNumber).toBe(2);
  });

  it("aligns a legacy manual sequenceNumber (1) with its label (-2)", () => {
    const tables = [
      table([threat("g", "DS4-I-1"), manual("m", "DS4-I-2", { sequenceNumber: 1 })]),
    ];
    const out = resolveManualSequenceCollisions(tables);

    expect(labels(out)).toEqual(["DS4-I-1", "DS4-I-2"]);
    expect(out[0].threats[1].sequenceNumber).toBe(2);
  });

  it("separates two colliding manual threats from each other", () => {
    const tables = [table([manual("m1", "DS4-T-1"), manual("m2", "DS4-T-1")])];
    expect(labels(resolveManualSequenceCollisions(tables))).toEqual([
      "DS4-T-1",
      "DS4-T-2",
    ]);
  });

  it("returns the same tables when nothing collides", () => {
    const tables = [table([threat("g", "DS4-I-1"), manual("m", "DS4-I-2")])];
    expect(resolveManualSequenceCollisions(tables)).toBe(tables);
  });
});

describe("mergeGeneratedTables keepManual — no label collision after regeneration", () => {
  it("re-numbers a manual threat that predates the generated one", () => {
    // Manual DS4-I-1 was created while DS-4 had no generated I threat; the
    // regeneration now issues DS4-I-1 itself.
    const previous = [table([manual("m", "DS4-I-1")])];
    const fresh = [table([threat("g", "DS4-I-1")])];

    const merged = mergeGeneratedTables(fresh, previous, elementThreatNaturalKey, {
      keepManual: true,
    });

    expect(labels(merged)).toEqual(["DS4-I-1", "DS4-I-2"]);
    expect(merged[0].threats.find((t) => t.id === "m")?.displayId).toBe("DS4-I-2");
  });
});

describe("mergeGeneratedTables — a manual threat is never a generator predecessor", () => {
  it("does not hand the manual threat's UUID or analyst fields to a generated one", () => {
    const previous = [
      table([manual("m", "DS4-I-1", { relevance: "relevant", threatDescription: "analyst text" })]),
    ];
    const fresh = [table([threat("g", "DS4-I-1")])];

    const merged = mergeGeneratedTables(fresh, previous, elementThreatNaturalKey, {
      keepManual: true,
    });
    const [generated, kept] = merged[0].threats;

    expect(generated.id).toBe("g");
    expect(generated.relevance).toBe("unrated");
    expect(kept.id).toBe("m");
    expect(kept.threatDescription).toBe("analyst text");
  });
});
