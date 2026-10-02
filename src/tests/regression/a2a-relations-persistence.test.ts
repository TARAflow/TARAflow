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
// Each stage is its own test so the report shows exactly where the relation
// disappears. Stages 2–4 pin TODAY's lossy behaviour (`not.…`) as evidence for
// G1 = FAIL. They deliberately do not use `it.fails`: that would also turn
// green if the pipeline threw for an unrelated reason. Once Phase 1 makes A2A
// relations canonical, these tests go red — that is the signal to invert the
// assertions.

import { describe, it, expect } from "vitest";
import { commitAssetSync } from "app/utils/commit-asset-sync";
import { serialiseProject } from "app/services/prepare-for-disk";
import { finalizeDfd } from "features/dfd/services/dfd-finalize";
import type { Project } from "app/models/project-types";
import type { AssetToAssetRelation } from "features/dfd/models/asset-relation-types";
import { migrate_5_to_6 } from "app/services/versions/migrate-5-to-6";
import { loadProjectFixture } from "../fixtures/load-fixture";

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

  it("stage 2 — KNOWN LOSS (B1): the relation never reaches project.assets", () => {
    const next = addRelationViaSidePanel(loadedProject());
    // No canonical field exists yet; anything reachable from project.assets
    // that names the target asset as a relation target would count.
    expect(JSON.stringify(next.assets)).not.toContain(
      `"targetAssetId":"${FUNC_ID}"`,
    );
  });

  it("stage 3 — KNOWN LOSS (B1): the relation is not written to disk", () => {
    const next = addRelationViaSidePanel(loadedProject());
    expect(serialiseProject(next)).not.toContain("required_by");
  });

  it("stage 4 — KNOWN LOSS (B1): the relation is gone after save and reopen", () => {
    const next = addRelationViaSidePanel(loadedProject());
    const reopened = commitAssetSync(
      undefined,
      JSON.parse(serialiseProject(next)) as Project,
    );
    // The asset itself survives the roundtrip — only its relation is lost.
    expect(reopened.dfd!.assets.some((a) => a.id === DATA_ID)).toBe(true);
    expect(a2aOnMirror(reopened)).toHaveLength(0);
  });
});

describe("Gate G1 — A2A relations through migrate_5_to_6 (AR-3 baseline)", () => {
  // v≤5 files kept A2A relations on dfd.assets[]. migrate_5_to_6 repoints
  // targetAssetId to the new UUIDs and then drops dfd.assets entirely.
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

  it("KNOWN LOSS (B1): the relation does not survive migrate_5_to_6", () => {
    const out = migrate_5_to_6(v5WithRelation());
    expect(out.schemaVersion).toBe(6);
    expect(JSON.stringify(out)).not.toContain("targetAssetId");
  });
});
