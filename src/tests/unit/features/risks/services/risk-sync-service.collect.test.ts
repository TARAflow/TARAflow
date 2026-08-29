// src/tests/unit/features/risks/services/risk-sync-service.collect.test.ts
//
// Regression cover for the three-source threat concatenation the Risk tab
// feeds into the sync. Extracted from RisksTab into collectAllThreats /
// collectAllThreatsUnfiltered so body and test share ONE definition — the
// earlier drift (deps listed perAttackPathThreats but the memo body forgot to
// spread it, silently dropping attack-path threats from the register) cannot
// recur.
//
// Pure logic, no rendering.

import { describe, it, expect } from "vitest";
import {
  collectAllThreats,
  collectAllThreatsUnfiltered,
} from "features/risks/services/risk-sync-service";
import type { ThreatReference } from "shared";

function ref(
  id: string,
  relevance: ThreatReference["relevance"],
): ThreatReference {
  return {
    id,
    displayId: id,
    strideCategory: "T",
    threatDescription: id,
    attackDescription: "",
    sourceStrideMethod: id.startsWith("AT-") ? "attack-path" : "per-element",
    relevance,
    proposedMitigations: [],
    proposedVerifications: [],
    trustBoundaryId: null,
    trustBoundaryName: null,
  };
}

type Sources = {
  perElementThreats: ThreatReference[];
  perInteractionThreats: ThreatReference[];
  perAttackPathThreats?: ThreatReference[];
};

const base = (over: Partial<Sources> = {}): Sources => ({
  perElementThreats: [],
  perInteractionThreats: [],
  ...over,
});

describe("collectAllThreatsUnfiltered — three-source union", () => {
  it("includes all three sources in order", () => {
    const p = base({
      perElementThreats: [ref("PE-1", "relevant")],
      perInteractionThreats: [ref("PI-1", "relevant")],
      perAttackPathThreats: [ref("AT-x-T", "relevant")],
    });
    expect(collectAllThreatsUnfiltered(p).map((t) => t.id)).toEqual([
      "PE-1",
      "PI-1",
      "AT-x-T",
    ]);
  });

  it("treats a missing perAttackPathThreats as empty (no crash)", () => {
    const p = base({ perElementThreats: [ref("PE-1", "relevant")] });
    expect(collectAllThreatsUnfiltered(p).map((t) => t.id)).toEqual(["PE-1"]);
  });

  it("keeps unrated / not_relevant — it does NOT filter", () => {
    const p = base({
      perAttackPathThreats: [
        ref("AT-a-T", "unrated"),
        ref("AT-b-T", "not_relevant"),
      ],
    });
    expect(collectAllThreatsUnfiltered(p)).toHaveLength(2);
  });
});

describe("collectAllThreats — the regression guard", () => {
  it("a relevant attack-path threat reaches the eligible set", () => {
    // THE bug this pins: perAttackPathThreats present but dropped from the
    // memo body → an attack-path threat would never become a risk.
    const p = base({ perAttackPathThreats: [ref("AT-x-T", "relevant")] });
    expect(collectAllThreats(p).map((t) => t.id)).toContain("AT-x-T");
  });

  it("an uncertain attack-path threat is eligible (kept, flagged downstream)", () => {
    const p = base({ perAttackPathThreats: [ref("AT-x-T", "uncertain")] });
    expect(collectAllThreats(p).map((t) => t.id)).toContain("AT-x-T");
  });

  it("unrated and not_relevant attack-path threats are filtered out", () => {
    const p = base({
      perAttackPathThreats: [
        ref("AT-a-T", "unrated"),
        ref("AT-b-T", "not_relevant"),
      ],
    });
    expect(collectAllThreats(p)).toHaveLength(0);
  });

  it("attack-path threats sit alongside the two STRIDE sources", () => {
    const p = base({
      perElementThreats: [ref("PE-1", "relevant")],
      perInteractionThreats: [ref("PI-1", "relevant")],
      perAttackPathThreats: [ref("AT-x-T", "relevant")],
    });
    expect(collectAllThreats(p).map((t) => t.id)).toEqual(
      expect.arrayContaining(["PE-1", "PI-1", "AT-x-T"]),
    );
  });
});