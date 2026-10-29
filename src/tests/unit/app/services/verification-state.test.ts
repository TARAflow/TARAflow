// tests/unit/app/services/verification-state.test.ts
//
// ISO/SAE 21434 conformance plan Phase 4, P4-3 (decision 25): the verified
// state is a hash of the analysis content — saves, layout and the
// verification records do not change it — and the status of the latest entry.

import { describe, it, expect } from "vitest";
import { verificationStateHash, verificationStatus } from "app/services/verification-state";
import type { VerificationEntry } from "shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const project = (): Any => ({
  info: { name: "P", description: "Detects smoke", lastModified: "t0" },
  dfd: { xml: "<a/>", thumbnail: "x", elements: [{ id: "e1", name: "Sensor", lastModified: "t0" }], connections: [], graph: { big: true } },
  assets: { assets: [{ id: "a1", name: "Alarm", created: "t0", lastModified: "t0" }] },
  risks: { risks: [{ id: "R-1", treatment: "reduce", calcStamp: { method: "x" } }], lastModified: "t0" },
  cybersecurityConcept: { goals: [{ id: "g1", displayId: "CSG-01", statement: "Protect", riskIds: ["R-1"], assetProperties: [] }], claims: [], verifications: [] },
});

describe("verification state hash", () => {
  const base = verificationStateHash(project());

  it("timestamps, draw.io XML, thumbnails, caches and verification records do not count", () => {
    const p = project();
    p.info.lastModified = "t9";
    p.dfd.xml = "<moved/>";
    p.dfd.thumbnail = "y";
    p.dfd.graph = { other: 1 };
    p.assets.assets[0].lastModified = "t9";
    p.risks.risks[0].calcStamp = { method: "y" };
    p.cybersecurityConcept.verifications = [{ id: "v1" }];
    expect(verificationStateHash(p)).toBe(base);
  });

  it("analysis content counts: a risk treatment, a goal statement, the description", () => {
    const a = project();
    a.risks.risks[0].treatment = "accept";
    const b = project();
    b.cybersecurityConcept.goals[0].statement = "Protect better";
    const c = project();
    c.info.description = "Detects fire";
    expect(new Set([base, verificationStateHash(a), verificationStateHash(b), verificationStateHash(c)]).size).toBe(4);
  });
});

describe("verification status", () => {
  const entry = (date: string, result: VerificationEntry["result"], stateHash = "h1"): VerificationEntry => ({
    id: date,
    date,
    reviewer: "A. Muster",
    scope: ["tara", "treatment", "goals-claims", "consistency"],
    result,
    stateHash,
  });

  it("none, verified, changed, outdated, failed — from the latest entry", () => {
    expect(verificationStatus([], "h1", "2026-10-29").kind).toBe("none");
    expect(verificationStatus([entry("2026-10-01", "passed")], "h1", "2026-10-29")).toMatchObject({ kind: "verified", ageDays: 28 });
    expect(verificationStatus([entry("2026-10-01", "passed-with-conditions")], "h1", "2026-10-29").kind).toBe("verified");
    expect(verificationStatus([entry("2026-10-01", "passed")], "h2", "2026-10-29").kind).toBe("changed");
    expect(verificationStatus([entry("2026-06-01", "passed")], "h1", "2026-10-29").kind).toBe("outdated");
    expect(verificationStatus([entry("2026-06-01", "passed")], "h1", "2026-10-29", 365).kind).toBe("verified");
    expect(
      verificationStatus([entry("2026-10-20", "failed"), entry("2026-10-01", "passed")], "h1", "2026-10-29"),
    ).toMatchObject({ kind: "failed", latest: { date: "2026-10-20" } });
  });
});
