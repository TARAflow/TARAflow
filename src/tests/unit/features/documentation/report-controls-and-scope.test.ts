// tests/unit/features/documentation/report-controls-and-scope.test.ts
//
// Report follow-ups of the mitigation catalog work (ISO/SAE 21434 plan
// F8–F10):
//   F8  controls and verifications as "ID — text" in the risk tables (all
//       presets) and, from the risk, in the attack-path threat chapter;
//   F9  a STRIDE method the preset switches off (ISO: per-interaction) has
//       no threat / risk chapter, even with stored threats or risks;
//   F10 the attack-trees chapter comes right before the threat scenarios.

import { describe, it, expect } from "vitest";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { PdfMakeConverter } from "features/documentation/utils/generators/pdfmake-converter";
import { controlLabel, controlLabels } from "features/documentation/utils/control-text";
import { isStrideMethodDisabled } from "features/documentation/utils/stride-method-scope";
import { getLocalizedMitigation, getLocalizedVerification } from "features/threats/services/threat-catalog-service";
import { DEFAULT_CHAPTER_CONFIG, createDefaultDocData } from "features/documentation/models/doc-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const t = ((_k: string, d?: string) => d ?? _k) as never;

const M = getLocalizedMitigation("M-T-001");
const V = getLocalizedVerification("V-T-001");

const tags = (regulation: string[]) => ({ domain: [], platform: [], regulation, custom: [] });

const threat = (id: string): Any => ({
  id,
  displayId: id,
  strideCategory: "T",
  threatDescription: "x",
  attackDescription: "",
  relevance: "relevant",
  proposedMitigations: [],
  proposedVerifications: [],
  trustBoundaryName: null,
});

const risk = (id: string, method: string, over: Record<string, unknown> = {}): Any => ({
  id,
  threatId: id,
  threatDisplayId: id,
  threatDescription: "x",
  sourceStrideMethod: method,
  moscowPriority: "should",
  treatment: "reduce",
  strideCategory: "T",
  selectedMitigations: [
    { id: "M-T-001", status: "implemented" },
    { id: "M-T-002", status: "rejected" },
    { notes: "Custom gasket", status: "open" },
  ],
  selectedVerifications: ["V-T-001"],
  calculatedRiskBeforeMitigation: 6,
  calculatedRiskAfterMitigation: 2,
  ...over,
});

const project = (regulation: string[], likelihoodMethod?: string): Any => ({
  info: { name: "P", tags: tags(regulation) },
  assets: { assets: [] },
  threats: {
    perElementTables: [{ threats: [threat("P1-T-1")] }],
    perInteractionTables: [{ threats: [threat("P1-I-1")] }],
  },
  risks: {
    configuration: { likelihoodMethod, scale: "4-level" },
    risks: [risk("P1-T-1", "per-element"), risk("P1-I-1", "per-interaction"), risk("AT-1.1", "attack-path")],
  },
  attackTree: null,
  computed: {
    moscowLabels: new Map(),
    impactLabels: new Map(),
    strideNames: new Map(),
  },
});
const cfg = (): Any => ({ ...createDefaultDocData().configuration, language: "en", chapters: DEFAULT_CHAPTER_CONFIG });
const gen = (p: Any): Any => new MarkdownGenerator(p, cfg(), t);

describe("F8 — controls as ID and text", () => {
  it("catalog texts are loaded in the test environment", () => {
    expect(M).not.toBe("M-T-001.mitigation");
    expect(V).not.toBe("V-T-001.verification");
  });

  it("controlLabel: id — text, note in brackets, custom by its note, unknown id as is", () => {
    expect(controlLabel({ id: "M-T-001" }, "mitigation")).toBe(`M-T-001 — ${M}`);
    expect(controlLabel({ id: "M-T-001", notes: " on CAN " }, "mitigation")).toBe(`M-T-001 — ${M} (on CAN)`);
    expect(controlLabel({ notes: "Custom gasket" }, "mitigation")).toBe("Custom gasket");
    expect(controlLabel({ id: "M-NOPE-999" }, "mitigation")).toBe("M-NOPE-999");
    expect(controlLabels([{ id: "V-T-001" }, {}], "verification")).toEqual([`V-T-001 — ${V}`]);
  });

  it("risk table (any preset): text, rejected controls left out", () => {
    const row = gen(project([])).riskRow(risk("P1-T-1", "per-element"));
    expect(row).toContain(`M-T-001 — ${M}`);
    expect(row).toContain("Custom gasket");
    expect(row).not.toContain("M-T-002");
  });

  it("attack-path threat chapter (ISO): controls and verifications of the risk", () => {
    const content = gen(project(["ISO 21434"], "iso-21434")).generateAttackPathThreats("TS").content as string;
    expect(content).toContain(`M-T-001 — ${M}`);
    expect(content).toContain(`V-T-001 — ${V}`);
  });
});

describe("F9 — a switched-off STRIDE method has no chapter", () => {
  it("ISO switches per-interaction off, other presets nothing", () => {
    expect(isStrideMethodDisabled(tags(["ISO 21434"]), "per-interaction")).toBe(true);
    expect(isStrideMethodDisabled(tags(["ISO 21434"]), "per-element")).toBe(false);
    expect(isStrideMethodDisabled(tags(["IEC 62443"]), "per-interaction")).toBe(false);
    expect(isStrideMethodDisabled(undefined, "per-interaction")).toBe(false);
  });

  it("markdown: ISO hides the per-interaction threats and risks; others keep them", () => {
    const iso = gen(project(["ISO 21434"], "iso-21434"));
    expect(iso.generateThreats("T", "per-interaction").hasContent).toBe(false);
    expect(iso.generateRisks("R", "per-interaction").hasContent).toBe(false);
    expect(iso.generateThreats("T", "per-element").hasContent).toBe(true);
    const other = gen(project(["IEC 62443"]));
    expect(other.generateThreats("T", "per-interaction").hasContent).toBe(true);
    expect(other.generateRisks("R", "per-interaction").hasContent).toBe(true);
  });

  it("pdfmake: one chapter per method, none for the switched-off method", () => {
    const h1 = (p: Any): string[] => {
      const out: string[] = [];
      const walk = (n: Any) => {
        if (Array.isArray(n)) n.forEach(walk);
        else if (n && typeof n === "object") {
          if (n.style === "h1" && typeof n.text === "string") out.push(n.text);
          Object.values(n).forEach(walk);
        }
      };
      const chapters = DEFAULT_CHAPTER_CONFIG.filter((c) => /^(threats|risks)-per-/.test(c.id));
      walk(new PdfMakeConverter(p, { ...cfg(), chapters }, t).createDocumentDefinition().content);
      return out.filter((x) => x !== "Table of Contents");
    };
    expect(h1(project(["IEC 62443"]))).toEqual([
      "Threat Analysis (STRIDE per Element)",
      "Threat Analysis (STRIDE per Interaction)",
      "Risk Assessment (STRIDE per Element)",
      "Risk Assessment (STRIDE per Interaction)",
    ]);
    expect(h1(project(["ISO 21434"], "iso-21434"))).toEqual([
      "Threat Analysis (STRIDE per Element)",
      "Risk Assessment (STRIDE per Element)",
    ]);
  });
});

describe("F10 — attack trees before the threat scenarios", () => {
  it("default chapter order", () => {
    const ids = DEFAULT_CHAPTER_CONFIG.map((c) => c.id);
    expect(ids.indexOf("attack-trees")).toBe(ids.indexOf("threats-attack-path") - 1);
  });
});
