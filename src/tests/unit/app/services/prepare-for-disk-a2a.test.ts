// src/tests/unit/app/services/prepare-for-disk-a2a.test.ts
//
// A2A relations on disk (schema v8, AR-9): deterministic order, empty list
// not written, canonical serialisation stays idempotent.

import { describe, it, expect } from "vitest";
import { prepareForDisk, serialiseProject } from "app/services/prepare-for-disk";
import { canonicalStringify } from "app/services/tcs-serialize";
import type { Project } from "app/models/project-types";

function project(relations?: unknown[]): Project {
  return {
    id: "p",
    schemaVersion: 8,
    info: { name: "t" },
    assets: {
      assets: [],
      configuration: { impactCriteria: [] },
      ...(relations !== undefined ? { relations } : {}),
      lastModified: "2026-10-03T00:00:00.000Z",
    },
    dfd: null,
  } as unknown as Project;
}

const r = (id: string, s: string, t: string, type: string) => ({
  id,
  sourceAssetId: s,
  targetAssetId: t,
  relationType: type,
});

describe("prepareForDisk — assets.relations", () => {
  it("writes relations in source/target/type/id order", () => {
    const onDisk = prepareForDisk(
      project([r("2", "b", "c", "calls"), r("1", "a", "c", "calls"), r("0", "a", "b", "calls")]),
    );
    expect(onDisk.assets!.relations!.map((x) => x.id)).toEqual(["0", "1", "2"]);
  });

  it("does not write an empty list and leaves projects without relations unchanged", () => {
    expect("relations" in prepareForDisk(project([])).assets!).toBe(false);
    expect("relations" in prepareForDisk(project()).assets!).toBe(false);
  });

  it("serialisation is independent of input order and idempotent", () => {
    const a = serialiseProject(project([r("1", "a", "b", "calls"), r("2", "b", "c", "calls")]));
    const b = serialiseProject(project([r("2", "b", "c", "calls"), r("1", "a", "b", "calls")]));
    expect(a).toBe(b);
    expect(canonicalStringify(JSON.parse(a))).toBe(a);
  });
});
