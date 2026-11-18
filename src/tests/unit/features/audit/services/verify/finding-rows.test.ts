// src/tests/unit/features/audit/services/verify/finding-rows.test.ts
//
// Manual test 2026-11-17: the newest problem (a snapshot changed in the last
// commit) came last, after a dozen old ones; one commit with five
// non-canonical files gave five identical rows.

import { describe, expect, it } from "vitest";
import { makeFinding, type Finding } from "features/audit/services/verify/findings";
import { findingRows } from "features/audit/services/verify/finding-rows";

const f = (id: Finding["id"], commit?: string, path?: string): Finding =>
  makeFinding(id, { ...(commit ? { commit } : {}), ...(path ? { context: { path } } : {}) });

// engine order: check by check, each in history order (oldest first)
const engine: Finding[] = [
  f("SIG_UNSIGNED", "c1"),
  f("SIG_UNSIGNED", "c2"),
  f("TCS_NONREPRODUCIBLE", "c1", "a.tara.json"),
  f("TCS_NONREPRODUCIBLE", "c1", "b.tara.json"),
  f("TCS_NONREPRODUCIBLE", "c1", "b.tara.json"),
  f("CMP_SNAPSHOT_HASH_MISMATCH", "c3", "m.tara.json"),
  f("REPO_DIRTY"),
];
const newestFirst = ["c3", "c2", "c1"];

describe("findingRows", () => {
  it("per severity: newest commit first, the same rule at one commit one row with its files", () => {
    const rows = findingRows(engine, "error", newestFirst);
    expect(rows.map((r) => [r.id, r.commit, r.count, r.paths])).toEqual([
      ["CMP_SNAPSHOT_HASH_MISMATCH", "c3", 1, ["m.tara.json"]],
      ["SIG_UNSIGNED", "c2", 1, []],
      ["SIG_UNSIGNED", "c1", 1, []],
      ["TCS_NONREPRODUCIBLE", "c1", 3, ["a.tara.json", "b.tara.json"]],
    ]);
  });

  it("findings without a commit (the working tree) first", () => {
    const rows = findingRows([f("MSG_SCHEMA", "c2"), f("REPO_DIRTY")], "warning", newestFirst);
    expect(rows.map((r) => r.id)).toEqual(["REPO_DIRTY", "MSG_SCHEMA"]);
  });

  it("without the commit order: the engine's order, still merged", () => {
    const rows = findingRows(engine, "error");
    expect(rows.map((r) => [r.id, r.commit])).toEqual([
      ["SIG_UNSIGNED", "c1"],
      ["SIG_UNSIGNED", "c2"],
      ["TCS_NONREPRODUCIBLE", "c1"],
      ["CMP_SNAPSHOT_HASH_MISMATCH", "c3"],
    ]);
  });

  it("other severities are not mixed in", () => {
    expect(findingRows(engine, "info", newestFirst)).toEqual([]);
  });
});
