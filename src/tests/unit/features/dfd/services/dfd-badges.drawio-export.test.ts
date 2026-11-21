// The EL badges and the safety-zone frame are display only (0.20 patches 23 /
// 33). The fixture is draw.io's own export of Simple_Test_Project with the
// marks on (TARAflow_Examples/SimpleProject.drawio.xml, 2026-11-21): its
// form — cells on their own indented lines, attributes sorted, x / y of the
// frame left out — is what the app saves. Stripping it gives back the
// diagram without the marks, byte for byte, and no write path stores them.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripDfdBadges } from "features/dfd/services/dfd-badges";
import { serialiseProject } from "app/services/prepare-for-disk";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";

const EXPORT = readFileSync(join(__dirname, "../../../../fixtures/drawio-export-badges.xml"), "utf-8");

/** The expectation, computed independently: drop the lines of every badge / frame object. */
function withoutMarkLines(xml: string): string {
  const out: string[] = [];
  let skipping = false;
  for (const line of xml.split("\n")) {
    if (!skipping && /<object\b[^>]*\stype="(elbadge|elzone)"/.test(line)) skipping = !line.includes("</object>");
    else if (skipping) {
      if (line.includes("</object>")) skipping = false;
    } else out.push(line);
  }
  return out.join("\n");
}

describe("draw.io's own export with badges", () => {
  it("holds the marks (5 badges, 1 frame)", () => {
    expect((EXPORT.match(/type="elbadge"/g) ?? []).length).toBe(5);
    expect((EXPORT.match(/type="elzone"/g) ?? []).length).toBe(1);
  });

  it("strip gives the diagram without them, byte for byte; a second strip changes nothing", () => {
    const stripped = stripDfdBadges(EXPORT);
    expect(stripped).toBe(withoutMarkLines(EXPORT));
    expect(stripped).not.toMatch(/elbadge|elzone/);
    expect(stripDfdBadges(stripped)).toBe(stripped);
  });
});

describe("no write path stores the marks (prepareForDisk, review 2026-11-21)", () => {
  it("a project whose diagram holds badges is serialised without them", () => {
    const project = parseAndRepair(loadProjectFixture("Simple_Test_Project.tara.json"))!;
    const withMarks = { ...project, dfd: { ...project.dfd!, xml: EXPORT } };
    const text = serialiseProject(withMarks);
    expect(text).not.toMatch(/elbadge|elzone/);
  });

  it("a clean project: written as before (the diagram unchanged)", () => {
    const project = parseAndRepair(loadProjectFixture("Simple_Test_Project.tara.json"))!;
    expect(JSON.parse(serialiseProject(project)).dfd.xml).toBe(project.dfd!.xml);
  });
});
