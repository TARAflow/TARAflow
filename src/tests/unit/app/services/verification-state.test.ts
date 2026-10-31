// tests/unit/app/services/verification-state.test.ts
//
// ISO/SAE 21434 conformance plan Phase 4, P4-3 (decision 25): the verified
// state is a hash of the analysis content — saves, layout and the
// verification records do not change it — and the status of the latest entry.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { carryVerifications, verificationStateHash, verificationStatus } from "app/services/verification-state";
import { ANALYSIS_PRESERVING_MIGRATIONS, parseAndRepairWithMetadata } from "app/services/migration-service";
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
    const byTicket = { key: "SEC-1", resolution: "Won't Fix" };
    expect(verificationStateHash(withMitigation({ status: "rejected", rejectedByTicket: byTicket }))).not.toBe(base);
    expect(verificationStateHash(withMitigation({ status: "open", rejectedByTicket: byTicket }))).toBe(base);
    expect(verificationStateHash(withMitigation({ id: "M-S-002", status: "open" }))).not.toBe(base);
  });
});

describe("carrying verifications over loading (review 2026-10-30)", () => {
  const entry = (stateHash: string): Any => ({ id: stateHash, date: "2026-10-01", reviewer: "A", scope: ["tara"], result: "passed", stateHash });
  const withEntries = (...e: Any[]): Any => ({ ...project(), cybersecurityConcept: { goals: [], claims: [], verifications: e } });

  it("nothing changed: the entries stay as they are", () => {
    const p = withEntries(entry("r"));
    expect(carryVerifications(p, { read: "r", migrated: "r", loaded: "r" }, false)).toBe(p);
  });

  it("migrations declared analysis-preserving, repair changed nothing: re-sealed", () => {
    const out: Any = carryVerifications(withEntries(entry("r")), { read: "r", migrated: "m", loaded: "m" }, true);
    expect(out.cybersecurityConcept.verifications[0]).toMatchObject({ stateHash: "m" });
    expect(out.cybersecurityConcept.verifications[0].reconfirm).toBeUndefined();
  });

  it("a migration not declared preserving: confirm again, never silently verified", () => {
    const out: Any = carryVerifications(withEntries(entry("r")), { read: "r", migrated: "m", loaded: "m" }, false);
    expect(out.cybersecurityConcept.verifications[0]).toMatchObject({ stateHash: "r", reconfirm: "migration" });
    expect(verificationStatus(out.cybersecurityConcept.verifications, "m", "2026-10-30").kind).toBe("reconfirm");
  });

  it("the repair changed the content: confirm again, even after preserving migrations", () => {
    const out: Any = carryVerifications(withEntries(entry("r")), { read: "r", migrated: "m", loaded: "x" }, true);
    expect(out.cybersecurityConcept.verifications[0]).toMatchObject({ reconfirm: "repair" });
    const repairOnly: Any = carryVerifications(withEntries(entry("r")), { read: "r", migrated: "r", loaded: "x" }, true);
    expect(repairOnly.cybersecurityConcept.verifications[0]).toMatchObject({ reconfirm: "repair" });
  });

  it("an entry that did not match the file as read is left alone", () => {
    const p = withEntries(entry("other"));
    expect(carryVerifications(p, { read: "r", migrated: "m", loaded: "m" }, false)).toBe(p);
  });

  it("loading a file through a migration that is not declared preserving (schema 9 → 12 runs 10 and 11): confirm again", () => {
    expect(ANALYSIS_PRESERVING_MIGRATIONS.has(10)).toBe(false);
    expect(ANALYSIS_PRESERVING_MIGRATIONS.has(11)).toBe(false);
    const raw: Any = JSON.parse(readFileSync("src/tests/fixtures/headlamp-iso21434.tara.json", "utf-8"));
    const readHash = verificationStateHash(JSON.parse(JSON.stringify(raw)));
    raw.cybersecurityConcept = {
      goals: [],
      claims: [],
      verifications: [
        { id: "v1", date: "2026-10-01", reviewer: "A", scope: ["tara"], result: "passed", stateHash: readHash, hashVersion: VERIFICATION_HASH_VERSION },
      ],
    };
    const { project: loaded, migrated }: Any = parseAndRepairWithMetadata(raw);
    expect(migrated).toBe(true);
    const now = verificationStateHash(loaded);
    expect(now).not.toBe(readHash);
    expect(loaded.cybersecurityConcept.verifications[0]).toMatchObject({ stateHash: readHash, reconfirm: "migration" });
    expect(verificationStatus(loaded.cybersecurityConcept.verifications, now, "2026-10-30").kind).toBe("reconfirm");
  });
});

describe("fixed reference hash (review 2026-10-30)", () => {
  // Every part the hash covers, written out. If this fails, what the hash
  // covers (or how it is computed) changed: raise VERIFICATION_HASH_VERSION
  // in shared/models/cybersecurity-concept-types.ts and add the new hash
  // here — existing verifications then ask to be confirmed again instead of
  // reading "changed" (or, worse, "verified").
  const REFERENCE_HASH: Record<number, string> = { 1: "d75622ac4e88" };
  const reference = (): Any => ({
    info: { name: "Ref", description: "Detects smoke", lastModified: "t0", created: "t0" },
    itemDefinition: {
      sections: { purpose: { text: "Alarm on smoke" } },
      functions: [{ id: "f1", name: "Detect" }],
      assumptions: [{ id: "a1", displayId: "ASM-01", text: "Mounted indoors", status: "open" }],
    },
    hazards: { hazards: [{ id: "h1", label: "Fire undetected" }], relations: [] },
    dfd: {
      xml: "<mxGraphModel/>",
      thumbnail: "png",
      graph: { cached: true },
      validation: { errors: [] },
      elements: [{ id: "p1", displayId: "P-1", name: "Controller", type: "Process", properties: { runsAs: "user" } }],
      connections: [{ id: "f1", displayId: "DF-1", from: "p1", to: "p1", name: "loop", properties: {} }],
      pages: [{ id: "page-1", name: "Context" }],
    },
    assets: { assets: [{ id: "DA-001", name: "Alarm", assetGroup: "data", properties: { protectionNeed: "high" } }] },
    threats: { perElementTables: [{ threats: [{ id: "t1", displayId: "P1-S-1", proposedMitigations: [{ id: "M-S-001" }] }] }], perInteractionTables: [] },
    attackTrees: { trees: [{ id: "at1", title: "Silence the alarm", dsl: "Root;ROOT\n\tCut;p=0.5,i=3 [M-S-001]" }] },
    risks: {
      configuration: { scale: "4-level" },
      risks: [
        {
          id: "R-1",
          treatment: "reduce",
          calcStamp: { method: "x" },
          selectedMitigations: [
            { id: "M-S-001", notes: "n", status: "implemented", ticketId: "SEC-1", ticketStatus: "done", evidenceRef: "E" },
            { id: "M-S-002", status: "rejected", rejectionReason: "not needed" },
          ],
        },
      ],
    },
    cybersecurityConcept: {
      goals: [{ id: "g1", displayId: "CSG-01", statement: "Protect", riskIds: ["R-1"], assetProperties: [] }],
      claims: [{ id: "c1", displayId: "CLM-01", statement: "Retained", kind: "retain", riskIds: [], assumptionIds: ["a1"] }],
      verifications: [{ id: "v1", stateHash: "ignored" }],
      goalSeq: 1,
    },
  });

  it("the reference project hashes to the value recorded for the current hash version", () => {
    expect(REFERENCE_HASH[VERIFICATION_HASH_VERSION]).toBeDefined();
    expect(verificationStateHash(reference())).toBe(REFERENCE_HASH[VERIFICATION_HASH_VERSION]);
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

  it("an entry marked on load asks to be confirmed again", () => {
    expect(verificationStatus([{ ...entry("2026-10-01", "passed"), reconfirm: "repair" }], "h1", "2026-10-29").kind).toBe("reconfirm");
  });

  it("an entry hashed by another hash version asks to be confirmed again", () => {
    const old = { ...entry("2026-10-01", "passed"), hashVersion: VERIFICATION_HASH_VERSION + 1 };
    expect(verificationStatus([old], "h1", "2026-10-29").kind).toBe("reconfirm");
  });
});

describe("matrix data in the hash (iec-62443-4-2-cra-coverage.md D-25)", () => {
  const base = (): Any => ({ info: { description: "d" }, risks: { risks: [] } });
  const compliance = (reasoning: string) => ({
    target: { IAC: 2 },
    statements: { "en-iec-62443-4-2-praa-2026": { "CR 1.7": { status: "met", reasoning, date: "2026-11-02" } } },
  });

  it("a project without matrix data keeps its hash (no hash version bump)", () => {
    expect(verificationStateHash({ ...base(), compliance: undefined })).toBe(verificationStateHash(base()));
  });

  it("matrix data is covered: a statement changed after a verification shows as a change", () => {
    const before = verificationStateHash({ ...base(), compliance: compliance("NIST rules") });
    expect(before).not.toBe(verificationStateHash(base()));
    expect(verificationStateHash({ ...base(), compliance: compliance("changed later") })).not.toBe(before);
  });

  it("the key order of the stored data does not matter", () => {
    const a = { target: { IAC: 2, UC: 3 }, componentId: "mp" };
    const b = { componentId: "mp", target: { UC: 3, IAC: 2 } };
    expect(verificationStateHash({ ...base(), compliance: a })).toBe(verificationStateHash({ ...base(), compliance: b }));
  });
});
