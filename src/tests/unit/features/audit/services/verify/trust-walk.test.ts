// ============ AUDIT VERIFICATION — TRUST WALK TESTS ============
// Scenarios against the in-memory fake — no real git. Includes a positive
// fixture mirror (must be green: only a PRE_ANCHOR_COMMITS info) and a negative
// fixture mirror (role never validly established → red). If you use Jest with
// globals, delete the next import line.
import { describe, it, expect } from "vitest";
import { runTrustWalk } from "features/audit/services/verify/trust-walk";
import { hasErrors, type Finding } from "features/audit/services/verify/findings";
import {
  FakeGitReader,
  type FakeCommitSpec,
  type FakeRepoSpec,
} from "./git-reader-fake";
import {
  entryFromPubkey,
  serializeAllowedSigners,
} from "features/audit/services/audit-signer-manifest";

const MANIFEST = ".tara/allowed_signers";

/** allowed_signers text from a compact spec of keys + roles. */
function manifest(
  entries: { key: string; principal?: string; maintainer?: boolean }[],
): string {
  return serializeAllowedSigners(
    entries.map((e) =>
      entryFromPubkey(e.principal ?? "u@example.com", `ssh-ed25519 ${e.key}`, {
        maintainer: e.maintainer,
      }),
    ),
  );
}

const ids = (f: Finding[]) => f.map((x) => x.id).sort();
const idsAt = (f: Finding[], commit: string) =>
  f.filter((x) => x.commit === commit).map((x) => x.id).sort();

// ── Positive fixture mirror ──────────────────────────────────────────────────
// pre-anchor commit → anchor (KM maintainer, self-signed) → a [TARA] round by a
// signer → a maintainer adding a second signer. Must be green.
function positiveRepo(): FakeRepoSpec {
  const m0 = manifest([{ key: "KM", maintainer: true }]);
  const m1 = manifest([
    { key: "KM", maintainer: true },
    { key: "KS" },
  ]);
  const commits: FakeCommitSpec[] = [
    { hash: "P0", message: "[TARA] pre-anchor", tree: { "proj.tara.json": "v0" } },
    {
      hash: "A",
      parents: ["P0"],
      message: "audit: bootstrap signer manifest",
      tree: { [MANIFEST]: m0, "proj.tara.json": "v0" },
      signedBy: "KM",
    },
    {
      hash: "B",
      parents: ["A"],
      message: "[TARA] Detail Review",
      tree: { [MANIFEST]: m0, "proj.tara.json": "v1" },
      signedBy: "KM",
    },
    {
      hash: "C",
      parents: ["B"],
      message: "audit: authorize signer KS",
      tree: { [MANIFEST]: m1, "proj.tara.json": "v1" },
      signedBy: "KM",
    },
  ];
  return { commits, refs: { main: "C", "audit-root": "A" } };
}

describe("positive fixture mirror", () => {
  it("is green — only a PRE_ANCHOR_COMMITS info, no errors", async () => {
    const r = new FakeGitReader(positiveRepo());
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "C" });
    expect(hasErrors(f)).toBe(false);
    expect(ids(f)).toEqual(["PRE_ANCHOR_COMMITS"]);
    const info = f.find((x) => x.id === "PRE_ANCHOR_COMMITS");
    expect(info?.context).toEqual({ count: 1 });
  });
});

// ── Negative fixture mirror ──────────────────────────────────────────────────
// Anchor introduces a signer WITHOUT the maintainer role; a later commit tries
// to change the manifest but no maintainer ever existed. Must be red.
function negativeRepo(): FakeRepoSpec {
  const m0 = manifest([{ key: "KS" }]); // no maintainer
  const m1 = manifest([{ key: "KS" }, { key: "KX" }]);
  const commits: FakeCommitSpec[] = [
    {
      hash: "A",
      message: "audit: bootstrap signer manifest",
      tree: { [MANIFEST]: m0 },
      signedBy: "KS",
    },
    {
      hash: "B",
      parents: ["A"],
      message: "audit: authorize signer KX",
      tree: { [MANIFEST]: m1 },
      signedBy: "KS",
    },
  ];
  return { commits, refs: { main: "B", "audit-root": "A" } };
}

describe("negative fixture mirror", () => {
  it("is red — no maintainer at the anchor, manifest change by a non-maintainer", async () => {
    const r = new FakeGitReader(negativeRepo());
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "B" });
    expect(hasErrors(f)).toBe(true);
    expect(idsAt(f, "A")).toEqual(["MANIFEST_NO_MAINTAINER"]);
    expect(idsAt(f, "B")).toEqual([
      "MANIFEST_NOT_MAINTAINER",
      "MANIFEST_NO_MAINTAINER",
    ]);
  });
});

// ── Targeted unit scenarios ──────────────────────────────────────────────────
// A healthy 2-commit base: anchor (KM maintainer) + one more commit we vary.
function baseWith(second: Partial<FakeCommitSpec>): FakeGitReader {
  const m = manifest([
    { key: "KM", maintainer: true },
    { key: "KS" },
  ]);
  return new FakeGitReader({
    commits: [
      {
        hash: "A",
        message: "audit: bootstrap",
        tree: { [MANIFEST]: m, "proj.tara.json": "v0" },
        signedBy: "KM",
      },
      {
        hash: "B",
        parents: ["A"],
        message: "commit",
        tree: { [MANIFEST]: m, "proj.tara.json": "v1" },
        signedBy: "KM",
        ...second,
      },
    ],
    refs: { main: "B", "audit-root": "A" },
  });
}

describe("per-commit signature + authorization", () => {
  it("flags an unsigned commit as SIG_UNSIGNED", async () => {
    const r = baseWith({ signedBy: undefined });
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "B" });
    expect(idsAt(f, "B")).toEqual(["SIG_UNSIGNED"]);
  });

  it("flags a commit signed by an unauthorized key as SIGNER_NOT_AUTHORIZED", async () => {
    const r = baseWith({ signedBy: "KZ" }); // KZ not in the manifest
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "B" });
    expect(idsAt(f, "B")).toEqual(["SIGNER_NOT_AUTHORIZED"]);
    const nf = f.find((x) => x.commit === "B");
    expect(nf?.context).toEqual({ author: "test@example.com" });
  });

  it("accepts a NON-maintainer signer making a non-manifest commit", async () => {
    // KS is an authorized signer but not a maintainer; B only changes proj.tara.json.
    const r = baseWith({ signedBy: "KS" });
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "B" });
    expect(hasErrors(f)).toBe(false);
  });
});

describe("manifest authority (maintainer-only)", () => {
  it("rejects a manifest change signed by a non-maintainer signer", async () => {
    // B is signed by KS (authorized signer, NOT maintainer) and changes the manifest.
    const m2 = manifest([
      { key: "KM", maintainer: true },
      { key: "KS" },
      { key: "KNEW" },
    ]);
    const r = baseWith({
      signedBy: "KS",
      tree: { [MANIFEST]: m2, "proj.tara.json": "v1" },
    });
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "B" });
    expect(idsAt(f, "B")).toEqual(["MANIFEST_NOT_MAINTAINER"]);
  });

  it("accepts a manifest change signed by a maintainer", async () => {
    const m2 = manifest([
      { key: "KM", maintainer: true },
      { key: "KS" },
      { key: "KNEW" },
    ]);
    const r = baseWith({
      signedBy: "KM",
      tree: { [MANIFEST]: m2, "proj.tara.json": "v1" },
    });
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "B" });
    expect(hasErrors(f)).toBe(false);
  });

  it("flags a manifest change that removes the last maintainer (MANIFEST_NO_MAINTAINER)", async () => {
    // KM (maintainer) demotes the manifest to signers only — resulting state has no maintainer.
    const m2 = manifest([{ key: "KM" }, { key: "KS" }]); // KM no longer maintainer
    const r = baseWith({
      signedBy: "KM",
      tree: { [MANIFEST]: m2, "proj.tara.json": "v1" },
    });
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "B" });
    expect(idsAt(f, "B")).toEqual(["MANIFEST_NO_MAINTAINER"]);
  });
});

describe("anchor bootstrap rules", () => {
  it("ANCHOR_MISMATCH when the pinned anchor is not an ancestor of the tip", async () => {
    const r = new FakeGitReader({
      commits: [
        { hash: "X", tree: { [MANIFEST]: manifest([{ key: "K", maintainer: true }]) }, signedBy: "K" },
        { hash: "Y", tree: { [MANIFEST]: manifest([{ key: "K", maintainer: true }]) }, signedBy: "K" },
      ],
      refs: { main: "Y" },
    });
    const f = await runTrustWalk({ reader: r, anchor: "X", tip: "Y" });
    expect(ids(f)).toEqual(["ANCHOR_MISMATCH"]);
  });

  it("ANCHOR_MISMATCH when the pinned anchor does not contain the manifest", async () => {
    const r = new FakeGitReader({
      commits: [{ hash: "A", tree: {}, signedBy: "K" }],
      refs: { main: "A" },
    });
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "A" });
    expect(ids(f)).toEqual(["ANCHOR_MISMATCH"]);
  });

  it("ANCHOR_MISMATCH when the manifest already exists before the pinned anchor", async () => {
    const m = manifest([{ key: "K", maintainer: true }]);
    const r = new FakeGitReader({
      commits: [
        { hash: "P", tree: { [MANIFEST]: m }, signedBy: "K" }, // manifest already here
        { hash: "A", parents: ["P"], tree: { [MANIFEST]: m }, signedBy: "K" },
      ],
      refs: { main: "A", "audit-root": "A" },
    });
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "A" });
    expect(ids(f)).toEqual(["ANCHOR_MISMATCH"]);
  });

  it("MANIFEST_NO_MAINTAINER when the anchor introduces no maintainer", async () => {
    const r = new FakeGitReader({
      commits: [
        { hash: "A", tree: { [MANIFEST]: manifest([{ key: "KS" }]) }, signedBy: "KS" },
      ],
      refs: { main: "A" },
    });
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "A" });
    expect(idsAt(f, "A")).toEqual(["MANIFEST_NO_MAINTAINER"]);
  });

  it("ANCHOR_SIGNER_NOT_MAINTAINER when a maintainer exists but the anchor signer isn't it", async () => {
    // Manifest has a maintainer KM, but the anchor is signed by a different (plain) signer KS.
    const m = manifest([{ key: "KM", maintainer: true }, { key: "KS" }]);
    const r = new FakeGitReader({
      commits: [{ hash: "A", tree: { [MANIFEST]: m }, signedBy: "KS" }],
      refs: { main: "A" },
    });
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "A" });
    expect(idsAt(f, "A")).toEqual(["ANCHOR_SIGNER_NOT_MAINTAINER"]);
  });

  it("flags an unsigned anchor as SIG_UNSIGNED and still checks the invariant", async () => {
    const m = manifest([{ key: "KM", maintainer: true }]);
    const r = new FakeGitReader({
      commits: [{ hash: "A", tree: { [MANIFEST]: m } }], // unsigned
      refs: { main: "A" },
    });
    const f = await runTrustWalk({ reader: r, anchor: "A", tip: "A" });
    // Unsigned → SIG_UNSIGNED; maintainer present so no NO_MAINTAINER; the
    // maintainer-signature refinement is skipped because the anchor isn't "good".
    expect(idsAt(f, "A")).toEqual(["SIG_UNSIGNED"]);
  });
});
