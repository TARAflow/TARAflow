// ISO/SAE 21434 conformance plan 3a-1 — migration 9 → 10 on the Headlamp
// example (src/tests/fixtures/headlamp-iso21434.tara.json: assets, risks and
// attack trees of the TARAflow example, schema 9, values as stored before
// 0.15.0-beta). Open → migrate → isoRisk per risk, stamped; safety names
// normalised; a v9 safety rating 3 stays 3; nothing else changes.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseAndRepair } from "app/services/migration-service";
import { commitLoadedProject } from "app/services/project-commit";
import { serialiseProject } from "app/services/prepare-for-disk";
import type { Project } from "app/models/project-types";

const RAW = readFileSync(
  join(process.cwd(), "src/tests/fixtures/headlamp-iso21434.tara.json"),
  "utf-8",
);
const open = (text: string): Project => commitLoadedProject(parseAndRepair(JSON.parse(text))!);

describe("Headlamp: migration 9 → 10 (3a-1)", () => {
  const before = JSON.parse(RAW);
  const p = open(RAW);
  const byLabel = new Map(p.risks!.risks.map((r) => [r.threatDisplayId, r]));

  it("risk value 1–5 per risk with today's example data (deviates from Annex H, see plan)", () => {
    const got = Object.fromEntries(
      [...byLabel].map(([id, r]) => [id, `${r.isoRisk?.impact}×${r.isoRisk?.feasibility}=${r.isoRisk?.value}`]),
    );
    expect(got).toEqual({
      "AT-1.3": "severe×medium=4", // DA-001 I — Annex H spoofing: high (attack vector) → 5
      "AT-2.4": "severe×high=5", // DA-001 A
      "AT-3.4": "severe×high=5", // DA-001 N
      "AT-4.3": "moderate×medium=2", // DA-003 I
      "AT-5.4": "moderate×high=3", // DA-003 A — Annex H DoS: low → 2
      "AT-6.4": "major×medium=3", // FU-001 C
      "AT-7.3": "major×medium=3", // FU-001 I
      "AT-8.4": "major×high=4", // FU-001 A
      "AT-9.3": "major×low=2", // DA-002 C
      "AT-10.4": "major×very-low=1", // DA-002 I
    });
  });

  it("safety: DA-001 fatal → severe, DA-002 (3) major, DA-003 (2) / FU-001 (1) moderate", () => {
    const assets = new Map(p.assets!.assets.map((a) => [a.displayId, a]));
    expect(assets.get("DA-001")!.physicalImpact).toBe("fatal"); // was "fatality"
    const safety = (id: string) =>
      assets.get(id)!.impactRatings.find((r) => r.criterionId === "safety")!.value;
    expect([safety("DA-002"), safety("DA-003"), safety("FU-001")]).toEqual([3, 2, 1]); // 3 stays 3
  });

  it("no old safety name survives the migration", () => {
    const saved = serialiseProject(p);
    for (const old of ['"fatality"', '"irreversible_injury"', '"reversible_injury"', '"reversible_moderate"']) {
      expect(saved).not.toContain(old);
    }
    expect(RAW).toContain('"fatality"'); // the fixture really had one
  });

  it("every ISO risk is stamped; treatments, priorities, justifications unchanged", () => {
    for (const r of p.risks!.risks) {
      expect(r.calcStamp?.method).toBe("iso-21434");
      const old = before.risks.risks.find((o: { id: string }) => o.id === r.id);
      expect([r.treatment, r.moscowPriority, r.treatmentJustification]).toEqual([
        old.treatment,
        old.moscowPriority,
        old.treatmentJustification,
      ]);
    }
  });

  it("open → save → open → save is byte-identical", () => {
    const once = serialiseProject(p);
    expect(serialiseProject(open(once))).toBe(once);
  });
});
