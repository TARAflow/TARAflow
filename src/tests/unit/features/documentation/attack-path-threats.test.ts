// tests/unit/features/documentation/attack-path-threats.test.ts
//
// Attack-path threats have no per-element/per-interaction table — they ride on
// the risks (sourceStrideMethod === "attack-path"). The dedicated chapter gives
// them an anchored home so the `threat-<id>` target every #threat-<id> link
// points at (traceability matrix, risk / SRSL / won't rows) actually exists.

import { describe, it, expect } from "vitest";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";

const t = ((k: string, d?: string) => d ?? k) as never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: any = { language: "en" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const project = (risks: any[]): any => ({
  info: { name: "Test" },
  assets: {
    assets: [
      { id: "AS-CFG", displayId: "AS-1", name: "Config Data" },
      { id: "AS-FW", displayId: "AS-2", name: "Firmware" },
    ],
  },
  threats: { perElementTables: [], perInteractionTables: [] },
  risks: { configuration: { likelihoodMethod: "iso-21434" }, risks },
  computed: {
    strideNames: new Map<string, string>([
      ["T", "Tampering"],
      ["D", "Denial of Service"],
    ]),
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apRisk = (over: any = {}) => ({
  id: "R-" + (over.threatDisplayId ?? "x"),
  threatDisplayId: "AT-at-1-66817c284a7a-T",
  threatDescription: "Malicious control signals via cellular ECU",
  sourceStrideMethod: "attack-path",
  moscowPriority: "should",
  linkedAssetIds: ["AS-CFG"],
  attackTreeAssessment: { treeId: "at-1", pathKey: "pk", likelihoodComponent: 0, strideCategory: "T" },
  ...over,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chapter = (gen: any) => gen.generateAttackPathThreats("Threat Scenarios (Attack Path)");

describe("Attack-path threats chapter", () => {
  it("hides when there are no attack-path risks", () => {
    const gen = new MarkdownGenerator(
      project([
        { ...apRisk(), sourceStrideMethod: "per-element" },
      ]),
      config,
      t,
    );
    const c = chapter(gen as never);
    expect(c.hasContent).toBe(false);
    expect(c.content).toBe("");
  });

  it("emits a threat-<id> anchor but shows a short TS-<n> label", () => {
    const gen = new MarkdownGenerator(project([apRisk()]), config, t);
    const c = chapter(gen as never);
    expect(c.hasContent).toBe(true);
    // long threatDisplayId stays only as the link target the matrix points at
    expect(c.content).toContain('id="threat-AT-at-1-66817c284a7a-T"');
    // visible label is the short TS-1 (matches the traceability matrix), linking
    // to the risk row via the long anchor
    expect(c.content).toContain("[TS-1](#risk-AT-at-1-66817c284a7a-T)");
    // the raw id is NOT shown as the visible cell text
    expect(c.content).not.toContain("]AT-at-1-66817c284a7a-T");
    expect(c.content).toContain("AS-1 Config Data");
    // no attackTree in this fixture → falls back to the plain description
    expect(c.content).toContain("Malicious control signals");
  });

  it("shows the attack-path chain (root → … → leaf) when the tree is present", () => {
    const p = project([apRisk()]);
    p.attackTree = {
      trees: [
        {
          id: "at-1",
          pathAnalysis: {
            paths: [
              {
                pathKey: "pk",
                path: ["Compromise Integrity", "Remote Attack", "Network Exploitation"],
              },
            ],
          },
        },
      ],
    };
    const gen = new MarkdownGenerator(p, config, t);
    const c = chapter(gen as never);
    expect(c.content).toContain(
      "Compromise Integrity → Remote Attack → Network Exploitation",
    );
  });

  it("renders one row per unique threatDisplayId (dedup)", () => {
    const gen = new MarkdownGenerator(
      project([apRisk(), apRisk({ id: "R-dup" })]), // same threatDisplayId
      config,
      t,
    );
    const c = chapter(gen as never);
    const anchors = c.content.match(/id="threat-/g) ?? [];
    expect(anchors.length).toBe(1);
  });

  it("excludes won't-address risks", () => {
    const gen = new MarkdownGenerator(
      project([apRisk({ moscowPriority: "wont" })]),
      config,
      t,
    );
    const c = chapter(gen as never);
    expect(c.hasContent).toBe(false);
  });

  it("anchors each threat by its full threatDisplayId", () => {
    const gen = new MarkdownGenerator(
      project([apRisk({ threatDisplayId: "AT-at-2-D", attackTreeAssessment: { treeId: "at-2", pathKey: "p", likelihoodComponent: 0, strideCategory: "D" } })]),
      config,
      t,
    );
    const c = chapter(gen as never);
    expect(c.content).toContain('id="threat-AT-at-2-D"');
  });
});
