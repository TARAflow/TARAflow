// src/tests/unit/features/threats/components/threat-findings.test.ts
//
// Manual test 2026-11-18: the Threats phase said "Not rated yet (18): …",
// but the tab had nothing to click. Its findings panel has one row per
// threat not rated, uncertain or to review; a click opens exactly that
// threat in the dialog, where the missing or wrong information is fixed.

import { describe, expect, it } from "vitest";
import type { Threat, ThreatTable } from "features/threats/models/threat-types";
import { threatFindings } from "features/threats/components/shared/threat-findings";

const threat = (id: string, displayId: string, flow: string, stride: string, extra: Partial<Threat> = {}): Threat =>
  ({ id, displayId, strideCategory: stride, dataFlow: { dataFlowId: flow }, relevance: "relevant", threatDescription: `Threat ${displayId}`, ...extra }) as unknown as Threat;

const table = (displayIdentifier: string, threats: Threat[]): ThreatTable =>
  ({ trustBoundaryId: null, trustBoundaryName: displayIdentifier, displayIdentifier, threats }) as ThreatTable;

describe("threatFindings", () => {
  const tables = [
    table("[FP]", [
      threat("a", "FP-DF5-T-OUT-1", "DF-5", "T", { relevance: "unrated" }),
      threat("b", "FP-DF4-S-IN-1", "DF-4", "S", { relevance: undefined }),
      threat("c", "FP-DF4-T-IN-1", "DF-4", "T", { relevance: "uncertain" }),
      threat("d", "FP-DF6-S-1", "DF-6", "S"),
    ]),
    table("[SB]", [threat("e", "SB-DF2-S-OUT-1", "DF-2", "S", { relevance: "unrated", review: { reasons: [], since: "t" } as never })]),
    table("[TB]", [threat("f", "TB-DF1-S-1", "DF-1", "S")]),
  ];

  it("one row per threat and reason, in the dialog's order, the rows of a threat together", () => {
    expect(threatFindings(tables).map((f) => [f.kind, f.displayId, f.tableIndex, f.threatId])).toEqual([
      ["unrated", "SB-DF2-S-OUT-1", 1, "e"],
      ["review", "SB-DF2-S-OUT-1", 1, "e"],
      ["unrated", "FP-DF4-S-IN-1", 0, "b"],
      ["uncertain", "FP-DF4-T-IN-1", 0, "c"],
      ["unrated", "FP-DF5-T-OUT-1", 0, "a"],
    ]);
    expect(new Set(threatFindings(tables).map((f) => f.id)).size).toBe(5);
  });

  it("a manual threat with several problems: a row for each — gone from the DFD, no description, not rated", () => {
    const manual = threat("m", "M-1", "DF-9", "S", { source: "manual", threatDescription: "  ", relevance: "unrated" } as never);
    const rows = threatFindings([table("[FP]", [manual])], ["m"]);
    expect(rows.map((f) => f.kind)).toEqual(["orphaned", "noDescription", "unrated"]);
    expect(rows.every((f) => f.threatId === "m")).toBe(true);
  });

  it("the description, shortened", () => {
    const long = "x".repeat(200);
    const [f] = threatFindings([table("[FP]", [threat("a", "FP-1", "DF-1", "S", { relevance: "unrated", threatDescription: long })])]);
    expect(f.description.length).toBe(80);
    expect(f.description.endsWith("…")).toBe(true);
  });

  it("nothing open: no findings", () => {
    expect(threatFindings([tables[2]])).toEqual([]);
  });
});

describe("threatFindings — EN 50742 dismissals without a reason (0.20 patch 28)", () => {
  const relevant = new Set(["if-1", "df-3"]);
  const t = (id: string, extra: Partial<Threat>) => threat(id, `X-${id}`, "DF-9", "T", extra);

  it("a dismissed threat on a relevant interface / flow without a note is a warning; with a note or elsewhere not", () => {
    const tables = [
      table("[X]", [
        t("a", { relevance: "not_relevant", linkedElement: { elementId: "if-1" } as never }),
        t("b", { relevance: "not_relevant", dataFlow: { connectionId: "df-3" } as never }),
        t("c", { relevance: "not_relevant", linkedElement: { elementId: "if-1" } as never, evalNote: "physically sealed" }),
        t("d", { relevance: "not_relevant", linkedElement: { elementId: "p-1" } as never }),
      ]),
    ];
    expect(threatFindings(tables, [], relevant).filter((f) => f.kind === "en50742Unjustified").map((f) => f.threatId)).toEqual(["a", "b"]);
    // not an EN 50742 project: nothing
    expect(threatFindings(tables).some((f) => f.kind === "en50742Unjustified")).toBe(false);
  });
});
