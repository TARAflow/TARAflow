// src/tests/unit/features/audit/services/unlisted-changes.test.ts
//
// Review of patch 134 (2026-11-20): "Derived values only" was offered for
// any change the audit diff did not list — unchecked. It is offered only
// when every changed place is a known derived value; otherwise the commit
// says "changes the audit diff does not list", with the places.

import { describe, expect, it } from "vitest";
import { changedJsonPaths, unlistedChangeList, unlistedChanges, MAX_LISTED_PATHS } from "features/audit/services/unlisted-changes";

const file = (over: { name?: string; ids?: string[]; modified?: string; extra?: unknown } = {}) =>
  JSON.stringify({
    info: { name: over.name ?? "Panel", lastModified: over.modified ?? "t1" },
    risks: { risks: (over.ids ?? ["DF-9-T-1", "DF-10-T-1"]).map((id, i) => ({ id: `r${i}`, threatDisplayId: id, lastModified: over.modified ?? "t1" })) },
    ...(over.extra !== undefined ? { extra: over.extra } : {}),
  });

describe("changedJsonPaths", () => {
  it("leaves as JSON pointers; key order does not matter; added / removed whole", () => {
    expect(changedJsonPaths({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 3] }, a: 1 })).toEqual(["/b/c/1"]);
    expect(changedJsonPaths({ a: [1] }, { a: [1, 2], "x/y": true })).toEqual(["/a/1", "/x~1y"]);
    expect(changedJsonPaths(1, 1)).toEqual([]);
  });
});

describe("unlistedChanges", () => {
  it("only the threat ids copied into the risks (and timestamps): derived values, the places named", () => {
    const r = unlistedChanges(file(), file({ ids: ["DF-6-T-1", "DF-7-T-1"], modified: "t2" }));
    expect(r).toEqual({ derivedOnly: true, paths: ["/risks/risks/0/threatDisplayId", "/risks/risks/1/threatDisplayId"] });
  });

  it("any other change: not derived — the places say where", () => {
    const r = unlistedChanges(file(), file({ name: "Pump", ids: ["DF-6-T-1", "DF-10-T-1"] }));
    expect(r.derivedOnly).toBe(false);
    expect(r.paths).toEqual(["/info/name", "/risks/risks/0/threatDisplayId"]);
    expect(unlistedChanges(file(), file({ extra: { x: 1 } }))).toEqual({ derivedOnly: false, paths: ["/extra"] });
  });

  it("only timestamps: derived, the timestamps named", () => {
    expect(unlistedChanges(file(), file({ modified: "t2" }))).toEqual({
      derivedOnly: true,
      paths: ["/info/lastModified", "/risks/risks/0/lastModified", "/risks/risks/1/lastModified"],
    });
  });

  it("unreadable: not derived, no places", () => {
    expect(unlistedChanges(file(), null)).toEqual({ derivedOnly: false, paths: [] });
    expect(unlistedChanges("{", file())).toEqual({ derivedOnly: false, paths: [] });
  });
});

describe("unlistedChangeList", () => {
  it("names the phase by what it is and lists the places, at most MAX_LISTED_PATHS", () => {
    const paths = Array.from({ length: MAX_LISTED_PATHS + 3 }, (_, i) => `/x/${i}`);
    const [phase] = unlistedChangeList({ derivedOnly: false, paths });
    expect(phase.phaseLabel).toBe("Changes the audit diff does not list");
    expect(phase.changeCount).toBe(MAX_LISTED_PATHS + 3);
    expect(phase.changes).toHaveLength(MAX_LISTED_PATHS + 1);
    expect(phase.changes.at(-1)!.name).toBe("3 more");
    expect(unlistedChangeList({ derivedOnly: true, paths: ["/risks/risks/0/threatDisplayId"] })[0].phaseLabel).toBe("Derived values");
    expect(unlistedChangeList({ derivedOnly: false, paths: [] })[0].changes[0].id).toBe("file");
  });
});
