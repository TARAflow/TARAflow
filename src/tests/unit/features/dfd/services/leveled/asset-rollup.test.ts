// Leveled DFD Phase 6d (leveled-dfd-multi-diagram-design.md §9, D3): a
// decomposed multiprocess holds the roll-up of its parts; relations from
// before the decomposition stay pending until a part holds them
// (BAL_ASSET_NOT_REALISED meanwhile); an ended decomposition keeps the
// roll-up as the multiprocess' own relations.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { buildAnalysisView } from "features/dfd/services/build-dfd-graph";
import {
  assetRollupsOfSource,
  reconcileAssetRollup,
} from "features/dfd/services/leveled/asset-rollup";
import type { DFDElement, DFDPage } from "features/dfd/models/dfd-types";
import type { AssetRelation } from "features/dfd/models/asset-relation-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  flow,
  mxfile,
  node,
  page,
} from "../../../../../fixtures/leveled-dfd-xml";

const rel = (assetId: string, relationType = "stores", assetGroup = "data") =>
  ({ assetId, relationType, assetGroup }) as unknown as AssetRelation;

// Sensor page: P-2 and a data store DS-1 with a flow between them.
const SEN = SENSOR.replace(
  "</root>",
  node("sen_ds1", "datastore", "Calibration", "DS-1", 300) +
    flow("sen_df1", "read calibration", "DF-1", "sen_ds1", "sen_p2") +
    "</root>",
);

const source = (
  xml: string,
  relations: Record<string, AssetRelation[]>,
  pages: DFDPage[] = LEVELED_PAGES,
) => {
  const { elements, connections } = dfdParser.parse(xml, pages);
  const withRelations = <T extends { id: string }>(records: T[]) =>
    records.map((r) => (relations[r.id] ? { ...r, assetRelations: relations[r.id] } : r));
  return {
    xml,
    pages,
    elements: withRelations(elements) as DFDElement[],
    connections: withRelations(connections),
    assets: [
      { id: "calib", name: "Calibration parameters" },
      { id: "fw", name: "Sensor firmware" },
    ] as never[],
  };
};

const LEVELED = mxfile(SYSTEM, SEN, CONTROLLER);
const relationsOf = (elements: DFDElement[], id: string) =>
  (elements.find((e) => e.id === id)?.assetRelations ?? []).map((r) => `${r.assetId}:${r.relationType}`);

describe("assetRollupsOfSource", () => {
  it("rolls the parts' pairs up to the multiprocess, once per pair, with the holders", () => {
    const rollups = assetRollupsOfSource(
      source(LEVELED, {
        sen_ds1: [rel("calib", "stores")],
        sen_p2: [rel("calib", "reads")],
        sen_df1: [rel("calib", "transports")],
      }),
    );
    const mp1 = rollups.get("mp1")!;
    expect(mp1.rollup.map((e) => [`${e.assetId}:${e.relationType}`, e.via])).toEqual([
      ["calib:reads", ["sen_p2"]],
      ["calib:stores", ["sen_ds1"]],
      ["calib:transports", ["sen_df1"]],
    ]);
    expect(mp1.pending).toEqual([]);
    // The flow between the two multiprocesses belongs to neither roll-up.
    expect(rollups.get("mp2")!.rollup).toEqual([]);
  });

  it("keeps relations from before the decomposition pending until a part holds them", () => {
    const rollups = assetRollupsOfSource(
      source(LEVELED, {
        mp1: [rel("calib", "stores"), rel("fw", "stores")],
        sen_ds1: [rel("calib", "stores")],
      }),
    );
    expect(rollups.get("mp1")!.pending.map((r) => r.assetId)).toEqual(["fw"]);
  });

  it("is empty for a classic DFD", () => {
    const classic = mxfile(page("p1", "Page-1", node("a", "process", "A", "P-1", 10)));
    expect(assetRollupsOfSource(source(classic, {}, [])).size).toBe(0);
  });
});

describe("reconcileAssetRollup (on save)", () => {
  it("removes a pending relation a part now covers and keeps the others", () => {
    const after = source(LEVELED, {
      mp1: [rel("calib", "stores"), rel("fw", "stores")],
      sen_ds1: [rel("calib", "stores")],
    });
    expect(relationsOf(reconcileAssetRollup(undefined, after), "mp1")).toEqual(["fw:stores"]);
  });

  it("returns the elements unchanged when nothing is covered", () => {
    const after = source(LEVELED, { mp1: [rel("fw", "stores")] });
    expect(reconcileAssetRollup(undefined, after)).toBe(after.elements);
  });

  it("materialises the last roll-up when the decomposition ends (child page deleted)", () => {
    const before = source(LEVELED, {
      mp1: [rel("fw", "stores")],
      sen_ds1: [rel("calib", "stores")],
      sen_p2: [rel("calib", "reads")],
    });
    const pagesAfter = LEVELED_PAGES.filter((p) => p.pageId !== "sen");
    const after = source(mxfile(SYSTEM, CONTROLLER), { mp1: [rel("fw", "stores")] }, pagesAfter);
    expect(relationsOf(reconcileAssetRollup(before, after), "mp1")).toEqual([
      "fw:stores",
      "calib:reads",
      "calib:stores",
    ]);
  });

  it("does not re-create anything when only a part is deleted", () => {
    const before = source(LEVELED, { sen_ds1: [rel("calib", "stores")] });
    const senWithoutDs = SENSOR; // DS-1 deleted, P-2 still there: still decomposed
    const after = source(mxfile(SYSTEM, senWithoutDs, CONTROLLER), {});
    expect(relationsOf(reconcileAssetRollup(before, after), "mp1")).toEqual([]);
  });
});

describe("BAL_ASSET_NOT_REALISED", () => {
  it("is reported per pending relation, with the asset's name", () => {
    const view = buildAnalysisView(source(LEVELED, { mp1: [rel("fw", "stores")] }));
    const findings = view.leveledFindings!.warnings.filter((f) => f.key.endsWith("BAL_ASSET_NOT_REALISED"));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      elementId: "mp1",
      params: { asset: "Sensor firmware", relation: "stores" },
    });
  });

  it("disappears once a part holds the asset", () => {
    const view = buildAnalysisView(
      source(LEVELED, { mp1: [rel("fw", "stores")], sen_ds1: [rel("fw", "stores")] }),
    );
    expect(view.leveledFindings!.warnings.some((f) => f.key.endsWith("BAL_ASSET_NOT_REALISED"))).toBe(false);
  });
});
