// ISO/SAE 21434 conformance plan 0c — calculation stamps through the real
// open / write / save path (parseAndRepair → commitLoadedProject →
// mergeProjectPatch → serialiseProject) on the ISO fixture cnc-ref.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseAndRepair } from "app/services/migration-service";
import {
  commitLoadedProject,
  mergeProjectPatch,
} from "app/services/project-commit";
import { serialiseProject } from "app/services/prepare-for-disk";
import type { Project } from "app/models/project-types";

const open = (text: string): Project => {
  const parsed = parseAndRepair(JSON.parse(text));
  if (!parsed) throw new Error("fixture could not be parsed");
  return commitLoadedProject(parsed);
};

const FIXTURE = readFileSync(
  join(process.cwd(), "src/tests/fixtures/cnc-ref.tara.json"),
  "utf-8",
);

describe("ISO calculation stamps — open, edit, save", () => {
  it("opening and saving an ISO project writes no stamp; schema is 10", () => {
    const saved = serialiseProject(open(FIXTURE));
    expect(saved).not.toContain("calcStamp");
    expect(JSON.parse(saved).schemaVersion).toBe(10);
  });

  it("open → save → open → save is byte-identical", () => {
    const once = serialiseProject(open(FIXTURE));
    expect(serialiseProject(open(once))).toBe(once);
  });

  it("changing one risk stamps only that risk", () => {
    const p = open(FIXTURE);
    const risks = p.risks!.risks;
    expect(risks.length).toBeGreaterThan(1);
    const changed = {
      ...risks[0],
      calculatedRiskBeforeMitigation: risks[0].calculatedRiskBeforeMitigation + 1,
    };
    const next = mergeProjectPatch(
      p,
      { id: p.id, risks: { ...p.risks!, risks: [changed, ...risks.slice(1)] } },
      "2026-10-24T00:00:00.000Z",
    );
    const stamped = next.risks!.risks.filter((r) => r.calcStamp);
    expect(stamped.map((r) => r.id)).toEqual([risks[0].id]);
    expect(stamped[0].calcStamp!.method).toBe("iso-21434");
  });
});
