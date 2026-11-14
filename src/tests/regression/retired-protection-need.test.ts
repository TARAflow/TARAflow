// The asset field "protection need" is retired in 0.19 (no calculation read
// it; the impact comes from the security goals and damage scenarios). Older
// files still carry it: it is dropped on load, the next save writes the file
// without it, and the commit diff lists the dropped values ONCE — the
// previous state is read raw from git — so the commit gate sees a change and
// the audit trail shows why the file changed. A verification of the file as
// read stays valid (the field was never analysis).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { prepareForDisk } from "app/services/prepare-for-disk";
import { verificationStateHash, verificationStatus } from "app/services/verification-state";
import { diffService } from "features/audit/services/diff-service";
import { VERIFICATION_HASH_VERSION } from "shared";
import { RETIRED_ASSET_FIELDS } from "shared/models/retired-asset-fields";

/** A file as 0.18 wrote it: the current schema, the protection need on three assets (built once: the fixture's migration mints new ids each time). */
const LEGACY = ((): string => {
  const disk = prepareForDisk(parseAndRepair(JSON.parse(readFileSync("src/tests/fixtures/SmokeDetector.tara.json", "utf-8")))!) as unknown as {
    assets: { assets: { properties?: Record<string, unknown> }[] };
  };
  const needs = ["critical", "high", "low"];
  disk.assets.assets.slice(0, needs.length).forEach((a, i) => (a.properties = { ...(a.properties ?? {}), protectionNeed: needs[i] }));
  // retired with it in 0.19: the criticality (form field) and a dead model
  // field older hand-made files hold (physicalHazardPotential on a human asset)
  disk.assets.assets[0].properties = { ...disk.assets.assets[0].properties, criticality: "essential", physicalHazardPotential: "high" };
  return JSON.stringify(disk);
})();
const legacyText = () => LEGACY;
const detailsOf = (changes: ReturnType<typeof diffService.detectChanges>, field: string) =>
  changes.flatMap((p) => p.changes.flatMap((c) => (c.details ?? []).filter((d) => d.field === field)));
const needDetails = (changes: ReturnType<typeof diffService.detectChanges>) => detailsOf(changes, "protectionNeed");

describe("retired asset field: protection need", () => {
  it("legacy file → load → save: gone from memory and disk; the diff lists the drop once; the gate sees a change", () => {
    const previous = JSON.parse(legacyText()) as Project; // HEAD, read raw (audit-prev-state)
    const withValue = previous.assets!.assets.filter((a) => (a.properties as Record<string, unknown> | undefined)?.protectionNeed).length;
    expect(withValue).toBe(3);

    const loaded = parseAndRepair(JSON.parse(legacyText()))!;
    for (const field of RETIRED_ASSET_FIELDS) expect(JSON.stringify(loaded.assets), field).not.toContain(`"${field}"`);
    expect(JSON.stringify(loaded.assets)).not.toContain("protectionNeed");
    expect(JSON.stringify(loaded.dfd?.assets ?? [])).not.toContain("protectionNeed");
    const disk = prepareForDisk(loaded);
    expect(JSON.stringify(disk.assets)).not.toContain("protectionNeed");
    expect(JSON.stringify(disk.dfd)).not.toContain("protectionNeed");

    // first commit after the upgrade: one entry per asset that had a value, nothing new
    const first = diffService.detectChanges(loaded, previous);
    const dropped = needDetails(first);
    expect(dropped).toHaveLength(withValue);
    expect(dropped.every((d) => d.newValue === undefined && typeof d.oldValue === "string")).toBe(true);
    expect(first.length).toBeGreaterThan(0); // the commit gate sees a change
    // the other retired fields the same way, with the user-facing label
    expect(detailsOf(first, "criticality")).toEqual([
      { field: "criticality", fieldLabel: "Criticality (retired)", oldValue: "essential", newValue: undefined, valueType: "string" },
    ]);
    expect(detailsOf(first, "physicalHazardPotential").map((d) => d.oldValue)).toEqual(["high"]);

    // the next commit compares with the file as saved: nothing about it any more
    const committed = JSON.parse(JSON.stringify(disk)) as Project;
    expect(needDetails(diffService.detectChanges(parseAndRepair(JSON.parse(JSON.stringify(disk)))!, committed))).toHaveLength(0);
  });

  it("a verification of the legacy file as read stays verified after the drop", () => {
    const raw = JSON.parse(legacyText());
    const readHash = verificationStateHash(raw);
    raw.cybersecurityConcept = {
      ...(raw.cybersecurityConcept ?? { goals: [], claims: [] }),
      verifications: [{ id: "v1", date: "2026-11-01", reviewer: "A", scope: ["tara"], result: "passed", stateHash: readHash, hashVersion: VERIFICATION_HASH_VERSION }],
    };
    const loaded = parseAndRepair(raw)!;
    const entry = loaded.cybersecurityConcept!.verifications![0];
    expect(entry.reconfirm).toBeUndefined();
    expect(verificationStatus(loaded.cybersecurityConcept!.verifications, verificationStateHash(loaded), "2026-11-02").kind).toBe("verified");
  });
});
