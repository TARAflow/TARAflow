// tests/unit/features/documentation/goals-claims-chapter.test.ts
//
// ISO/SAE 21434 conformance plan Phase 4, P4-4 (decision 25): the chapter
// "goals-claims" (WP-09-03/04/05), the verification status up front (marked,
// never blocked) and the goal / claim column of the traceability matrix.

import { describe, it, expect } from "vitest";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";
import { PdfMakeConverter } from "features/documentation/utils/generators/pdfmake-converter";
import { goalsClaimsReportSections, goalsClaimsOfRisk } from "features/documentation/utils/cybersecurity-concept-report";
import { DEFAULT_CHAPTER_CONFIG, createDefaultDocData } from "features/documentation/models/doc-types";
import type { CybersecurityConcept } from "shared";
import { docVerificationOf, verificationStateHash } from "app/services/verification-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const t = ((_k: string, d?: string) => d ?? _k) as never;

const concept = (): CybersecurityConcept => ({
  goals: [
    { id: "g1", displayId: "CSG-01", statement: "The alarm message shall be protected against tampering.", riskIds: ["R-1", "R-2"], assetProperties: [{ assetId: "a1", property: "I" }], cal: 3 },
  ],
  claims: [
    { id: "c1", displayId: "CLM-01", statement: "Physical access needs special tools.", kind: "retain", riskIds: ["R-3"], assumptionIds: ["as1"], reviewBy: "2027-04-30" },
    { id: "c2", displayId: "CLM-02", statement: "The installer carries it.", kind: "share", riskIds: ["gone"], assumptionIds: [], responsibleParty: "Installer" },
  ],
  verifications: [
    { id: "v1", date: "2026-10-20", reviewer: "A. Muster", scope: ["tara", "goals-claims"], result: "passed-with-conditions", findings: "Review CLM-02.", stateHash: "abc123def456", projectVersion: "1.2" },
  ],
});

const project = (verification?: Any, c: CybersecurityConcept | null = concept()): Any => ({
  info: { name: "P", description: "d", version: "1.2", team: [], created: new Date("2026-01-01"), lastModified: new Date("2026-10-01"), tags: { domain: [], platform: [], regulation: [], custom: [] } },
  assets: { assets: [{ id: "a1", displayId: "DA-001", name: "Alarm" }] },
  risks: {
    configuration: { likelihoodMethod: "iso-21434", scale: "4-level" },
    risks: [
      { id: "R-1", threatDisplayId: "AT-2.1" },
      { id: "R-2", threatDisplayId: "AT-2.2" },
      { id: "R-3", threatDisplayId: "AT-5.1" },
    ],
  },
  itemDefinition: { sections: {}, functions: [], assumptions: [{ id: "as1", displayId: "ASM-01", text: "Panel in a locked room", status: "open" }] },
  attackTree: null,
  dfd: null,
  ...(c ? { cybersecurityConcept: c } : {}),
  computed: { moscowLabels: new Map(), impactLabels: new Map(), ...(verification ? { verification } : {}) },
});
// Only the chapters under test — the fixture need not carry a whole project.
const ONLY = new Set(["goals-claims", "traceability-matrix"]);
const cfg = (): Any => ({
  ...createDefaultDocData().configuration,
  language: "en",
  chapters: DEFAULT_CHAPTER_CONFIG.filter((c) => ONLY.has(c.id)),
});

describe("goals / claims sections", () => {
  const sections = goalsClaimsReportSections(project(), t);

  it("goals with asset × property, CAL and risks grouped by scenario", () => {
    expect(sections[0].table?.rows).toEqual([
      ["CSG-01", "The alarm message shall be protected against tampering.", "DA-001 Alarm × I", "CAL 3", "AT-2: AT-2.1, AT-2.2"],
    ]);
  });

  it("claims: retain with assumptions, share with party, a removed risk marked", () => {
    expect(sections[1].table?.rows).toEqual([
      ["CLM-01", "Physical access needs special tools.", "Retain", "ASM-01 Panel in a locked room", "2027-04-30", "AT-5: AT-5.1"],
      ["CLM-02", "The installer carries it.", "Share", "Installer", "", "gone (removed)"],
    ]);
  });

  it("verification entries with the verified state", () => {
    expect(sections[2].table?.rows).toEqual([
      ["2026-10-20", "A. Muster", "a) TARA, c) goals and claims", "passed with conditions", "Review CLM-02.", "v1.2 · abc123def456"],
    ]);
  });

  it("nothing → no chapter; the matrix column", () => {
    expect(goalsClaimsReportSections(project(undefined, null), t)).toEqual([]);
    expect(goalsClaimsOfRisk(concept(), "R-1")).toBe("CSG-01");
    expect(goalsClaimsOfRisk(concept(), "R-9")).toBe("-");
  });
});

describe("chapter and status in the formats", () => {
  const status = { kind: "changed", latest: concept().verifications[0], maxAgeDays: 90, asOf: "2026-10-30" };

  it("markdown: status up front, chapter, matrix column", () => {
    const md = new MarkdownGenerator(project(status), cfg(), t).generate().content;
    expect(md).toContain("> ⚠ TARA verification: Changed since the verification on 2026-10-20");
    expect(md.indexOf("TARA verification:")).toBeLessThan(md.indexOf("## Cybersecurity Goals and Claims"));
    expect(md).toContain("| CSG-01 | The alarm message shall be protected against tampering. | DA-001 Alarm × I | CAL 3 | AT-2: AT-2.1, AT-2.2 |");
    expect(md).toContain("| Goal / Claim (CG) |");
  });

  it("verified: a plain note; AsciiDoc, HTML, StrictDoc and PDF render it", () => {
    const ok = { ...status, kind: "verified" };
    expect(new AsciidocGenerator(project(ok), cfg(), t).generate().content).toContain("NOTE: TARA verification: Verified on 2026-10-20 by A. Muster");
    const html = new HtmlGenerator(project(status), cfg(), t).generate().content;
    expect(html).toContain('data-status="warning"');
    expect(html).toContain('<section id="goals-claims">');
    expect(new StrictdocGenerator(project(status), cfg(), t).generate().content).toContain("TITLE: Cybersecurity claims");
    const pdf = JSON.stringify(new PdfMakeConverter(project(status), cfg(), t).createDocumentDefinition().content);
    expect(pdf).toContain("TARA verification: Changed since the verification on 2026-10-20");
    expect(pdf).toContain('"text":"Cybersecurity Goals and Claims","style":"h1"');
  });

  it("no status outside iso-21434; the status as of the document date", () => {
    const base: Any = { info: { tags: { domain: [], platform: [], regulation: [], custom: [] } }, cybersecurityConcept: concept() };
    expect(docVerificationOf(base, "2026-10-30")).toBeUndefined();
    const iso: Any = { ...base, info: { tags: { ...base.info.tags, regulation: ["ISO/SAE 21434"] } } };
    expect(docVerificationOf(iso, "2026-10-30")?.kind).toBe("changed"); // hash differs
    const hash = verificationStateHash(iso);
    iso.cybersecurityConcept.verifications[0].stateHash = hash;
    expect(docVerificationOf(iso, "2026-10-30")?.kind).toBe("verified");
    expect(docVerificationOf(iso, "2027-03-01")?.kind).toBe("outdated");
  });
});
