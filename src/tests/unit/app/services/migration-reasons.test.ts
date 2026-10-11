// src/tests/unit/app/services/migration-reasons.test.ts
//
// Every schema step must explain itself in the conversion dialog. A new
// migration without a reason text in both languages fails here.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import { migrationSteps } from "app/components/dialogs/migrate-project-dialog";

function reasons(lang: string): Record<string, string> {
  const file = join(process.cwd(), "src/i18n/locales", lang, "common.json");
  return JSON.parse(readFileSync(file, "utf-8")).dialogs.migrateProject.reasons;
}

describe("migration reasons", () => {
  it.each(["de", "en"])("%s has a reason for every schema step", (lang) => {
    const r = reasons(lang);
    for (let v = 1; v <= CURRENT_SCHEMA_VERSION; v++) {
      expect(r[`v${v}`], `v${v}`).toBeTruthy();
    }
  });

  it("steps run from the next version up to the target", () => {
    expect(migrationSteps(6, 8)).toEqual([7, 8]);
    expect(migrationSteps(0, 2)).toEqual([1, 2]);
    expect(migrationSteps(8, 8)).toEqual([]);
  });
});
