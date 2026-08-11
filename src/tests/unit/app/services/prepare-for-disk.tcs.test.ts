// ==================== TCS v1 — canonical serialization tests ====================
// If you use Jest with globals, delete the next import line.
import { describe, it, expect } from "vitest";
import type { Project } from "app/models/project-types";
import {
  prepareForDisk,
  serializeTCS,
  serialiseProject,
} from "app/services/prepare-for-disk";
import { canonicalStringify } from "app/services/tcs-serialize";

// A minimal, deliberately messy project: unsorted keys, an integer-keyed map
// (phaseStatus), runtime-only fields, a derived dfd.graph, nested arrays.
function makeProject(overrides: Record<string, unknown> = {}): Project {
  return {
    schemaVersion: 7,
    id: "proj_1",
    info: {
      version: "1.0",
      name: "Demo",
      description: "d",
      lastModified: "2026-07-28T00:00:00.000Z",
      created: "2026-07-28T00:00:00.000Z",
      tags: {},
      team: [],
    },
    // integer-like keys, intentionally out of order, incl. multi-digit
    phaseStatus: { "2": "open", "10": "open", "0": "complete" },
    dfd: { nodes: [{ id: "n2" }, { id: "n1" }], graph: { huge: true } },
    risks: null,
    filePath: "/Users/secret/local/path/Demo.tara.json", // must be stripped
    hasUnsavedChanges: true, // must be stripped
    ...overrides,
  } as unknown as Project;
}

describe("TCS v1 canonical serialization", () => {
  it("is idempotent", () => {
    const p = makeProject();
    expect(serializeTCS(p)).toBe(serializeTCS(p));
  });

  it("serialiseProject is the same as serializeTCS (canonical everywhere)", () => {
    const p = makeProject();
    expect(serialiseProject(p)).toBe(serializeTCS(p));
  });

  it("strips runtime-only and derived fields", () => {
    const out = serializeTCS(makeProject());
    expect(out).not.toContain("filePath");
    expect(out).not.toContain("secret");
    expect(out).not.toContain("hasUnsavedChanges");
    expect(out).not.toContain("graph"); // dfd.graph is derived
    expect(out).not.toContain("huge");
  });

  it("is a fixpoint: re-serializing the parsed on-disk form is byte-identical", () => {
    const p = makeProject();
    const s = serializeTCS(p);
    const reparsed = JSON.parse(s); // plain on-disk object, no migration
    expect(canonicalStringify(reparsed)).toBe(s);
  });

  it("is independent of input key order", () => {
    const a = makeProject();
    const b = makeProject({
      // same content, keys inserted in a different order
      info: {
        name: "Demo",
        created: "2026-07-28T00:00:00.000Z",
        description: "d",
        version: "1.0",
        lastModified: "2026-07-28T00:00:00.000Z",
        team: [],
        tags: {},
      },
    });
    expect(serializeTCS(a)).toBe(serializeTCS(b));
  });

  it("sorts keys by code point, NOT by V8 numeric-key order", () => {
    const out = serializeTCS(makeProject());
    const i0 = out.indexOf('"0"');
    const i10 = out.indexOf('"10"');
    const i2 = out.indexOf('"2"');
    // code-point order of the strings: "0" < "10" < "2"  ('1' < '2')
    expect(i0).toBeGreaterThan(-1);
    expect(i0).toBeLessThan(i10);
    expect(i10).toBeLessThan(i2);
  });

  it("preserves array order (arrays are never blind-sorted)", () => {
    const out = serializeTCS(makeProject());
    expect(out.indexOf('"n2"')).toBeLessThan(out.indexOf('"n1"'));
  });

  it("ends with exactly one LF and contains no CR or BOM", () => {
    const out = serializeTCS(makeProject());
    expect(out.endsWith("}\n")).toBe(true);
    expect(out.endsWith("}\n\n")).toBe(false);
    expect(out.includes("\r")).toBe(false);
    expect(out.charCodeAt(0)).not.toBe(0xfeff); // no BOM
  });

  it("normalizes -0 to 0", () => {
    const out = canonicalStringify({ x: -0 });
    expect(out).toContain('"x": 0');
  });

  it("rejects non-finite numbers instead of coercing to null", () => {
    expect(() => canonicalStringify({ x: NaN })).toThrow(/non-finite/);
    expect(() => canonicalStringify({ x: Infinity })).toThrow(/non-finite/);
  });

  it("prepareForDisk stays pure (does not mutate the input)", () => {
    const p = makeProject();
    prepareForDisk(p);
    expect(p.filePath).toBe("/Users/secret/local/path/Demo.tara.json");
    expect((p.dfd as any).graph).toEqual({ huge: true });
  });
});