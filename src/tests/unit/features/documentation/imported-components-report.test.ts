// tests/unit/features/documentation/imported-components-report.test.ts
//
// Multi-project TARA phase 6a-1 (review 2026-11-11): the report's threat
// chapters show the imported threats per component, each threat once, the
// instances below only where they differ; every instance threat stays a link
// target of its risk row; the risk rows say where their rating comes from.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { docImportedRiskNotes, docImportedThreats } from "app/services/doc-imported";
import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
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
