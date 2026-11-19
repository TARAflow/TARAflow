// Overview, tab "Components" (user 2026-11-11): per import the component's
// overview at the imported commit, where it comes from, the methodology
// match and the instances with their assumptions of use.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import type { ComponentSnapshot } from "app/models/component-snapshot-types";
import { componentOverviewItems } from "app/services/component-import/component-overview";
import { pruneDeletedInstances } from "app/services/component-import/instance-lifecycle";
import { machine } from "../../../../fixtures/component-treatment-machine";

const withAbout = (about: ComponentSnapshot["about"] | undefined): Project => {
  const m = machine();
  const imported = m.components!.imports[0];
  const snapshot = { ...(imported.snapshot as ComponentSnapshot) };
  if (about) snapshot.about = about;
  else delete snapshot.about;
  return { ...m, components: { ...m.components!, imports: [{ ...imported, snapshot, source: { ...imported.source, repoUrl: "https://git.example.com/sd.git", path: "sd.tara.json", tag: "sd/v1" } }] } };
};

describe("componentOverviewItems", () => {
  it("the overview, the origin, the methodology match and the instances", () => {
    const [item] = componentOverviewItems(
      withAbout({
        description: "Smoke detector case",
        responsible: "Platform team",
        sections: { environment: { text: "Ceiling", source: { document: "Spec", section: "§2" } } },
        functions: [{ id: "f1", name: "Detect smoke", lifecyclePhases: ["operation"] }],
        sourceBindings: [{ id: "b1", repoUrl: "https://git.example.com/fw.git", refType: "tag", refLabel: "v1.2", resolvedCommitSha: "abc" }],
      }),
    );
    expect(item).toMatchObject({
      importId: "imp",
      name: "Smoke Detector",
      description: "Smoke detector case",
      responsible: "Platform team",
      sections: [{ id: "environment", text: "Ceiling", source: "Spec · §2" }],
      functions: [{ name: "Detect smoke", lifecyclePhases: ["operation"] }],
      sourceBindings: [{ repoUrl: "https://git.example.com/fw.git", refType: "tag", refLabel: "v1.2", commit: "abc" }],
      origin: { repoUrl: "https://git.example.com/sd.git", path: "sd.tara.json", tag: "sd/v1", commit: "a", importedAt: "t" },
      methodologyMatches: true,
      instances: [{ id: "i1", prefix: "SD1", quantity: 1, assumptionsTotal: 1, assumptionsDecided: 0, assumptionsNotFulfilled: 0 }],
    });
    expect(item.aboutMissing).toBeUndefined();
  });

  it("an import taken before the overview crossed says so", () => {
    expect(componentOverviewItems(withAbout(undefined))[0].aboutMissing).toBe(true);
  });

  it("deleting instances (6d): one of two keeps the entry with one instance, the last removes it", () => {
    const p = withAbout({});
    const first = p.components!.instances[0];
    const second = { ...first, id: "i-second", prefix: "SD2", multiprocessTfId: "mp-second" };
    const two: Project = { ...p, components: { ...p.components!, instances: [first, second] }, dfd: { ...p.dfd!, elements: [{ id: first.multiprocessTfId }, { id: second.multiprocessTfId }] as never } };
    expect(componentOverviewItems(two)[0].instances.map((i) => i.prefix)).toEqual([first.prefix, "SD2"]);
    // one of two deleted
    const one = pruneDeletedInstances(two, [{ id: first.multiprocessTfId }]);
    const afterOne: Project = { ...two, components: one.components, dfd: { ...two.dfd!, elements: [{ id: first.multiprocessTfId }] as never } };
    const items = componentOverviewItems(afterOne);
    expect(items).toHaveLength(1);
    expect(items[0].instances.map((i) => i.prefix)).toEqual([first.prefix]);
    // the last deleted
    const none = pruneDeletedInstances(afterOne, []);
    expect(componentOverviewItems({ ...afterOne, components: none.components, dfd: { ...afterOne.dfd!, elements: [] } })).toEqual([]);
  });

  it("assumption decisions per instance; no imports → no items", () => {
    const p = withAbout({});
    p.components!.instances[0].assumptions = [{ instanceId: "i1", assumptionId: "a1", status: "not_fulfilled" }];
    expect(componentOverviewItems(p)[0].instances[0]).toMatchObject({ assumptionsDecided: 1, assumptionsNotFulfilled: 1 });
    expect(componentOverviewItems({ components: undefined, risks: null })).toEqual([]);
  });
});
