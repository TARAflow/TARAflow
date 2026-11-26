// The results dump (scripts/results-dump, roadmap-to-1.0.md rule 3.1) is the
// reference later releases are compared with — it must be byte-stable: the
// same file gives the same dump, whatever the key order of the input, the
// random ids or the clock of the run.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dumpProject, stringifyDump, type DumpHeader } from "../../../../scripts/results-dump/core";
import { diffDumps } from "../../../../scripts/results-dump/diff";

const FIXTURE = join(__dirname, "../../fixtures/Simple_Test_Project.tara.json");
const raw = JSON.parse(readFileSync(FIXTURE, "utf-8"));
const header: DumpHeader = {
  taraflowVersion: "test",
  taraflowCommit: "test",
  inputFile: "Simple_Test_Project.tara.json",
  inputSha256: "0",
};

/** The same JSON with every object's keys in reverse order. */
function reversedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversedKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .reverse()
        .map((k) => [k, reversedKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("results dump", () => {
  const first = stringifyDump(dumpProject(raw, header));

  it("dumps threats of both methods, risks and the matrices of the active standards", () => {
    const dump = JSON.parse(first);
    expect(dump.threats.methods["per-element"].count).toBeGreaterThan(0);
    expect(dump.threats.methods["per-interaction"].count).toBeGreaterThan(0);
    expect(dump.risks.count).toBeGreaterThan(0);
    expect(Object.keys(dump.compliance).length).toBeGreaterThan(0);
    // no random threat id, no clock
    expect(first).not.toMatch(/"(created|lastModified)":/);
  });

  it("is byte-stable across runs, input key order, random ids and the clock", () => {
    vi.useFakeTimers({ now: new Date("2031-01-01T00:00:00Z") });
    let n = 0;
    vi.spyOn(crypto, "randomUUID").mockImplementation(
      () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`,
    );
    expect(stringifyDump(dumpProject(reversedKeys(raw), header))).toBe(first);
  });

  it("does not change its input", () => {
    const copy = structuredClone(raw);
    dumpProject(copy, header);
    expect(copy).toEqual(raw);
  });
});

describe("diffDumps", () => {
  it("lists added, removed and changed leaves; the header is not compared", () => {
    const before = { header: { commit: "a" }, risks: { r1: { risk: 4 }, r2: { risk: 1 } }, tags: ["x", "y"] };
    const after = { header: { commit: "b" }, risks: { r1: { risk: 6 }, r3: { risk: 2 } }, tags: ["y", "z"] };
    expect(diffDumps(before, after)).toEqual([
      "~ risks.r1.risk: 4 → 6",
      "- risks.r2",
      "+ risks.r3",
      '~ tags: -["x"] +["z"]',
    ]);
    expect(diffDumps(before, before)).toEqual([]);
  });
});
