// src/tests/regression/a2a-relations-persistence.test.ts
//
// Gate G1 (doc/Open/DFD/asset-graph-view-requirements.md §8, finding B1):
// are asset-to-asset (A2A) relations persisted, and where on the chain are
// they lost?
//
// The test drives the pure part of today's write path (§3.3.1):
//
//   AssetDescriptionForm.handleA2AChange
//     → onChange({ ...asset, assetRelations })    // on the DFDAsset mirror
//   → useDFDData.updateAsset → finalizeDfd        // mutation on dfd.assets
//   → updateProject → commitAssetSync(prev, next)
//   → save:  serialiseProject (prepareForDisk empties dfd.assets)
//   → load:  commitAssetSync(undefined, parsed)   // deriveDfdAssets
//
// Each stage is its own test so a regression shows exactly where the relation
// disappears. Until schema v8 stages 2–4 pinned the loss (G1 = FAIL, confirmed
// manually on 2026-10-03). Since v8 the mirror edits are lifted into the
// canonical edge list assets.relations[] (commitAssetSync) and projected back
// on load, so every stage must hold.

import { describe, it, expect } from "vitest";
import { commitAssetSync } from "app/utils/commit-asset-sync";
import { serialiseProject } from "app/services/prepare-for-disk";
import { finalizeDfd } from "features/dfd/services/dfd-finalize";
import type { Project } from "app/models/project-types";
import type { AssetToAssetRelation } from "features/dfd/models/asset-relation-types";
import { migrate_5_to_6 } from "app/services/versions/migrate-5-to-6";
import { loadProjectFixture } from "../fixtures/load-fixture";
import { parseAndRepair } from "app/services/migration-service";

const DATA_ID = "11111111-2222-4333-8444-555555555555";
const FUNC_ID = "66666666-7777-4888-8999-aaaaaaaaaaaa";

const RELATION: AssetToAssetRelation = {
  sourceGroup: "data",
  targetGroup: "function",
  targetAssetId: FUNC_ID,
  relationType: "required_by",
};

function featureAsset(id: string, displayId: string, name: string, group: string) {
  return {
    id,
    displayId,
    name,
    assetGroup: group,
    source: "dfd",
    syncedWithDFD: true,
    impactRatings: [],
    securityGoals: [],
    linkedDFDElements: [],
    properties: {},
  };
}

/** A project as it looks after load: feature store canonical, dfd.assets derived. */
function loadedProject(): Project {
  const onDisk = {
    id: "proj_g1",
    schemaVersion: 7,
    info: { name: "G1", description: "", version: "1.0", tags: {}, team: [] },
    phaseStatus: {},
    settings: {},
    status: "draft",
    hazards: null,
    threats: null,
    risks: null,
    attackTrees: null,
    documentation: null,
    audit: null,
    integration: null,
    assets: {
      assets: [
        featureAsset(DATA_ID, "DA-001", "Config Data", "data"),
        featureAsset(FUNC_ID, "FU-001", "Signature Check", "function"),
      ],
      configuration: { impactCriteria: [] },
    },
    dfd: {
      assets: [],
      elements: [
        {
          id: "p1",
          type: "Process",
          name: "Updater",
          displayId: "P-1",
          position: { x: 0, y: 0 },
          size: { width: 120, height: 60 },
          assetRelations: [
            { assetId: DATA_ID, assetGroup: "data", relationType: "reads" },
            { assetId: FUNC_ID, assetGroup: "function", relationType: "implements" },
          ],
        },
      ],
      connections: [],
    },
  } as unknown as Project;
  return commitAssetSync(undefined, onDisk);
}

/** Today's write path for a new A2A relation on the DATA asset. */
function addRelationViaSidePanel(prev: Project): Project {
  const dfd = prev.dfd!;
  const updatedDfd = finalizeDfd({
    ...dfd,
    assets: dfd.assets.map((a) =>
      a.id === DATA_ID
        ? ({ ...a, assetRelations: [RELATION] } as typeof a)
        : a,
    ),
  });
  return commitAssetSync(prev, { ...prev, dfd: updatedDfd });
}

function a2aOnMirror(project: Project): unknown[] {
  const asset = project.dfd?.assets.find((a) => a.id === DATA_ID);
  return ((asset as any)?.assetRelations ?? []) as unknown[];
}

describe("Gate G1 — A2A relation persistence (B1)", () => {
  it("fixture loads both assets into the runtime mirror", () => {
    const project = loadedProject();
    expect(project.dfd!.assets.map((a) => a.id).sort()).toEqual(
      [DATA_ID, FUNC_ID].sort(),
    );
  });

  it("stage 1 — within the session the relation is visible on dfd.assets", () => {
    const next = addRelationViaSidePanel(loadedProject());
    expect(a2aOnMirror(next)).toHaveLength(1);
  });

  it("stage 2 — the relation reaches the canonical store (project.assets.relations)", () => {
    const next = addRelationViaSidePanel(loadedProject());
    expect(next.assets!.relations).toHaveLength(1);
    expect(next.assets!.relations![0]).toMatchObject({
      sourceAssetId: DATA_ID,
      targetAssetId: FUNC_ID,
      relationType: "required_by",
    });
    expect(next.assets!.relations![0]).not.toHaveProperty("sourceGroup");
  });

  it("stage 3 — the relation is written to disk", () => {
    const next = addRelationViaSidePanel(loadedProject());
    const onDisk = JSON.parse(serialiseProject(next));
    expect(onDisk.dfd.assets).toEqual([]);
    expect(onDisk.assets.relations).toHaveLength(1);
  });

  it("stage 4 — the relation survives save and reopen, with the same id", () => {
    const next = addRelationViaSidePanel(loadedProject());
    const id = next.assets!.relations![0].id;
    const reopened = commitAssetSync(
      undefined,
      parseAndRepair(JSON.parse(serialiseProject(next)))!,
    );
    expect(a2aOnMirror(reopened)).toEqual([
      expect.objectContaining({
        id,
        targetAssetId: FUNC_ID,
        relationType: "required_by",
        sourceGroup: "data",
        targetGroup: "function",
      }),
    ]);
    expect(reopened.assets!.relations!.map((r) => r.id)).toEqual([id]);
  });

  it("stage 5 — an unchanged write after reopen does not touch the edges", () => {
    const next = addRelationViaSidePanel(loadedProject());
    const reopened = commitAssetSync(
      undefined,
      parseAndRepair(JSON.parse(serialiseProject(next)))!,
    );
    const touched = commitAssetSync(reopened, {
      ...reopened,
      dfd: finalizeDfd({ ...reopened.dfd! }),
    });
    expect(touched.assets!.relations).toBe(reopened.assets!.relations);
  });

  it("removing the relation on the mirror removes the canonical edge", () => {
    const withRel = addRelationViaSidePanel(loadedProject());
    const dfd = withRel.dfd!;
    const removed = commitAssetSync(withRel, {
      ...withRel,
      dfd: finalizeDfd({
        ...dfd,
        assets: dfd.assets.map((a) =>
          a.id === DATA_ID ? ({ ...a, assetRelations: [] } as typeof a) : a,
        ),
      }),
    });
    expect(removed.assets!.relations).toEqual([]);
    expect(JSON.parse(serialiseProject(removed)).assets.relations).toBeUndefined();
  });

  it("a writer that drops the relations field does not delete the edges (B1 guard)", () => {
    const withRel = addRelationViaSidePanel(loadedProject());
    const { relations: _dropped, ...assetsWithout } = withRel.assets!;
    const after = commitAssetSync(withRel, {
      ...withRel,
      assets: assetsWithout as typeof withRel.assets,
    });
    expect(after.assets!.relations).toHaveLength(1);
  });
});

describe("A2A relations through migrate_5_to_6 (AR-3, schema v8)", () => {
  // v≤5 files kept A2A relations on dfd.assets[]. migrate_5_to_6 repoints
  // targetAssetId to the new UUIDs, lifts the relations into assets.relations
  // and only then drops dfd.assets.
  function v5WithRelation(): any {
    const raw: any = loadProjectFixture("asset-uuid-migration-v5.tara.json");
    raw.dfd.assets = raw.dfd.assets.map((a: any) =>
      a.id === "DA-001"
        ? {
            ...a,
            assetRelations: [
              {
                sourceGroup: "data",
                targetGroup: "system",
                targetAssetId: "DA-002",
                relationType: "configures",
              },
            ],
          }
        : a,
    );
    return raw;
  }

  it("fixture carries the relation before migration", () => {
    expect(JSON.stringify(v5WithRelation())).toContain('"targetAssetId":"DA-002"');
  });

  it("the relation survives migrate_5_to_6 as a canonical edge with UUID endpoints", () => {
    const out = migrate_5_to_6(v5WithRelation());
    expect(out.schemaVersion).toBe(6);
    expect(out.dfd.assets).toEqual([]);
    const byDisplayId = new Map<string, string>(
      out.assets.assets.map((a: any) => [a.displayId, a.id]),
    );
    expect(out.assets.relations).toHaveLength(1);
    expect(out.assets.relations[0]).toMatchObject({
      sourceAssetId: byDisplayId.get("DA-001"),
      targetAssetId: byDisplayId.get("DA-002"),
      relationType: "configures",
    });
    expect(out.assets.relations[0]).not.toHaveProperty("sourceGroup");
    expect(out.assets.relations[0]).not.toHaveProperty("targetGroup");
  });
});
