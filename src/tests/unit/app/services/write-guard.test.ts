// src/tests/unit/app/services/write-guard.test.ts
//
// Manual test 2026-11-17: a write that changes only timestamps is skipped
// (no dirty repository after opening a project or after an Audit commit).

import { describe, expect, it } from "vitest";
import { sameButTimestamps } from "app/services/write-guard";

const file = (info: string, dfd: string, validated: string, name = "Panel") =>
  `{\n  "dfd": {\n    "lastModified": "${dfd}",\n    "validation": {\n      "lastValidated": "${validated}"\n    }\n  },\n  "info": {\n    "lastModified": "${info}",\n    "name": "${name}"\n  }\n}\n`;

describe("sameButTimestamps", () => {
  it("only lastModified / lastValidated differ → the same file", () => {
    expect(sameButTimestamps(file("2026-11-17T15:00:00Z", "a", "b"), file("2026-11-17T16:00:00Z", "c", "d"))).toBe(true);
  });

  it("the same text → the same file", () => {
    const f = file("x", "y", "z");
    expect(sameButTimestamps(f, f)).toBe(true);
  });

  it("any other change → a different file", () => {
    expect(sameButTimestamps(file("x", "y", "z"), file("x", "y", "z", "Pump"))).toBe(false);
  });

  it("no file on disk (or unreadable) → write", () => {
    expect(sameButTimestamps(null, file("x", "y", "z"))).toBe(false);
    expect(sameButTimestamps(undefined, file("x", "y", "z"))).toBe(false);
  });

  it("a field that only contains the word is not masked", () => {
    const a = `{\n  "note": "lastModified"\n}`;
    const b = `{\n  "note": "lastValidated"\n}`;
    expect(sameButTimestamps(a, b)).toBe(false);
  });
});
