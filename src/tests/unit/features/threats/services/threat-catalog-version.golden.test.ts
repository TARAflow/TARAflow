// Guard of the threat catalogue version (catalogue divergence design, phase
// A; roadmap-to-1.0.md rule 3.2). The stamp a project file carries is only
// worth something if THREAT_CATALOG_VERSION changes whenever the generators
// produce something else. This test hashes a fresh generation (both STRIDE
// methods, with the normalisation of the results dump) of four fixtures —
// a change of templates, texts, matching or STRIDE rules changes a hash.
//
// When it fails after a deliberate catalogue change:
//   1. bump THREAT_CATALOG_VERSION (features/threats/services/threat-catalog-version.ts)
//      and note what changed in its comment;
//   2. put the version and the new hashes into PINNED below;
//   3. add a results dump for the release (doc/Testing/results-dump/README.md).
// When it fails and the catalogue was NOT meant to change: that is a bug.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fnv1aHex12 } from "shared/utils/fnv1a";
import { THREAT_CATALOG_VERSION } from "features/threats/services/threat-catalog-version";
import { dumpThreatResults, stringifyDump } from "../../../../../../scripts/results-dump/core";

const PINNED = {
  version: 1,
  hashes: {
    "SmokeDetector.tara.json": "844a4c078565",
    "Simple_Test_Project.tara.json": "f65e38109e92",
    "cnc-ref.tara.json": "690f1055e5d0",
    "examples/simple-controller.base.tara.json": "278001ae7d1a",
  } as Record<string, string>,
};

const FIXTURES = join(__dirname, "../../../../fixtures");

function currentHashes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of Object.keys(PINNED.hashes)) {
    const raw = JSON.parse(readFileSync(join(FIXTURES, file), "utf-8"));
    out[file] = fnv1aHex12(stringifyDump(dumpThreatResults(raw, file)));
  }
  return out;
}

describe("threat catalogue version guard", () => {
  it("the generation of the fixtures matches the pinned catalogue version", () => {
    const now = { version: THREAT_CATALOG_VERSION, hashes: currentHashes() };
    expect(
      now,
      "The threat generation changed. If deliberate: bump THREAT_CATALOG_VERSION and update PINNED (see the head of this file).",
    ).toEqual(PINNED);
  });
});
