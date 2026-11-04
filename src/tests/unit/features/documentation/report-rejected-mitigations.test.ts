// tests/unit/features/documentation/report-rejected-mitigations.test.ts
//
// FX-3: the report shows rejected mitigations with their reason instead of
// dropping them — the audit trail of what was turned down and why
// (IEC 62443-4-1). Same text in every format and in the attack-path threat
// chapter; the residual risk still ignores them.

import { describe, it, expect } from "vitest";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { PdfMakeConverter } from "features/documentation/utils/generators/pdfmake-converter";
import { mitigationLabels, rejectionReasonText } from "features/documentation/utils/control-text";
import { DEFAULT_CHAPTER_CONFIG, createDefaultDocData } from "features/documentation/models/doc-types";
import { getLocalizedMitigation } from "features/threats/services/threat-catalog-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const t = ((_k: string, d?: string) => d ?? _k) as never;

const M2 = getLocalizedMitigation("M-T-002");

const MITIGATIONS = [
  { id: "M-T-001", status: "implemented" },
  { id: "M-T-002", status: "rejected", rejectionReason: "Covered by the housing seal" },
  { id: "M-T-003", status: "rejected", rejectedByTicket: { key: "SEC-12", resolution: "Won't Fix" } },
];

const risk = (id: string, method: string): Any => ({
  id,
  threatId: id,
  threatDisplayId: id,
  threatDescription: "x",
  sourceStrideMethod: method,
  moscowPriority: "should",
  treatment: "reduce",
  strideCategory: "T",
  selectedMitigations: MITIGATIONS,
  selectedVerifications: [],
  calculatedRiskBeforeMitigation: 6,
  calculatedRiskAfterMitigation: 2,
});

const project = (likelihoodMethod?: string): Any => ({
  info: { name: "P", tags: { domain: [], platform: [], regulation: [], custom: [] } },
  assets: { assets: [] },
  threats: { perElementTables: [], perInteractionTables: [] },
  risks: {
    configuration: { likelihoodMethod, scale: "4-level" },
    risks: [risk("P1-T-1", "per-element"), risk("AT-1.1", "attack-path")],
  },
  attackTree: null,
  computed: { moscowLabels: new Map(), impactLabels: new Map(), strideNames: new Map() },
});

const cfg = (language: "en" | "de" = "en"): Any => ({
  ...createDefaultDocData().configuration,
  language,
  chapters: DEFAULT_CHAPTER_CONFIG,
});

describe("FX-3 — rejected mitigations with their reason", () => {
  it("labels: active first, then each rejected one with its reason", () => {
    const labels = mitigationLabels(MITIGATIONS, "en");
    expect(labels[0]).toMatch(/^M-T-001 — /);
    expect(labels[1]).toBe(`Rejected: M-T-002 — ${M2} · Reason: Covered by the housing seal`);
    expect(labels[2]).toMatch(/^Rejected: M-T-003.* · Reason: Ticket SEC-12 closed as Won't Fix$/);
  });

  it("reason: analyst text and ticket together; none given; German", () => {
    const both = { rejectionReason: "Out of scope", rejectedByTicket: { key: "SEC-1", resolution: "Duplicate" } };
    expect(rejectionReasonText(both, "en")).toBe("Out of scope; Ticket SEC-1 closed as Duplicate");
    expect(rejectionReasonText({}, "en")).toBe("none given");
    expect(rejectionReasonText(both, "de")).toBe("Out of scope; Ticket SEC-1 geschlossen als Duplicate");
    expect(mitigationLabels([{ id: "M-T-002", status: "rejected" }], "de")[0]).toMatch(
      /^Abgelehnt: M-T-002.* · Begründung: keine angegeben$/,
    );
  });

  it.each([
    ["Markdown", MarkdownGenerator],
    ["AsciiDoc", AsciidocGenerator],
    ["HTML", HtmlGenerator],
  ] as const)("%s risk table shows both rejected mitigations with reason", (_name, Gen) => {
    const row: string = new (Gen as Any)(project(), cfg(), t).riskRow(risk("P1-T-1", "per-element"));
    expect(row).toContain("Rejected: M-T-002");
    expect(row).toContain("Covered by the housing seal");
    expect(row).toContain("Ticket SEC-12 closed as Won");
  });

  it("attack-path threat chapter lists the rejected mitigations too", () => {
    const content: string = (new MarkdownGenerator(project("iso-21434"), cfg(), t) as Any).generateAttackPathThreats("TS")
      .content as string;
    expect(content).toContain("Rejected: M-T-002");
    expect(content).toContain("Ticket SEC-12");
  });

  it("PDF risk table: same text, in the report language", () => {
    const texts = (language: "en" | "de"): string => {
      const chapters = DEFAULT_CHAPTER_CONFIG.filter((c) => c.id === "risks-per-element");
      const out: string[] = [];
      const walk = (n: Any) => {
        if (Array.isArray(n)) n.forEach(walk);
        else if (n && typeof n === "object") {
          if (typeof n.text === "string") out.push(n.text);
          Object.values(n).forEach(walk);
        }
      };
      walk(new PdfMakeConverter(project(), { ...cfg(language), chapters }, t).createDocumentDefinition().content);
      return out.join("\n");
    };
    expect(texts("en")).toContain("• Rejected: M-T-002");
    expect(texts("en")).toContain("Reason: Covered by the housing seal");
    expect(texts("de")).toContain("Begründung: Ticket SEC-12 geschlossen als Won't Fix");
  });
});
