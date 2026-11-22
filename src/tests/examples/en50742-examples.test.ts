// src/tests/examples/en50742-examples.test.ts
//
// Checks what the two EN 50742 examples promise (doc/Testing/manual/
// en-50742.md §9), through the results dump — the same computation the app
// runs when it opens the file. With WRITE_EXAMPLES=<dir> it also writes the
// project files:
//
//   WRITE_EXAMPLES=../TARAflow_Examples/en50742 npx vitest run src/tests/examples/en50742-examples.test.ts

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dumpProject, type DumpHeader } from "../../../scripts/results-dump/core";
import { buildExamples, type Example } from "./en50742-examples";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const examples = buildExamples();
const HEADER: DumpHeader = {
  inputFile: "example",
  inputSha256: "-",
  inputCommit: "-",
  taraflowCommit: "-",
  taraflowVersion: "-",
  threatCatalogVersion: 1,
} as never;
const dumpOf = (e: Example): Json => dumpProject(JSON.parse(JSON.stringify(e.project)), HEADER);
const risksOf = (d: Json): Json[] => Object.values(d.risks.risks);

describe("EN 50742 A example — safety zone, standard method + A", () => {
  const e = examples[0];
  const d = dumpOf(e);

  it("tags and method: standard + EN 50742 A", () => {
    expect(e.project.info.tags.regulation).toEqual(["EN 50742 A"]);
    expect(e.project.risks.configuration.likelihoodMethod).toBe("en-50742-a");
  });

  it("only the risks on the flows crossing the safety zone and their interfaces are relevant, and every one has an SRSL", () => {
    const risks = risksOf(d);
    const relevant = risks.filter((r) => r.en50742Relevant);
    expect(relevant.length).toBeGreaterThan(0);
    expect(risks.some((r) => r.en50742Relevant === false)).toBe(true);
    for (const r of relevant) expect(String(r.srsl), r.threat).toMatch(/^SRSL[0-4]$/);
    for (const r of risks.filter((x) => !x.en50742Relevant)) expect(r.srsl ?? null, r.threat).toBeNull();
  });

  it("every risk rated; the stored values are what the app computes", () => {
    const risks = risksOf(d);
    for (const r of risks) {
      expect(r.riskBefore, r.threat).toBeGreaterThan(0);
      expect(r.stored, r.threat).toBeUndefined();
    }
    expect(d.risks.findings.map((f: Json) => f.code)).not.toContain("unrated");
    // reduce always with a chosen (planned) mitigation
    expect(d.risks.findings.map((f: Json) => f.code)).not.toContain("reduceUnmitigated");
  });

  it("the EN 50742 A matrix; 7.3.4 names why: DS-1 keeps the audit records, but no relevant flow reaches it", () => {
    // The model rows look at the relevant interfaces and flows and what they
    // reach directly (rule sheet R2): P-1 → DS-1 does not cross the zone's
    // border, so DS-1 is out of their scope (manual test 4.4, "otherwise the
    // row names why").
    const all = Object.values(d.compliance["en-50742-a"].achieved.rows) as Json[];
    expect(all.length).toBeGreaterThan(0);
    const audit = all.find((r) => /7\.3\.4/.test(r.label));
    expect(audit).toMatchObject({ status: "gap", reason: { code: "noAuditRecordStore" } });
    const ds1 = e.project.dfd.elements.find((x: Json) => x.displayId === "DS-1");
    expect(ds1.properties).toMatchObject({ auditRecordRetention: "at_least_5_years" });
    expect(ds1.properties.storedDataTypes).toContain("audit_logs");
  });
});

describe("EN 50742 B example — same machine, IEC 62443 + EN 50742 B", () => {
  const e = examples[1];
  const d = dumpOf(e);

  it("tags: IEC 62443 and EN 50742 B; the B matrix next to the IEC 62443 one", () => {
    expect(e.project.info.tags.regulation).toEqual(["IEC 62443", "EN 50742 B"]);
    expect(Object.keys(d.compliance).sort()).toEqual(expect.arrayContaining(["en-50742-b"]));
  });

  it("an embedded device (EDR): no row waits for the device category", () => {
    for (const m of ["en-50742-b", "iec-62443-4-2-2019"]) {
      const statuses = (Object.values(d.compliance[m].achieved.rows) as Json[]).map((r) => r.status);
      expect(statuses, m).not.toContain("pending-category");
    }
  });

  it("standard factors, no SRSL; every risk rated", () => {
    for (const r of risksOf(d)) {
      expect(r.srsl ?? null, r.threat).toBeNull();
      expect(r.riskBefore, r.threat).toBeGreaterThan(0);
      expect(r.stored, r.threat).toBeUndefined();
    }
  });
});

describe("both examples", () => {
  it("no tracker, audit or personal data in the files", () => {
    for (const e of examples) {
      const text = JSON.stringify(e.project);
      // no tracker tenant, account or credentials, no local paths, no e-mail
      expect(text).not.toMatch(/"credentials"|atlassian\.net|"authToken"|\/home\/|@[a-z0-9-]+\.[a-z]{2,}/i);
      expect(e.project.integration ?? null).toBeNull();
      expect(e.project.audit ?? null).toBeNull();
    }
  });

  it.runIf(!!process.env.WRITE_EXAMPLES)("writes the examples", () => {
    const dir = process.env.WRITE_EXAMPLES!;
    mkdirSync(dir, { recursive: true });
    for (const e of examples) writeFileSync(join(dir, e.file), JSON.stringify(e.project, null, 2) + "\n");
  });
});
