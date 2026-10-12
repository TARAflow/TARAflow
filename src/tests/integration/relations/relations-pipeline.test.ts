// src/tests/integration/relations/relations-pipeline.test.ts
//
// Every relation the dialogs can create must survive the production chain:
// dialog onChange → DFD tab handler → persistence hook → updateProject →
// save → open. Cases are generated from the rule tables, so a new allowed
// relation type is covered automatically.
//
//   Element → Asset   getAllowedRelations(elementType, assetGroup)
//   Asset → Asset     ALLOWED_A2A_RELATIONS[sourceGroup][targetGroup]
//
// Base project: the real SmokeDetector fixture (schema 2, migrated on open)
// plus the element types and asset groups it lacks.

import { beforeAll, describe, expect, it } from "vitest";
import { getAllowedRelations } from "features/dfd/models/asset-constants";
import type { DFDElementType } from "features/dfd/models/dfd-element-types";
import { ALLOWED_A2A_RELATIONS, validateA2ARelations } from "shared";
import type { AssetGroup } from "shared";
import type { Project } from "app/models/project-types";
import { serialiseProject } from "app/services/prepare-for-disk";
import { projectRepository } from "app/services/project-repository";
import { commitLoadedProject } from "app/services/project-commit";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../fixtures/load-fixture";
import { openProject, RelationSession } from "./relations-harness";

const GROUPS: AssetGroup[] = [
  "data",
  "function",
  "system",
  "infrastructure",
  "process",
  "physical",
  "service",
  "human",
  "environment",
];

const ELEMENT_TYPES: DFDElementType[] = [
  "ExternalEntity",
  "Process",
  "Multiprocess",
  "DataStore",
  "Interface",
  "TrustBoundary",
  "ChipBoundary",
  "PhysicalBoundary",
  "Sensor",
  "Actuator",
];

let BASE = "";

/** SmokeDetector + two assets per group + one element per missing type. */
function buildBaseFile(): string {
  const p: Project = openProject(
    JSON.stringify(loadProjectFixture("SmokeDetector.tara.json")),
  );
  const assets = [...p.assets!.assets];
  const template = assets[0];
  let n = 0;
  for (const group of GROUPS) {
    for (let i = 0; i < 2; i++) {
      n += 1;
      const id = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
      assets.push({
        ...structuredClone(template),
        id,
        displayId: `T${n}`,
        name: `Test ${group} ${i + 1}`,
        assetGroup: group,
        source: "dfd",
        linkedDFDElements: [],
        impactRatings: [],
        securityGoals: [],
      } as typeof template);
    }
  }
  const elements = [...p.dfd!.elements];
  const proto = elements.find((e) => e.type === "Process")!;
  for (const type of ELEMENT_TYPES) {
    if (elements.some((e) => e.type === type)) continue;
    elements.push({
      ...structuredClone(proto),
      id: `el-${type}`,
      type,
      name: `Test ${type}`,
      displayId: `X-${type}`,
      assetRelations: [],
    } as typeof proto);
  }
  const next = commitLoadedProject({
    ...p,
    assets: { ...p.assets!, assets },
    dfd: { ...p.dfd!, elements, assets: [] },
  });
  return serialiseProject(next);
}

function firstAsset(p: Project, group: AssetGroup, skip?: string): string {
  const a = p.dfd!.assets.find((x) => x.assetGroup === group && x.id !== skip);
  if (!a) throw new Error(`no ${group} asset on the mirror`);
  return a.id;
}

beforeAll(() => {
  BASE = buildBaseFile();
});

describe("base project", () => {
  it("opens with every element type, a DataFlow and two assets per group", () => {
    const p = openProject(BASE);
    for (const t of ELEMENT_TYPES) {
      expect(p.dfd!.elements.some((e) => e.type === t), t).toBe(true);
    }
    expect(p.dfd!.connections.length).toBeGreaterThan(0);
    for (const g of GROUPS) {
      expect(p.dfd!.assets.filter((a) => a.assetGroup === g).length, g).toBeGreaterThanOrEqual(2);
    }
  });
});

// ==================== ELEMENT → ASSET ====================

const elementCases: [DFDElementType, AssetGroup, string][] = [];
for (const t of [...ELEMENT_TYPES, "DataFlow" as DFDElementType]) {
  for (const g of GROUPS) {
    for (const r of getAllowedRelations(t, g)) elementCases.push([t, g, r]);
  }
}

describe("Element → Asset: every allowed relation survives save and reopen", () => {
  it.each(elementCases)("%s → %s: %s", (type, group, relationType) => {
    const s = new RelationSession(openProject(BASE));
    const assetId = firstAsset(s.project, group);
    const relation = { assetId, assetGroup: group, relationType };

    let holderId: string;
    if (type === "DataFlow") {
      const conn = s.project.dfd!.connections[0];
      holderId = conn.id;
      s.setConnectionRelations(conn.id, [
        ...(conn.assetRelations ?? []).filter((r) => r.assetId !== assetId),
        relation,
      ]);
    } else {
      const el = s.project.dfd!.elements.find((e) => e.type === type)!;
      holderId = el.id;
      s.setElementRelations(el.id, [
        ...(el.assetRelations ?? []).filter((r) => r.assetId !== assetId),
        relation,
      ]);
    }

    const holders = (p: Project) =>
      type === "DataFlow" ? p.dfd!.connections : p.dfd!.elements;
    const has = (p: Project) =>
      (holders(p).find((h) => h.id === holderId)!.assetRelations ?? []).some(
        (r) => r.assetId === assetId && r.relationType === relationType,
      );

    expect(has(s.project), "in session").toBe(true);
    const reopened = s.reopen();
    expect(has(reopened.project), "after reopen").toBe(true);
    reopened.close();
  });
});

// ==================== ASSET → ASSET ====================

const a2aCases: [AssetGroup, AssetGroup, string][] = [];
for (const sg of GROUPS) {
  for (const tg of GROUPS) {
    for (const r of ALLOWED_A2A_RELATIONS[sg]?.[tg] ?? []) a2aCases.push([sg, tg, r]);
  }
}

describe("Asset → Asset: every allowed relation survives save and reopen", () => {
  it.each(a2aCases)("%s → %s: %s", (sourceGroup, targetGroup, relationType) => {
    const s = new RelationSession(openProject(BASE));
    const sourceId = firstAsset(s.project, sourceGroup);
    const targetId = firstAsset(s.project, targetGroup, sourceId);
    s.addA2A(sourceId, { targetAssetId: targetId, relationType });
    expect(s.lastRejected).toEqual([]);

    const edge = (p: Project) =>
      (p.assets!.relations ?? []).find(
        (r) =>
          r.sourceAssetId === sourceId &&
          r.targetAssetId === targetId &&
          r.relationType === relationType,
      );

    expect(edge(s.project), "canonical in session").toBeDefined();
    const id = edge(s.project)!.id;
    const reopened = s.reopen();
    expect(edge(reopened.project)?.id, "same edge after reopen").toBe(id);
    const mirror = (reopened.asset(sourceId) as any).assetRelations;
    expect(mirror).toEqual([
      expect.objectContaining({ id, targetAssetId: targetId, relationType }),
    ]);
    reopened.close();
  });
});

// ==================== LIFECYCLE ====================

describe("Asset → Asset lifecycle", () => {
  it("add two, remove one, reopen: exactly the remaining one is there", () => {
    const s = new RelationSession(openProject(BASE));
    const d = firstAsset(s.project, "data");
    const f = firstAsset(s.project, "function");
    const p = firstAsset(s.project, "process");
    s.addA2A(d, { targetAssetId: f, relationType: "required_by" });
    s.addA2A(d, { targetAssetId: p, relationType: "required_by" });
    const toF = (s.asset(d) as any).assetRelations.find((r: any) => r.targetAssetId === f);
    s.a2a([{ kind: "remove", relationId: toF.id }]);
    const r = s.reopen();
    expect(r.project.assets!.relations!.filter((x) => x.sourceAssetId === d).map((x) => x.targetAssetId)).toEqual([p]);
    r.close();
  });

  it("attributes survive (rationale, stepOrder, degradation)", () => {
    const s = new RelationSession(openProject(BASE));
    const sys = firstAsset(s.project, "system");
    const sys2 = firstAsset(s.project, "system", sys);
    s.addA2A(sys, {
        targetAssetId: sys2,
        relationType: "depends_on",
        rationale: "needs time sync",
        stepOrder: 2,
        degradationMode: true,
        degradationDescription: "runs on local clock",
      });
    const r = s.reopen();
    expect(r.project.assets!.relations![0]).toMatchObject({
      rationale: "needs time sync",
      stepOrder: 2,
      degradationMode: true,
      degradationDescription: "runs on local clock",
    });
    r.close();
  });

  it("an unrelated edit after reopen keeps the relations untouched", () => {
    const s = new RelationSession(openProject(BASE));
    const d = firstAsset(s.project, "data");
    const f = firstAsset(s.project, "function");
    s.addA2A(d, { targetAssetId: f, relationType: "configures" });
    const r = s.reopen();
    const before = r.project.assets!.relations;
    r.changeAsset(f, { ...r.asset(f), name: "Renamed" });
    expect(r.project.assets!.relations).toEqual(before);
    r.close();
  });

  it("group change of the source: the edge is kept and reported, not dropped (B5)", () => {
    const s = new RelationSession(openProject(BASE));
    const d = firstAsset(s.project, "data");
    const f = firstAsset(s.project, "function");
    s.addA2A(d, { targetAssetId: f, relationType: "required_by" });
    s.changeAsset(d, { ...s.asset(d), assetGroup: "human" });
    const r = s.reopen();
    const groups = new Map(r.project.assets!.assets.map((a) => [a.id, a.assetGroup as AssetGroup]));
    const findings = validateA2ARelations(r.project.assets!.relations ?? [], (id) => groups.get(id));
    expect(findings).toEqual([
      expect.objectContaining({ reason: "type_not_allowed" }),
    ]);
    r.close();
  });

  it("the service rejects what the rules forbid; nothing is written", () => {
    const s = new RelationSession(openProject(BASE));
    const d = firstAsset(s.project, "data");
    const f = firstAsset(s.project, "function");
    const before = s.project.assets!.relations;
    s.addA2A(d, { targetAssetId: f, relationType: "hosted_on" });
    expect(s.lastRejected).toEqual([
      expect.objectContaining({ reason: "type_not_allowed" }),
    ]);
    expect(s.project.assets!.relations).toEqual(before);
    s.close();
  });

  it("an exact duplicate is rejected, another type on the same pair is kept", () => {
    const s = new RelationSession(openProject(BASE));
    const d = firstAsset(s.project, "data");
    const f = firstAsset(s.project, "function");
    s.addA2A(d, { targetAssetId: f, relationType: "required_by" });
    s.addA2A(d, { targetAssetId: f, relationType: "required_by" });
    expect(s.lastRejected).toEqual([expect.objectContaining({ reason: "duplicate" })]);
    s.addA2A(d, { targetAssetId: f, relationType: "configures" });
    expect(
      s.project.assets!.relations!.filter((r) => r.sourceAssetId === d).map((r) => r.relationType).sort(),
    ).toEqual(["configures", "required_by"]);
    s.close();
  });
});

describe("Group change → invalid asset links are reported (B5)", () => {
  it("the asset tab finding names the source asset and the link; the edge stays", async () => {
    const { collectAssetFindings } = await import("features/assets/services/asset-validator");
    const s = new RelationSession(openProject(BASE));
    const d = firstAsset(s.project, "data");
    const f = firstAsset(s.project, "function");
    s.addA2A(d, { targetAssetId: f, relationType: "required_by" });
    expect(
      collectAssetFindings(s.project.assets!).filter((x) => x.key.startsWith("tabs.assets.validation.a2a.")),
    ).toEqual([]);

    s.changeAsset(d, { ...s.asset(d), assetGroup: "human" });

    const found = collectAssetFindings(s.project.assets!).filter((x) =>
      x.key.startsWith("tabs.assets.validation.a2a."),
    );
    expect(found).toEqual([
      expect.objectContaining({
        key: "tabs.assets.validation.a2a.type_not_allowed",
        assetId: d,
        severity: "warning",
        params: expect.objectContaining({ sourceGroup: "human", targetGroup: "function" }),
      }),
    ]);
    expect(s.project.assets!.relations).toHaveLength(1);
    s.close();
  });

  it("the DFD tab finding names the source asset and the link (notification panel)", async () => {
    const { validateAssetLinks } = await import(
      "features/dfd/services/validators/asset-link-validator"
    );
    const dfdLinkFindings = (p: Project) => {
      const warnings: { key: string; elementId?: string; params?: Record<string, unknown> }[] = [];
      validateAssetLinks(p.dfd!.assets, warnings as never);
      return warnings;
    };
    const s = new RelationSession(openProject(BASE));
    const d = firstAsset(s.project, "data");
    const f = firstAsset(s.project, "function");
    s.addA2A(d, { targetAssetId: f, relationType: "required_by" });
    expect(dfdLinkFindings(s.project)).toEqual([]);

    s.changeAsset(d, { ...s.asset(d), assetGroup: "human" });

    const display = (id: string) => s.project.dfd!.assets.find((a) => a.id === id)!.displayId;
    expect(dfdLinkFindings(s.project)).toEqual([
      expect.objectContaining({
        key: "dfdValidation.assetLink.type_not_allowed",
        elementId: d,
        params: expect.objectContaining({
          name: display(d),
          relation: `required_by ${display(f)}`,
          sourceGroup: "human",
          targetGroup: "function",
        }),
      }),
    ]);
    s.close();
  });
});

describe("DFD export → import into a new project keeps asset links", () => {
  function freshProjectFile(): string {
    const p = projectRepository.createEmpty("Import target", "") as Project;
    // A new project has no asset store; its DFD exists once the tab is opened.
    return serialiseProject({
      ...p,
      assets: null,
      dfd: { xml: "", elements: [], connections: [], assets: [], lastModified: "2026-01-01T00:00:00.000Z" },
    } as unknown as Project);
  }

  it("relations arrive in assets.relations and survive save and reopen", () => {
    const src = new RelationSession(openProject(BASE));
    const d = firstAsset(src.project, "data");
    const f = firstAsset(src.project, "function");
    src.addA2A(d, { targetAssetId: f, relationType: "required_by" });
    const exported = src.exportDfd();
    src.close();

    const target = new RelationSession(openProject(freshProjectFile()));
    expect(target.project.assets).toBeNull();
    target.importDfd(exported as any);

    expect(target.lastRejected).toEqual([]);
    const edge = (p: Project) =>
      (p.assets?.relations ?? []).find(
        (r) => r.sourceAssetId === d && r.targetAssetId === f && r.relationType === "required_by",
      );
    expect(edge(target.project), "after import").toBeDefined();
    const reopened = target.reopen();
    expect(edge(reopened.project), "after reopen").toBeDefined();
    reopened.close();
  });
});

describe("First edit after opening a project (B11)", () => {
  // The DFD tab can first render with the on-disk project (asset mirror
  // empty) and then with the committed one, whose mirror is derived without
  // bumping dfd.lastModified. The first asset edit must apply to the
  // committed state, not to the empty snapshot.
  function rawAndCommitted(): { raw: Project; committed: Project } {
    const raw = parseAndRepair(JSON.parse(BASE)) as Project;
    const committed = commitLoadedProject(raw);
    return { raw, committed };
  }

  it("precondition: same dfd.lastModified, empty mirror on disk", () => {
    const { raw, committed } = rawAndCommitted();
    expect(raw.dfd!.assets).toEqual([]);
    expect(committed.dfd!.assets.length).toBeGreaterThan(0);
    expect(committed.dfd!.lastModified).toBe(raw.dfd!.lastModified);
  });

  it("a group change right after opening is applied", () => {
    const { raw, committed } = rawAndCommitted();
    const s = new RelationSession(committed, raw);
    const d = firstAsset(s.project, "data");
    s.changeAsset(d, { ...s.asset(d), assetGroup: "human" });
    expect(s.asset(d).assetGroup).toBe("human");
    expect(s.project.assets!.assets.find((a) => a.id === d)!.assetGroup).toBe("human");
    s.close();
  });
});
