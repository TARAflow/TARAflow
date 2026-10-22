// src/tests/unit/app/services/migrate_8_to_9.test.ts
//
// Schema v9: version fence for leveled DFDs (leveled-dfd-multi-diagram-
// design.md §11.2). The step only bumps the version.

import { describe, it, expect } from "vitest";
import { migrate_8_to_9 } from "app/services/versions/migrate-8-to-9";

describe("migrate_8_to_9", () => {
  it("bumps the version and changes no data", () => {
    const v8 = {
      schemaVersion: 8,
      dfd: { elements: [{ id: "P-1" }], connections: [], assets: [] },
    };
    const out = migrate_8_to_9(v8);
    expect(out).toEqual({ ...v8, schemaVersion: 9 });
    expect("pages" in out.dfd).toBe(false);
  });

  it("keeps dfd.pages of a leveled project", () => {
    const pages = [{ pageId: "top", name: "Top", order: 0 }];
    const out = migrate_8_to_9({ schemaVersion: 8, dfd: { pages } });
    expect(out.dfd.pages).toEqual(pages);
  });

  it("is idempotent", () => {
    const once = migrate_8_to_9({ schemaVersion: 8, dfd: {} });
    expect(migrate_8_to_9(once)).toEqual(once);
  });
});
