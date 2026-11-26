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
  withoutSecrets,
  MAX_LISTED_PATHS,
} from "features/audit/services/unlisted-changes";
import { DiffService } from "features/audit/services/diff-service";
import { generateCommitMessage, type PhaseChanges } from "features/audit/models/audit-types";
import { parseCommitMessage, validateAuditMessage } from "features/audit/services/verify/message";

// `note`: a field no comparison of the DiffService covers (treatment and the
// justifications are its own lines since the D4 follow-up)
type Risk = { id: string; threatDisplayId: string; lastModified: string; note?: string };
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
    // renumbered: the label itself changed, so the risk keeps its key
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
    expect(paths(r)).toEqual(["info.lastModified", "risks.risks[R-DF-10-T-1].lastModified", "risks.risks[R-DF-9-T-1].lastModified"]);
  });

  it("next to listed changes: the fields the diff covers are left out, the rest named", () => {
    const risks = (note: string, treatment: string) => [{ id: "r0", threatDisplayId: "T-1", lastModified: "t1", note, treatment }];
    const r = unlistedChanges(file({ risks: risks("a", "reduce") as Risk[] }), file({ risks: risks("b", "accept") as Risk[] }), { listedByDiff: true });
    // the treatment is the DiffService's own line now (0.20 manual test D4)
    expect(r.changes).toEqual([{ path: "risks.risks[R-T-1].note", before: "a", after: "b" }]);
  });

  it("sorted by path, whatever the order of the records in the file", () => {
    const risks = (t: string) => [
      { id: "r9", threatDisplayId: "T-9", lastModified: "t1", note: t },
      { id: "r1", threatDisplayId: "T-1", lastModified: "t1", note: t },
    ];
    expect(paths(unlistedChanges(file({ risks: risks("a") }), file({ name: "Pump", risks: risks("b") })))).toEqual([
      "info.name",
      "risks.risks[R-T-1].note",
      "risks.risks[R-T-9].note",
    ]);
  });

  // 0.20 manual test D4: "threats.perElement[00c8f01d-…]" did not say which threat
  it("a record by its display id; its key where none or where two share one", () => {
    const threats = (cause: string) =>
      JSON.stringify({
        threats: {
          perElementTables: [
            { threats: [{ id: "00c8f01d", displayId: "DB-E-1", causeDescription: cause }, { id: "x1", causeDescription: cause }] },
          ],
        },
      });
    expect(paths(unlistedChanges(threats("a"), threats("b")))).toEqual([
      "threats.perElement[DB-E-1].causeDescription",
      "threats.perElement[x1].causeDescription",
    ]);
  });

  // 0.20 manual test D3 (2026-11-25): moving a trust boundary re-derived the
  // threats' asset links from the DFD — 18 lines under "does not list".
  it("a threat's asset links are derived from the DFD: not named", () => {
    const withLinks = (ids: string[]) =>
      JSON.stringify({ threats: { perInteractionTables: [{ threats: [{ id: "t1", linkedAssetIds: ids }] }] } });
    const r = unlistedChanges(withLinks(["a1"]), withLinks(["a1", "a2"]), { listedByDiff: true });
    expect(r.derivedOnly).toBe(true);
    expect(unlistedChanges(withLinks(["a1"]), withLinks(["a1", "a2"])).changes.map((c) => c.notAudited)).toEqual(["derived"]);
  });

  // user, 0.20 manual test D5 (2026-11-26): the active method only says which
  // threats the tabs show — both methods' threats are compared and reported
  it("switching the method the tabs show: presentation, not named", () => {
    const method = (m: string) =>
      JSON.stringify({ threats: { configuration: { activeMethod: m } }, risks: { configuration: { activeStrideMethod: m }, risks: [] } });
    const r = unlistedChanges(method("per-element"), method("per-interaction"));
    expect(r.derivedOnly).toBe(true);
    expect(r.changes.map((c) => [c.path, c.notAudited])).toEqual([
      ["risks.configuration.activeStrideMethod", "presentation"],
      ["threats.configuration.activeMethod", "presentation"],
    ]);
  });

  // 0.20 manual test D7 (2026-11-26): disconnecting the tracker removes the
  // whole integration — its credentials block went into the commit as JSON.
  it("a change above the credentials: the value shown without them", () => {
    const connected = JSON.stringify({
      integration: { connection: { tool: "jira", credentials: { baseUrl: "https://tenant.example.net/", projectKey: "K" } } },
    });
    const r = unlistedChanges(connected, JSON.stringify({}));
    expect(r.changes).toEqual([{ path: "integration", before: { connection: { tool: "jira", credentials: "(set)" } }, after: undefined }]);
    const [phase] = unlistedChangeList(r);
    expect(JSON.stringify(phase)).not.toMatch(/tenant|projectKey/);
    expect(withoutSecrets(["audit"], { config: { auth: { method: "ssh" }, provider: "github" } })).toEqual({ config: { auth: "(set)", provider: "github" } });
  });

  it("credentials: named, never their values", () => {
    const withToken = (token: string) => JSON.stringify({ integration: { connection: { credentials: { apiToken: token } } } });
    expect(unlistedChanges(withToken("a"), withToken("b")).changes).toEqual([
      { path: "integration.connection.credentials.apiToken", before: "(set)", after: "(set)", secret: true },
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
  const before = file({ risks: [{ id: "r0", threatDisplayId: "T-1", lastModified: "t1", note: "a" }] });
  const after = file({ name: "Pump", risks: [{ id: "r0", threatDisplayId: "T-1", lastModified: "t2", note: "b" }] });

  it("file unchanged: the diff's list as is; nothing listed: the fallback; else appended", () => {
    expect(withUnlistedChanges(listed, before, after, false)).toBe(listed);
    expect(withUnlistedChanges([], before, after, true)[0].phase).toBe("unlisted");
    const all = withUnlistedChanges(listed, before, after, true);
    expect(all.map((p) => p.phase)).toEqual(["risks", "unlisted"]);
    expect(all[1].changes.map((c) => c.id)).toEqual(["info.name", "risks.risks[R-T-1].note"]);
    // only derived values next to listed changes: nothing appended
    expect(withUnlistedChanges(listed, before, file({ risks: [{ id: "r0", threatDisplayId: "T-9", lastModified: "t2", note: "a" }] }), true)).toBe(listed);
  });

  it("a long list in the body, before the trailers: the message schema and the hook accept it", () => {
    // one threat display id for all: two records share a label, so the keys stay
    const many = Array.from({ length: 60 }, (_, i) => ({ id: `r${i}`, threatDisplayId: "T", lastModified: "t1", note: "a" }));
    const changed = many.map((r) => ({ ...r, note: "b\n\nBatch-Size: 999" }));
    const changes = withUnlistedChanges(listed, file({ risks: many }), file({ risks: changed }), true);
    const data = new DiffService().generateCommitMessageData(changes, "Detail Review", "Ann", { projectFile: "m.tara.json" });
    const message = generateCommitMessage({ ...data, date: "2026-11-22T00:00:00.000Z" } as never);
    expect(validateAuditMessage(message)).toEqual([]);
    expect(message).toContain("40 more");
    // the trailers are the real ones, not a value from the list
    expect(parseCommitMessage(message).trailers["Batch-Size"]).toEqual([String(data.batchSize)]);
    expect(message.indexOf("risks.risks[r0].note")).toBeLessThan(message.indexOf("Affected-Phases:"));
  });
});
