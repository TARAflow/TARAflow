// Review 2026-10-30 (SmokeDetector): the tab badge and the Overview showed a
// DFD error from the validation stored in the file while the DFD panel —
// the current validation — showed none. The app now validates the stored
// diagram itself (validateSavedState). And the panel's validation checked
// asset relations against the dfd.assets mirror instead of the asset
// registry, as the load does.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { dfdService } from "features/dfd/services/dfd-service";
import { createDFDStorageAdapter } from "features/dfd/services/dfd-storage-adapter";
import { parseAndRepair } from "app/services/migration-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const load = (): Any => {
  const p: Any = parseAndRepair(JSON.parse(readFileSync("src/tests/fixtures/SmokeDetector.tara.json", "utf-8")));
  return { ...p, name: p.info.name, knownAssets: p.assets.assets.map((a: Any) => ({ id: a.id, name: a.name, assetGroup: a.assetGroup })) };
};
const keys = (r: { errors: { key: string }[]; warnings: { key: string }[] }) => [...r.errors, ...r.warnings].map((f) => f.key);

describe("validating the stored DFD", () => {
  it("validates project.dfd.xml, not the validation stored in the file; same result as the editor's", () => {
    const project = load();
    project.dfd.validation = { isComplete: false, errors: [{ key: "stale.finding" }], warnings: [], lastValidated: "2020-01-01" };
    const saved = dfdService.validateSavedState(project)!;
    expect(keys(saved)).not.toContain("stale.finding");
    createDFDStorageAdapter(project.id).loadToLocalStorage(project.dfd);
    const current = dfdService.validateCurrentState(project);
    expect(keys(saved)).toEqual(keys(current));
    expect(dfdService.phaseStatusOf(saved)).toBe(saved.errors.length > 0 ? "incomplete" : saved.isComplete ? "complete" : "in-progress");
  });

  it("no diagram → null", () => {
    expect(dfdService.validateSavedState({ ...load(), dfd: null })).toBeNull();
  });

  it("asset relations are checked against the registry, not the (empty) dfd.assets mirror — editor and app alike", () => {
    const project = load();
    project.dfd.assets = [];
    expect(keys(dfdService.validateSavedState(project)!)).not.toContain("dfdValidation.assetRelationInconsistent");
    createDFDStorageAdapter(project.id).loadToLocalStorage(project.dfd);
    expect(keys(dfdService.validateCurrentState(project))).not.toContain("dfdValidation.assetRelationInconsistent");
    // without the registry the mirror is used — and it is empty here
    expect(keys(dfdService.validateSavedState({ ...project, knownAssets: undefined })!)).toContain(
      "dfdValidation.assetRelationInconsistent",
    );
  });
});
