import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

const FORBIDDEN_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "bbv.ch email domain", pattern: /@bbv\.ch/ },
  { name: "bbv Jira workspace domain", pattern: /bbv-team-aqj7rcth/ },
  { name: "absolute /home path", pattern: /\/home\/[a-z0-9._-]+\// },
  { name: "absolute /Users path (macOS)", pattern: /\/Users\/[a-zA-Z0-9._-]+\// },
  { name: "Windows user path", pattern: /[A-Z]:\\Users\\/ },
];

function getJsonFixtures(): string[] {
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(FIXTURES_DIR, f));
}

describe("fixtures must not leak secrets or local paths", () => {
  const fixtureFiles = getJsonFixtures();

  it("finds at least one fixture file (sanity check for the test itself)", () => {
    expect(fixtureFiles.length).toBeGreaterThan(0);
  });

  for (const filePath of fixtureFiles) {
    const fileName = path.basename(filePath);

    it(`${fileName} contains no forbidden patterns`, () => {
      const content = fs.readFileSync(filePath, "utf8");

      for (const { name, pattern } of FORBIDDEN_PATTERNS) {
        expect(
          pattern.test(content),
          `Fixture "${fileName}" matched forbidden pattern: ${name}`,
        ).toBe(false);
      }
    });

    it(`${fileName} has filePath set to null (never a real path)`, () => {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if ("filePath" in parsed) {
        expect(parsed.filePath).toBeNull();
      }
    });
  }
});