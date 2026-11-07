// src/tests/unit/app/services/component-import/instance-lifecycle.test.ts
// Multi-project TARA (design §6.7): a deleted multiprocess removes its
// instance — and the import with its last instance; an instance whose
// multiprocess was never saved is kept (CMP_INSTANCE_ORPHANED).
import { describe, expect, it } from "vitest";
import { pruneDeletedInstances } from "app/services/component-import/instance-lifecycle";
import { instanceAssetId } from "features/dfd";

const inst = (id: string, importId: string, mp: string) => ({ id, importId, multiprocessTfId: mp, prefix: id.toUpperCase(), eeMapping: [], assumptions: [] });
const imp = (id: string, name: string) => ({ id, componentId: id, name, source: { commitSha: "a", schemaVersion: 14 }, importedAt: "t", methodology: { likelihoodMethod: "x", factors: [], hash: "" }, snapshot: {} as never, contentHash: "h" });
const project = (elements: string[]) =>
  ({
    components: { imports: [imp("cam", "Camera"), imp("sd", "Smoke")], instances: [inst("cam1", "cam", "mp1"), inst("cam2", "cam", "mp2"), inst("sd1", "sd", "mp3")] },
    dfd: { elements: elements.map((id) => ({ id })) },
  }) as never;

describe("pruneDeletedInstances", () => {
  it("names the instance's assets (E5) for the purge", () => {
    const p = project(["mp1", "mp2", "mp3"]) as unknown as { components: { imports: { snapshot: unknown }[] } };
    p.components.imports[1].snapshot = { assets: [{ id: "a1" }, { id: "a2" }] };
    const r = pruneDeletedInstances(p as never, [{ id: "mp1" }, { id: "mp2" }]);
    expect(r.removed[0].assetIds).toEqual([instanceAssetId("sd1", "a1"), instanceAssetId("sd1", "a2")]);
  });

  it("nothing deleted: unchanged", () => {
    expect(pruneDeletedInstances(project(["mp1", "mp2", "mp3"]), [{ id: "mp1" }, { id: "mp2" }, { id: "mp3" }])).toEqual({ removed: [] });
  });

  it("one of two instances deleted: the instance goes, the import stays", () => {
    const r = pruneDeletedInstances(project(["mp1", "mp2", "mp3"]), [{ id: "mp1" }, { id: "mp3" }]);
    expect(r.removed).toEqual([{ prefix: "CAM2", component: "Camera", assetIds: [] }]);
    expect(r.components!.instances.map((i) => i.id)).toEqual(["cam1", "sd1"]);
    expect(r.components!.imports.map((i) => i.id)).toEqual(["cam", "sd"]);
  });

  it("the last instance deleted: the import goes too", () => {
    const r = pruneDeletedInstances(project(["mp1", "mp2", "mp3"]), [{ id: "mp1" }, { id: "mp2" }]);
    expect(r.components!.imports.map((i) => i.id)).toEqual(["cam"]);
    expect(r.removed).toEqual([{ prefix: "SD1", component: "Smoke", assetIds: [] }]);
  });

  it("an instance whose multiprocess was never saved is kept", () => {
    expect(pruneDeletedInstances(project(["mp1", "mp2"]), [{ id: "mp1" }, { id: "mp2" }])).toEqual({ removed: [] });
  });

  it("no components: nothing to do", () => {
    expect(pruneDeletedInstances({ dfd: null } as never, [])).toEqual({ removed: [] });
  });
});
