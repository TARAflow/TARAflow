// tests/fixtures/load-fixture.ts
//
// Loads real .tara.json project files as Project objects for golden tests.
// ESM-safe (uses import.meta.url, not __dirname) so it works under Vitest's
// default ESM transform.
//
// SETUP: copy the three fixtures next to this file:
//   src/tests/fixtures/SmokeDetector_tara.json
//   src/tests/fixtures/Simple_Test_Project_tara.json
//   src/tests/fixtures/cnc-ref_tara.json

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Project } from "app/models/project-types"; // ⚠ adjust alias if your Project type lives elsewhere

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));

export function loadProjectFixture(file: string): Project {
  const raw = readFileSync(join(FIXTURE_DIR, file), "utf-8");
  return JSON.parse(raw) as Project;
}

export const FIXTURES = {
  /** Rich: 19 assets, 102 hazard relations (101 endangers / 1 contributes_to), 4 manual-fatality assets. */
  smokeDetector: "SmokeDetector.tara.json",
  /** Empty: assets = null, dfd.assets = []. Edge case. */
  simpleTest: "Simple_Test_Project.tara.json",
  /** Small + migrated (_migrated): 4 assets, 3 hazard relations. */
  cncRef: "cnc-ref.tara.json",
} as const;
