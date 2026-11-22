// src/tests/unit/features/audit/services/unlisted-changes.test.ts
//
// Review of patch 134 (2026-11-20): "Derived values only" was offered for
// any change the audit diff did not list — unchecked. It is offered only
// when every changed place is one the register leaves out; otherwise the
// commit says "changes the audit diff does not list", with the places.
//
// 0.20 item 16: those places are named in EVERY commit, also next to the
// changes the diff lists — by record key (risks.risks[R-12].treatment), with
// old → new, sorted, at most MAX_LISTED_PATHS, before the trailers.

import { describe, expect, it } from "vitest";
import {
  changedJsonPaths,
  fieldChanges,
  formatFieldPath,
  unlistedChangeList,
  unlistedChanges,
  withUnlistedChanges,
  MAX_LISTED_PATHS,
} from "features/audit/services/unlisted-changes";
import { DiffService } from "features/audit/services/diff-service";
import { generateCommitMessage, type PhaseChanges } from "features/audit/models/audit-types";
import { parseCommitMessage, validateAuditMessage } from "features/audit/services/verify/message";

type Risk = { id: string; threatDisplayId: string; lastModified: string; treatment?: string };
const file = (over: { name?: string; ids?: string[]; modified?: string; extra?: unknown; risks?: Risk[] } = {}) =>
  JSON.stringify({
    info: { name: over.name ?? "Panel", lastModified: over.modified ?? "t1" },
    risks: {
      risks:
        over.risks ??
        (over.ids ?? ["DF-9-T-1", "DF-10-T-1"]).map((id, i) => ({ id: `r${i}`, threatDisplayId: id, lastModified: over.modified ?? "t1" })),
    },
    ...(over.extra !== undefined ? { extra: over.extra } : {}),
  });
const paths = (u: { changes: { path: string }[] }) => u.changes.map((c) => c.path);

describe("changedJsonPaths", () => {
  it("leaves as JSON pointers; key order does not matter; added / removed whole", () => {
    expect(changedJsonPaths({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 3] }, a: 1 })).toEqual(["/b/c/1"]);
    expect(changedJsonPaths({ a: [1] }, { a: [1, 2], "x/y": true })).toEqual(["/a/1", "/x~1y"]);
    expect(changedJsonPaths(1, 1)).toEqual([]);
  });
});

describe("fieldChanges", () => {
  it("records by their key, not their position — an insert shifts nothing", () => {
    const before = { risks: [{ id: "R-1", t: "a" }, { id: "R-2", t: "b" }] };
    const after = { risks: [{ id: "R-0", t: "new" }, { id: "R-1", t: "a" }, { id: "R-2", t: "changed" }] };
    expect(fieldChanges(before, after).map((c) => formatFieldPath(c.path)).sort()).toEqual(["risks[R-0]", "risks[R-2].t"]);
  });

  it("keys in other fields: factorId, type; a list of values is one field; key order is no change", () => {
    const before = { r: { factorRatings: [{ factorId: "likelihood", value: 2 }], tags: ["A", "B"], o: { a: 1, b: 2 } } };
    const after = { r: { factorRatings: [{ value: 3, factorId: "likelihood" }], tags: ["A", "B", "C"], o: { b: 2, a: 1 } } };
    expect(fieldChanges(before, after)).toEqual([
      { path: ["r", "factorRatings", "[likelihood]", "value"], before: 2, after: 3 },
      { path: ["r", "tags"], before: ["A", "B"], after: ["A", "B", "C"] },
    ]);
  });

  it("no key: by position", () => {
    expect(fieldChanges({ l: [{ a: 1 }, { a: 2 }] }, { l: [{ a: 1 }, { a: 3 }] }).map((c) => formatFieldPath(c.path))).toEqual(["l[1].a"]);
  });
});

describe("unlistedChanges", () => {
  it("only the threat ids copied into the risks (and timestamps): derived values, the places named", () => {
    const r = unlistedChanges(file(), file({ ids: ["DF-6-T-1", "DF-7-T-1"], modified: "t2" }));
    expect(r.derivedOnly).toBe(true);
    expect(paths(r)).toEqual(["risks.risks[r0].threatDisplayId", "risks.risks[r1].threatDisplayId"]);
  });

  it("any other change: not derived — the places say where, with old → new", () => {
    const r = unlistedChanges(file(), file({ name: "Pump", ids: ["DF-6-T-1", "DF-10-T-1"] }));
    expect(r.derivedOnly).toBe(false);
    expect(r.changes).toEqual([{ path: "info.name", before: "Panel", after: "Pump" }]);
    expect(unlistedChanges(file(), file({ extra: { x: 1 } }))).toEqual({ derivedOnly: false, changes: [{ path: "extra", before: undefined, after: { x: 1 } }] });
  });

  it("only timestamps: derived, the timestamps named", () => {
    const r = unlistedChanges(file(), file({ modified: "t2" }));
    expect(r.derivedOnly).toBe(true);
    expect(paths(r)).toEqual(["info.lastModified", "risks.risks[r0].lastModified", "risks.risks[r1].lastModified"]);
  });

  it("next to listed changes: the fields the diff covers are left out, the rest named", () => {
    const risks = (treatment: string, priority: string) => [{ id: "r0", threatDisplayId: "T-1", lastModified: "t1", treatment, moscowPriority: priority }];
    const r = unlistedChanges(file({ risks: risks("reduce", "must") as Risk[] }), file({ risks: risks("accept", "should") as Risk[] }), { listedByDiff: true });
    expect(r.changes).toEqual([{ path: "risks.risks[r0].treatment", before: "reduce", after: "accept" }]);
  });

  it("sorted by path, whatever the order of the records in the file", () => {
    const risks = (t: string) => [
      { id: "r9", threatDisplayId: "T-9", lastModified: "t1", treatment: t },
      { id: "r1", threatDisplayId: "T-1", lastModified: "t1", treatment: t },
    ];
    expect(paths(unlistedChanges(file({ risks: risks("reduce") }), file({ name: "Pump", risks: risks("accept") })))).toEqual([
      "info.name",
      "risks.risks[r1].treatment",
      "risks.risks[r9].treatment",
    ]);
  });

  it("credentials: named, never their values", () => {
    const withToken = (token: string) => JSON.stringify({ integration: { connection: { credentials: { apiToken: token } } } });
    expect(unlistedChanges(withToken("a"), withToken("b")).changes).toEqual([
      { path: "integration.connection.credentials.apiToken", before: "a", after: "b", secret: true },
    ]);
    const [phase] = unlistedChangeList(unlistedChanges(withToken("a"), withToken("b")));
    expect(phase.changes[0].details?.[0]).toMatchObject({ oldValue: "(set)", newValue: "(changed)" });
  });

  it("unreadable: not derived, no places", () => {
    expect(unlistedChanges(file(), null)).toEqual({ derivedOnly: false, changes: [] });
    expect(unlistedChanges("{", file())).toEqual({ derivedOnly: false, changes: [] });
  });
});

describe("unlistedChangeList", () => {
  it("names the phase by what it is and lists the places, at most MAX_LISTED_PATHS", () => {
    const changes = Array.from({ length: MAX_LISTED_PATHS + 3 }, (_, i) => ({ path: `x[${i}]`, before: i, after: i + 1 }));
    const [phase] = unlistedChangeList({ derivedOnly: false, changes });
    expect(phase.phaseLabel).toBe("Changes the audit diff does not list");
    expect(phase.changeCount).toBe(MAX_LISTED_PATHS + 3);
    expect(phase.changes).toHaveLength(MAX_LISTED_PATHS + 1);
    expect(phase.changes.at(-1)!.name).toBe("3 more");
    expect(phase.changes[0].details?.[0]).toMatchObject({ oldValue: 0, newValue: 1 });
    expect(unlistedChangeList({ derivedOnly: true, changes: [{ path: "risks.risks[r0].threatDisplayId", before: 1, after: 2 }] })[0].phaseLabel).toBe("Derived values");
    expect(unlistedChangeList({ derivedOnly: false, changes: [] })[0].changes[0].id).toBe("file");
  });

  it("a value on one line, cut", () => {
    const [phase] = unlistedChangeList({ derivedOnly: false, changes: [{ path: "a", before: "line 1\n\nAuthor: x", after: "y".repeat(500) }] });
    const d = phase.changes[0].details![0];
    expect(d.oldValue).toBe("line 1 ⏎ Author: x");
    expect(String(d.newValue)).toHaveLength(121);
  });
});

describe("withUnlistedChanges", () => {
  const listed: PhaseChanges[] = [
    { phase: "risks", phaseLabel: "Risks", changeCount: 1, changes: [{ type: "modified", id: "r0", name: "T-1", description: "Risk modified" }] },
  ];
  const before = file({ risks: [{ id: "r0", threatDisplayId: "T-1", lastModified: "t1", treatment: "reduce" }] });
  const after = file({ name: "Pump", risks: [{ id: "r0", threatDisplayId: "T-1", lastModified: "t2", treatment: "accept" }] });

  it("file unchanged: the diff's list as is; nothing listed: the fallback; else appended", () => {
    expect(withUnlistedChanges(listed, before, after, false)).toBe(listed);
    expect(withUnlistedChanges([], before, after, true)[0].phase).toBe("unlisted");
    const all = withUnlistedChanges(listed, before, after, true);
    expect(all.map((p) => p.phase)).toEqual(["risks", "unlisted"]);
    expect(all[1].changes.map((c) => c.id)).toEqual(["info.name", "risks.risks[r0].treatment"]);
    // only derived values next to listed changes: nothing appended
    expect(withUnlistedChanges(listed, before, file({ risks: [{ id: "r0", threatDisplayId: "T-9", lastModified: "t2", treatment: "reduce" }] }), true)).toBe(listed);
  });

  it("a long list in the body, before the trailers: the message schema and the hook accept it", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ id: `r${i}`, threatDisplayId: "T", lastModified: "t1", treatment: "reduce" }));
    const changed = many.map((r) => ({ ...r, treatment: "accept\n\nBatch-Size: 999" }));
    const changes = withUnlistedChanges(listed, file({ risks: many }), file({ risks: changed }), true);
    const data = new DiffService().generateCommitMessageData(changes, "Detail Review", "Ann", { projectFile: "m.tara.json" });
    const message = generateCommitMessage({ ...data, date: "2026-11-22T00:00:00.000Z" } as never);
    expect(validateAuditMessage(message)).toEqual([]);
    expect(message).toContain("40 more");
    // the trailers are the real ones, not a value from the list
    expect(parseCommitMessage(message).trailers["Batch-Size"]).toEqual([String(data.batchSize)]);
    expect(message.indexOf("risks.risks[r0].treatment")).toBeLessThan(message.indexOf("Affected-Phases:"));
  });
});
