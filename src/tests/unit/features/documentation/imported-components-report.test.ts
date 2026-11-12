// tests/unit/features/documentation/imported-components-report.test.ts
//
// Multi-project TARA phase 6a-1 (review 2026-11-11): the report's threat
// chapters show the imported threats per component, each threat once, the
// instances below only where they differ; every instance threat stays a link
// target of its risk row; the risk rows say where their rating comes from.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { docImportedComponents, docImportedRiskNotes, docImportedThreats } from "app/services/doc-imported";
import { importedComponentsReportSections } from "features/documentation/utils/imported-report";
import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { PdfMakeConverter } from "features/documentation/utils/generators/pdfmake-converter";
import { DEFAULT_CHAPTER_CONFIG, createDefaultDocData } from "features/documentation/models/doc-types";
import type { DocImportedThreatGroup } from "features/documentation/models/doc-types";
import { component, machine, tid } from "../../../fixtures/component-treatment-machine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const t = ((k: string, d?: string) => d ?? k) as never;

/** The fixture machine with a second, identical instance (SD2, ×3). */
const twoInstances = (): Project => {
  const m = machine();
  const first = m.components!.instances[0];
  return {
    ...m,
    components: { ...m.components!, instances: [first, { ...first, id: "i2", prefix: "SD2", multiprocessTfId: "mp-2", quantity: 3 }] },
  };
};

const docProject = (p: Project, extra: Any = {}): Any => ({
  info: { name: "Panel" },
  threats: { perElementTables: [], perInteractionTables: [] },
  risks: p.risks,
  computed: {
    strideNames: new Map([["S", "Spoofing"], ["T", "Tampering"], ["R", "Repudiation"], ["I", "Information Disclosure"], ["D", "Denial of Service"], ["E", "Elevation of Privilege"]]),
    moscowLabels: new Map(),
    importedThreats: docImportedThreats(p),
    importedRiskNotes: docImportedRiskNotes(p),
    ...extra,
  },
});

/** The component display id of the threat the fixture reduces. */
const p_reduceDisplayId = () => {
  const m = machine();
  const risk = m.risks!.risks.find((r) => r.threatId === tid(component.reduceThreat))!;
  return risk.threatDisplayId.replace(/^SD1:/, "");
};

describe("imported threats in the report data (6a-1)", () => {
  it("per component and method, each threat once, with every instance threat id", () => {
    const groups = docImportedThreats(twoInstances());
    const perElement = groups.find((g) => g.method === "per-element")!;
    expect(perElement).toMatchObject({ componentName: "Smoke Detector", at: { commit: "a" }, instances: ["SD1", "SD2"] });
    const ids = perElement.threats.map((x) => x.displayId);
    expect(new Set(ids).size).toBe(ids.length);
    // the reduced threat of the component, once, with both instance ids (the risk rows' link targets)
    const reduceId = p_reduceDisplayId();
    const reduce = perElement.threats.find((x) => x.displayId === reduceId)!;
    expect(reduce.instanceIds).toEqual([`SD1:${reduceId}`, `SD2:${reduceId}`]);
    // identical instances: nothing below the threat
    expect(perElement.threats.every((x) => x.differences.length === 0)).toBe(true);
  });

  it("the risk's provenance: instance, commit, prefilled factors, quantity", () => {
    const p = twoInstances();
    const risk = p.risks!.risks[0];
    risk.factorRatings = [
      { factorId: "skill_level", value: 3, weight: 1, source: "derived", derivedFrom: "component" },
      { factorId: "motive", value: 2, weight: 1, source: "manual" },
    ] as never;
    p.risks!.risks.push({ ...risk, id: "r-sd2", threatDisplayId: risk.threatDisplayId.replace(/^SD1:/, "SD2:") });
    const notes = docImportedRiskNotes(p);
    expect(notes.get(risk.id)).toMatchObject({ componentName: "Smoke Detector", prefix: "SD1", at: { commit: "a" }, quantity: 1, prefilled: ["skill_level"], overridden: [] });
    expect(notes.get("r-sd2")).toMatchObject({ prefix: "SD2", quantity: 3 });
  });

  it("no imports → nothing", () => {
    expect(docImportedThreats({ components: undefined, dfd: null })).toEqual([]);
    expect(docImportedRiskNotes({ components: undefined, risks: null }).size).toBe(0);
  });
});

describe("the threat chapter and the risk rows (Markdown, AsciiDoc)", () => {
  it("a heading per component, each threat once, the other instances as link targets", () => {
    const p = twoInstances();
    const gen = new MarkdownGenerator(docProject(p), { language: "en" } as never, t);
    const c = (gen as Any).generateThreats("Threats (per element)", "per-element");
    expect(c.hasContent).toBe(true);
    expect(c.content).toContain("Smoke Detector @ a — imported (SD1, SD2)");
    const group = docImportedThreats(p).find((g) => g.method === "per-element")!;
    for (const threat of group.threats) {
      expect(c.content).toContain(`<a id="threat-SD1:${threat.displayId}"></a>`);
      expect(c.content).toContain(`<a id="threat-SD2:${threat.displayId}"></a>`);
      // once: one row per component threat
      expect(c.content.split(`[${threat.displayId}](#risk-SD1:${threat.displayId})`).length - 1).toBe(1);
    }
    const adoc = (new AsciidocGenerator(docProject(p), { language: "en" } as never, t) as Any).generateThreats("Threats", "per-element");
    expect(adoc.content).toContain(`[[threat-SD2:${group.threats[0].displayId}]]`);
  });

  it("an instance that differs gets a line below the threat", () => {
    const p = twoInstances();
    const groups = docImportedThreats(p) as DocImportedThreatGroup[];
    const g = groups.find((x) => x.method === "per-element")!;
    g.threats[0] = { ...g.threats[0], relevance: "relevant", differences: [{ prefix: "SD2", override: { relevance: "not_relevant", rationale: "The cabinet is sealed" } }, { prefix: "SD2", counterpart: "P-7 Gateway" }] };
    const gen = new MarkdownGenerator(docProject(p, { importedThreats: groups }), { language: "en" } as never, t);
    const c = (gen as Any).generateThreats("Threats", "per-element");
    expect(c.content).toContain("SD2: relevance overridden by this TARA — relevant → not relevant: The cabinet is sealed");
    expect(c.content).toContain("SD2: counterpart P-7 Gateway");
  });

  it("the risk row says where the rating comes from", () => {
    const p = twoInstances();
    const risk = p.risks!.risks[0];
    risk.factorRatings = [{ factorId: "skill_level", value: 3, weight: 1, source: "derived", derivedFrom: "component" }] as never;
    const gen = new MarkdownGenerator(docProject(p), { language: "en" } as never, t);
    const row = (gen as Any).riskRow(risk);
    expect(row).toContain("SD1 · Smoke Detector @ a; from the component: skill_level");
  });
});

describe("the PDF has the same (review 2026-11-11: it had none of it)", () => {
  /** All strings of the document definition, depth first. */
  const strings = (node: Any, out: string[] = []): string[] => {
    if (typeof node === "string") out.push(node);
    else if (Array.isArray(node)) node.forEach((n) => strings(n, out));
    else if (node && typeof node === "object") Object.values(node).forEach((v) => strings(v, out));
    return out;
  };
  it("the imported threats per component, the differing instance, the provenance on its own line", () => {
    const p = twoInstances();
    const risk = p.risks!.risks[0];
    risk.factorRatings = [{ factorId: "skill_level", value: 3, weight: 1, source: "derived", derivedFrom: "component" }] as never;
    risk.moscowPriority = "should";
    const groups = docImportedThreats(p) as DocImportedThreatGroup[];
    const g = groups.find((x) => x.method === "per-element")!;
    g.threats[0] = { ...g.threats[0], relevance: "relevant", differences: [{ prefix: "SD2", override: { relevance: "not_relevant", rationale: "Sealed" } }] };
    const doc = { ...docProject(p, { importedThreats: groups }), info: { name: "Panel", tags: { domain: [], platform: [], regulation: [], custom: [] } }, assets: { assets: [] } };
    const config = { ...createDefaultDocData().configuration, language: "en", chapters: DEFAULT_CHAPTER_CONFIG.filter((c) => c.id === "threats-per-element" || c.id === "risks-per-element") };
    const all = strings(new PdfMakeConverter(doc as never, config as never, t).createDocumentDefinition().content);
    expect(all).toContain("Smoke Detector @ a — imported (SD1, SD2)");
    expect(all.some((x) => x.includes("\nSD2: relevance overridden by this TARA — relevant → not relevant: Sealed"))).toBe(true);
    // a line break, not a literal <br>
    expect(all.some((x) => /\nSD1 · Smoke Detector @ a; from the component: skill_level$/.test(x))).toBe(true);
    expect(all.some((x) => x.includes("<br>"))).toBe(false);
  });
});

describe("the chapter \"Imported components\" (6a-2)", () => {
  const prepared = () => {
    const p = twoInstances();
    // SD2: the assumption not fulfilled, with a rationale
    p.components!.instances[1].assumptions = [{ instanceId: "i2", assumptionId: "a1", status: "not_fulfilled", rationale: "The controller does not check frames" }];
    p.components!.imports[0] = { ...p.components!.imports[0], source: { ...p.components!.imports[0].source, repoUrl: "https://git.example.com/sd.git", path: "sd.tara.json", tag: "sd/v1" } };
    return p;
  };

  it("per component: origin, methodology, instances with EE mapping, assumptions, measures that do not count", () => {
    const [c] = docImportedComponents(prepared());
    expect(c).toMatchObject({
      componentName: "Smoke Detector",
      at: { tag: "sd/v1", commit: "a" },
      origin: { repoUrl: "https://git.example.com/sd.git", path: "sd.tara.json", importedAt: "t" },
      methodologyMatches: true,
    });
    const [sd1, sd2] = c.instances;
    expect(sd1).toMatchObject({ prefix: "SD1", quantity: 1 });
    // the EE mapped to the machine's PLC; the EEs taken over as new elements of this TARA
    expect(sd1.eeMapping).toContainEqual(expect.objectContaining({ machineElement: "EE-1 PLC" }));
    expect(sd1.assumptions).toEqual([{ displayId: "ASM-01", text: "Frames are checked by the controller", status: "open" }]);
    expect(sd2.assumptions[0]).toMatchObject({ status: "not_fulfilled", rationale: "The controller does not check frames" });
    // M-C-001 relies on ASM-01: unclear in SD1 (open, not implemented yet), not effective in SD2
    const m1 = sd1.measures.find((m) => m.label.startsWith("M-C-001"))!;
    expect(m1.effectiveness).toBe("unclear");
    expect(m1.reasons.map((r) => r.kind)).toEqual(expect.arrayContaining(["pending", "aou_open"]));
    expect(sd2.measures.find((m) => m.label.startsWith("M-C-001"))!.effectiveness).toBe("not_effective");
    // M-S-001 is implemented and relies on nothing: it counts, not listed
    expect(sd1.measures.some((m) => m.label.startsWith("M-S-001"))).toBe(false);
  });

  it("the chapter in Markdown: the credit rule, a section per component, a sub-section per instance", () => {
    const p = prepared();
    const gen = new MarkdownGenerator(docProject(p, { importedComponents: docImportedComponents(p) }), { language: "en" } as never, t);
    const c = (gen as Any).generateImportedComponents("Imported Components");
    expect(c.hasContent).toBe(true);
    expect(c.content).toContain("the residual is not credited");
    expect(c.content).toContain("Smoke Detector @ sd/v1");
    expect(c.content).toContain("https://git.example.com/sd.git");
    expect(c.content).toContain("SD2 ×3");
    expect(c.content).toContain("not fulfilled — The controller does not check frames");
    expect(c.content).toMatch(/Not effective here.*M-C-001/);
    expect(c.content).toContain("ASM-01 not fulfilled");
  });

  it("no imports: no chapter", () => {
    const gen = new MarkdownGenerator(docProject(twoInstances(), { importedComponents: undefined }), { language: "en" } as never, t);
    expect((gen as Any).generateImportedComponents("Imported Components").hasContent).toBe(false);
    expect(importedComponentsReportSections(undefined, t)).toEqual([]);
  });

  it("the PDF has the chapter too", () => {
    const p = prepared();
    const doc = { ...docProject(p, { importedComponents: docImportedComponents(p) }), info: { name: "Panel", tags: { domain: [], platform: [], regulation: [], custom: [] } }, assets: { assets: [] } };
    const config = { ...createDefaultDocData().configuration, language: "en", chapters: DEFAULT_CHAPTER_CONFIG.filter((c) => c.id === "imported-components") };
    const all: string[] = [];
    const walk = (n: Any) => (typeof n === "string" ? all.push(n) : Array.isArray(n) ? n.forEach(walk) : n && typeof n === "object" ? Object.values(n).forEach(walk) : undefined);
    walk(new PdfMakeConverter(doc as never, config as never, t).createDocumentDefinition().content);
    expect(all).toContain("Imported Components");
    expect(all.some((x) => x.includes("the residual is not credited"))).toBe(true);
    expect(all.some((x) => x.includes("Smoke Detector @ sd/v1"))).toBe(true);
  });
});

