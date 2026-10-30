// tests/unit/app/services/verification-state.test.ts
//
// ISO/SAE 21434 conformance plan Phase 4, P4-3 (decision 25): the verified
// state is a hash of the analysis content — saves, layout and the
// verification records do not change it — and the status of the latest entry.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resealVerifications, verificationStateHash, verificationStatus } from "app/services/verification-state";
import { parseAndRepairWithMetadata } from "app/services/migration-service";
import { VERIFICATION_HASH_VERSION, type VerificationEntry } from "shared";

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

describe("implementation progress is not analysis content (review 2026-10-30)", () => {
  const withMitigation = (m: Any): Any => {
    const p = project();
    p.risks.risks[0].selectedMitigations = [{ id: "M-S-001", notes: "n", ...m }];
    return p;
  };
  const base = verificationStateHash(withMitigation({ status: "open" }));

  it("status, evidence and ticket fields do not count", () => {
    const moved = withMitigation({
      status: "implemented",
      statusChangedAt: "2026-10-30",
      evidenceRef: "DOC-1",
      evidenceNote: "tested",
      ticketId: "SEC-42",
      ticketUrl: "https://x.atlassian.net/browse/SEC-42",
      ticketStatus: "done",
      ticketSyncedAt: "2026-10-30T10:00:00Z",
    });
    expect(verificationStateHash(moved)).toBe(base);
  });

  it("rejecting a control counts, with its reason; the mitigation itself counts", () => {
    const rejected = verificationStateHash(withMitigation({ status: "rejected", rejectionReason: "won't fix" }));
    expect(rejected).not.toBe(base);
    expect(verificationStateHash(withMitigation({ status: "rejected", rejectionReason: "other" }))).not.toBe(rejected);
    expect(verificationStateHash(withMitigation({ status: "open", rejectionReason: "stale" }))).toBe(base);
    expect(verificationStateHash(withMitigation({ id: "M-S-002", status: "open" }))).not.toBe(base);
  });
});

describe("re-sealing on load", () => {
  it("a verification of the file as read stays verified after the migration", () => {
    const raw: Any = JSON.parse(readFileSync("src/tests/fixtures/headlamp-iso21434.tara.json", "utf-8"));
    const readHash = verificationStateHash(JSON.parse(JSON.stringify(raw)));
    raw.cybersecurityConcept = {
      goals: [],
      claims: [],
      verifications: [
        { id: "v1", date: "2026-10-01", reviewer: "A", scope: ["tara"], result: "passed", stateHash: readHash, hashVersion: VERIFICATION_HASH_VERSION },
        { id: "v0", date: "2026-09-01", reviewer: "A", scope: ["tara"], result: "passed", stateHash: "000000000000" },
      ],
    };
    const { project: loaded, migrated }: Any = parseAndRepairWithMetadata(raw);
    expect(migrated).toBe(true);
    const now = verificationStateHash(loaded);
    expect(now).not.toBe(readHash); // the migration changed the content's form
    expect(loaded.cybersecurityConcept.verifications.map((v: Any) => v.stateHash)).toEqual([now, "000000000000"]);
    expect(verificationStatus(loaded.cybersecurityConcept.verifications, now, "2026-10-30").kind).toBe("verified");
  });

  it("an entry that did not match the file as read is left alone", () => {
    const p = project();
    p.cybersecurityConcept.verifications = [{ id: "v1", stateHash: "other" }];
    expect(resealVerifications(p, "read")).toBe(p);
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

  it("an entry hashed by another hash version asks to be confirmed again", () => {
    const old = { ...entry("2026-10-01", "passed"), hashVersion: VERIFICATION_HASH_VERSION + 1 };
    expect(verificationStatus([old], "h1", "2026-10-29").kind).toBe("reconfirm");
  });
});
