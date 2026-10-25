// tests/unit/features/threats/services/category-control-selection.test.ts
//
// Mitigation catalog design, step 3 (doc/InProgress/Threat/mitigation-
// catalog-attack-vector.md, D3 / D4): controls for a threat without
// template-specific controls — by STRIDE category, fitting the project
// context, and for an attack path with a vector: that vector first, then
// vector-free, none for other vectors. The attack-path builder uses it,
// verifications follow the chosen controls.

import { describe, it, expect } from "vitest";
import {
  getAllMitigations,
  selectCategoryControls,
  selectCategoryVerifications,
} from "features/threats/services/threat-catalog-service";
import { buildAttackPathThreatReferences } from "app/utils/build-attack-path-threat-references";
import { attackTreeOperations } from "features/attacktree/services/attacktree-operations";
import type { AttackTree, AttackTreeData } from "features/attacktree/models/attacktree-types";
import type { ProjectTags } from "shared";
import { makeAsset, makeProjectData } from "../../attacktree/attacktree-factory";

const tags = (over: Partial<ProjectTags> = {}): ProjectTags => ({
  domain: [],
  platform: [],
  regulation: [],
  custom: [],
  ...over,
});
const ids = (list: { id: string }[]) => list.map((m) => m.id);
const vectorsOf = (id: string) => getAllMitigations().find((m) => m.id === id)?.attackVectors;

describe("selectCategoryControls", () => {
  it("without a vector: category order as before", () => {
    const before = getAllMitigations()
      .filter((m) => m.strideCategory === "D")
      .slice(0, 4)
      .map((m) => m.id);
    expect(ids(selectCategoryControls("D", { tags: tags(), limit: 4 }))).toEqual(before);
  });

  it("physical: physical controls first, then vector-free, never network-only", () => {
    const picked = selectCategoryControls("D", { attackVector: "physical", tags: tags(), limit: 50 });
    const firstFree = picked.findIndex((m) => !m.attackVectors);
    expect(picked[0].attackVectors).toContain("physical");
    expect(picked.slice(firstFree).every((m) => !m.attackVectors)).toBe(true);
    expect(ids(picked)).not.toContain("M-D-001"); // rate limiting: network, adjacent
    for (const m of picked) expect(!m.attackVectors || m.attackVectors.includes("physical"), m.id).toBe(true);
  });

  it("network: no physical controls", () => {
    const picked = selectCategoryControls("T", { attackVector: "network", tags: tags(), limit: 50 });
    expect(ids(picked)).not.toContain("M-T-008"); // cable duct
    expect(ids(picked)).toContain("M-T-005"); // TLS
    expect(ids(picked)).toContain("M-OPS-002"); // signed OTA
  });

  it("in-vehicle controls only in the Automotive domain", () => {
    const auto = ids(selectCategoryControls("S", { attackVector: "adjacent", tags: tags({ domain: ["Automotive"] }), limit: 50 }));
    const other = ids(selectCategoryControls("S", { attackVector: "adjacent", tags: tags({ domain: ["Industrial"] }), limit: 50 }));
    expect(auto).toContain("M-VEH-005");
    expect(other).not.toContain("M-VEH-005");
    expect(other).toContain("M-OS-005"); // Linux / network controls everywhere
  });

  it("Embedded-only controls only on an Embedded platform", () => {
    const embeddedOnly = getAllMitigations().filter((m) => m.context.platform?.includes("Embedded"));
    expect(embeddedOnly.length).toBeGreaterThan(0);
    const stride = embeddedOnly[0].strideCategory;
    const cloud = ids(selectCategoryControls(stride, { tags: tags({ platform: ["Cloud"] }), limit: 500 }));
    const embedded = ids(selectCategoryControls(stride, { tags: tags({ platform: ["Embedded"] }), limit: 500 }));
    expect(cloud).not.toContain(embeddedOnly[0].id);
    expect(embedded).toContain(embeddedOnly[0].id);
  });

  it("excludes given ids and honours the limit", () => {
    const all = selectCategoryControls("E", { tags: tags(), limit: 3 });
    const next = selectCategoryControls("E", { tags: tags(), limit: 3, exclude: new Set(ids(all)) });
    expect(all).toHaveLength(3);
    expect(ids(next).some((id) => ids(all).includes(id))).toBe(false);
    expect(selectCategoryControls("E", { tags: tags(), limit: -1 })).toEqual([]);
  });

  it("verifications fit the project context", () => {
    const auto = ids(selectCategoryVerifications("S", { tags: tags({ domain: ["Automotive"] }), limit: 500 }));
    const other = ids(selectCategoryVerifications("S", { tags: tags(), limit: 500 }));
    expect(auto).toContain("V-VEH-001");
    expect(other).not.toContain("V-VEH-001");
  });
});

describe("attack-path threats get controls for their vector", () => {
  const AP = "et=1w,se=proficient,kn=restricted,wo=easy,eq=standard";
  const DSL = [
    "Lamp off while driving;ROOT @service-disruption",
    "\tVia the vehicle wiring;OR av=physical",
    `\t\tCut the lamp supply line;${AP}`,
    `\t\tPull the headlamp connector;${AP}`,
    "\tVia the cellular link;OR av=network",
    `\t\tFlood the telematics unit;${AP}`,
    `\t\tCrash the navigation stack;${AP}`,
  ].join("\n");

  const trees = (): AttackTreeData => {
    const project = makeProjectData({ assets: [makeAsset({ id: "A-1" })] });
    const base = attackTreeOperations.createParsedTree(
      { type: "asset", assetId: "A-1", assetName: "Lamp", securityGoal: "A" },
      {},
      project,
    );
    const tree: AttackTree = attackTreeOperations.parseAndValidateTree(base, DSL, project);
    const pathAssessments = tree.pathAnalysis!.paths.map((p) => ({
      pathKey: p.pathKey,
      strideCategory: "D" as const,
      relevance: "relevant" as const,
      lastModified: "t",
    }));
    return { trees: [{ ...tree, pathAssessments }], configuration: {} } as unknown as AttackTreeData;
  };

  it("physical path: physical or vector-free controls; network path: no physical ones", () => {
    const refs = buildAttackPathThreatReferences(trees(), false, tags({ domain: ["Automotive"] }));
    const physical = refs.find((r) => r.attackDescription.includes("Cut the lamp supply line"))!;
    const network = refs.find((r) => r.attackDescription.includes("Flood the telematics unit"))!;
    expect(physical.attackVector).toBe("physical");
    expect(network.attackVector).toBe("network");
    for (const m of physical.proposedMitigations) {
      const v = vectorsOf(m.id!);
      expect(!v || v.includes("physical"), m.id).toBe(true);
    }
    expect(physical.proposedMitigations.some((m) => vectorsOf(m.id!)?.includes("physical"))).toBe(true);
    for (const m of network.proposedMitigations) {
      const v = vectorsOf(m.id!);
      expect(!v || v.includes("network"), m.id).toBe(true);
    }
  });

  it("verifications follow the chosen controls", () => {
    const refs = buildAttackPathThreatReferences(trees(), false, tags());
    const physical = refs.find((r) => r.attackDescription.includes("Cut the lamp supply line"))!;
    const own = physical.proposedMitigations.flatMap(
      (m) => getAllMitigations().find((c) => c.id === m.id)?.verifications ?? [],
    );
    expect(physical.proposedVerifications.length).toBeGreaterThan(0);
    expect(own).toContain(physical.proposedVerifications[0].id);
  });
});
