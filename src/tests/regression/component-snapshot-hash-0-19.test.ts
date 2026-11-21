// Snapshot hash test (roadmap-to-1.0.md rule 5, from 0.20): a component TARA
// saved with the reference release gives the same content hash with the
// current version — when loaded and after saving it again. Otherwise every
// machine that imported the component would see a drift and "Refresh stored
// state" would come back with every release.
//
// Reference (0.19): SmokeDetectorCase.tara.json as committed in
// TARAflow_Examples (e68d84da), and the snapshot + content hash TARAflow 0.19
// stored when it imported that commit into SmokeDetectorController
// (TARAflow_Examples 1468c3f). The fixture lacks the file's `integration`
// block (a Jira connection without secrets, but its "credentials" object
// trips the pre-commit scan) — not part of a snapshot, the hash is the same.
// Re-based in 0.21 on a component saved with
// 0.21 — the field retirements change the snapshot content on purpose
// (rule 4), in one release.
//
// When it fails: a migration or repair step writes into the parts of a
// component that go into the snapshot, or a new field is written as a
// default (rule 5: new fields optional, absent = default, never written).
// The third test names the places.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { componentSnapshotOfText } from "app/services/component-import/component-source";
import { serialiseProject } from "app/services/prepare-for-disk";
import { changedJsonPaths } from "features/audit/services/unlisted-changes";
import { canonicalStringify } from "shared/utils/tcs-canonical";
import { applyDfdBadges, stripDfdBadges } from "features/dfd/services/dfd-badges";

const DIR = join(__dirname, "../fixtures/component-0.19");
const COMPONENT_0_19 = readFileSync(join(DIR, "SmokeDetectorCase.tara.json"), "utf-8");
const STORED_0_19 = JSON.parse(readFileSync(join(DIR, "SmokeDetectorCase.snapshot-0.19.json"), "utf-8")) as {
  contentHash: string;
  snapshot: unknown;
};

function snapshotOf(text: string) {
  const result = componentSnapshotOfText(text);
  if (!result.ok) throw new Error(`component not readable: ${result.error} ${result.detail ?? ""}`);
  return result;
}

describe("component snapshot hash — reference 0.19 (rule 5)", () => {
  it("the reference is what 0.19 recorded", () => {
    expect(STORED_0_19.contentHash).toBe("ac3ab72ad377");
  });

  it("loaded with the current version: the content hash of 0.19", () => {
    expect(snapshotOf(COMPONENT_0_19).contentHash).toBe(STORED_0_19.contentHash);
  });

  it("saved again with the current version and loaded: still the hash of 0.19", () => {
    const saved = serialiseProject(snapshotOf(COMPONENT_0_19).project);
    expect(snapshotOf(saved).contentHash).toBe(STORED_0_19.contentHash);
    // and a second save changes nothing (byte-stable)
    expect(serialiseProject(snapshotOf(saved).project)).toBe(saved);
  });

  it("the snapshot itself equals the one 0.19 stored (names the places on failure)", () => {
    const now = JSON.parse(canonicalStringify(snapshotOf(COMPONENT_0_19).snapshot));
    const then = JSON.parse(canonicalStringify(STORED_0_19.snapshot));
    expect(changedJsonPaths(then, now)).toEqual([]);
  });
});

describe("component snapshot hash — the EL badges are display only (0.20 patch 23, review 2026-11-21)", () => {
  // The editor shows badges on every boundary / interface with an EL (10 in
  // this component). They must neither reach the file nor the hash.
  const project = JSON.parse(COMPONENT_0_19) as { dfd: { xml: string; elements: { id: string; type: string; properties?: object }[] } };
  const elements = new Map(project.dfd.elements.map((e) => [e.id, e]));
  const withBadges = applyDfdBadges(project.dfd.xml, elements, undefined, { enabled: true, en50742: true });

  it("the editor's diagram holds badges", () => {
    expect((withBadges.match(/type="elbadge"/g) ?? []).length).toBeGreaterThan(0);
  });

  it("strip(apply(xml)) gives back the stored diagram byte for byte", () => {
    expect(stripDfdBadges(withBadges)).toBe(project.dfd.xml);
  });

  it("a component file holding badges (an earlier 0.20 build) still has the hash of 0.19", () => {
    const text = JSON.stringify({ ...JSON.parse(COMPONENT_0_19), dfd: { ...JSON.parse(COMPONENT_0_19).dfd, xml: withBadges } });
    expect(snapshotOf(text).contentHash).toBe(STORED_0_19.contentHash);
  });
});
