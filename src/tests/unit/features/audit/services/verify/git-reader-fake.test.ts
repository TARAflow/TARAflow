// ============ AUDIT VERIFICATION — FAKE GIT READER TESTS ============
// Locks the test-double's behaviour: trust-walk and the checks trust these
// semantics, so a wrong fake would invalidate every downstream test. If you use
// Jest with globals, delete the next import line.
import { describe, it, expect } from "vitest";
import { FakeGitReader, type FakeRepoSpec } from "./git-reader-fake";
import {
  entryFromPubkey,
  serializeAllowedSigners,
} from "features/audit/services/audit-signer-manifest";

const MANIFEST = ".tara/allowed_signers";

/** Build allowed_signers TEXT whose single entry authorizes `keyToken`. */
function manifestFor(keyToken: string, maintainer = false): string {
  return serializeAllowedSigners([
    entryFromPubkey("me@example.com", `ssh-ed25519 ${keyToken}`, { maintainer }),
  ]);
}

/** A small linear repo: root(A) → mid(B) → tip(C). */
function linearRepo(): FakeRepoSpec {
  return {
    commits: [
      {
        hash: "A",
        message: "root",
        tree: { [MANIFEST]: manifestFor("KA", true) },
        signedBy: "KA",
      },
      {
        hash: "B",
        parents: ["A"],
        message: "mid",
        tree: { [MANIFEST]: manifestFor("KA", true), "Proj.tara.json": "v1" },
        signedBy: "KA",
      },
      {
        hash: "C",
        parents: ["B"],
        message: "tip",
        tree: { [MANIFEST]: manifestFor("KA", true), "Proj.tara.json": "v2" },
        signedBy: "KA",
      },
    ],
    refs: { main: "C", "audit-root": "A" },
  };
}

describe("resolveRef", () => {
  const r = new FakeGitReader(linearRepo());
  it("resolves a known ref", async () => {
    expect(await r.resolveRef("main")).toBe("C");
    expect(await r.resolveRef("audit-root")).toBe("A");
  });
  it("peels a full tag ref name", async () => {
    expect(await r.resolveRef("refs/tags/audit-root")).toBe("A");
  });
  it("returns null for an unknown ref", async () => {
    expect(await r.resolveRef("nope")).toBeNull();
  });
});

describe("history", () => {
  const r = new FakeGitReader(linearRepo());
  it("returns anchor..tip inclusive, in ancestry order", async () => {
    const h = await r.history("A", "C");
    expect(h.map((c) => c.hash)).toEqual(["A", "B", "C"]);
  });
  it("returns a single commit for anchor == tip", async () => {
    const h = await r.history("A", "A");
    expect(h.map((c) => c.hash)).toEqual(["A"]);
  });
  it("excludes pre-anchor commits", async () => {
    const h = await r.history("B", "C");
    expect(h.map((c) => c.hash)).toEqual(["B", "C"]);
  });
  it("rejects when the anchor is not an ancestor of the tip", async () => {
    await expect(r.history("C", "A")).rejects.toThrow(/not an ancestor/);
  });
  it("derives subject from the first message line", async () => {
    const [a] = await r.history("A", "A");
    expect(a.subject).toBe("root");
    expect(a.parents).toEqual([]);
  });
});

describe("countAncestors", () => {
  const r = new FakeGitReader(linearRepo());
  it("is 0 at the root and grows down the chain", async () => {
    expect(await r.countAncestors("A")).toBe(0);
    expect(await r.countAncestors("B")).toBe(1);
    expect(await r.countAncestors("C")).toBe(2);
  });
});

describe("readFileAt", () => {
  const r = new FakeGitReader(linearRepo());
  it("returns file content present at a commit", async () => {
    expect(await r.readFileAt("C", "Proj.tara.json")).toBe("v2");
    expect(await r.readFileAt("B", "Proj.tara.json")).toBe("v1");
  });
  it("returns null when the tree does not contain the path (add-detection)", async () => {
    // Proj.tara.json does not exist yet at the root A.
    expect(await r.readFileAt("A", "Proj.tara.json")).toBeNull();
    expect(await r.readFileAt("C", "nope")).toBeNull();
  });
});

describe("changedPaths", () => {
  const r = new FakeGitReader(linearRepo());
  it("marks everything added at the root", async () => {
    expect(await r.changedPaths("A")).toEqual([
      { path: MANIFEST, status: "A" },
    ]);
  });
  it("marks an added file", async () => {
    expect(await r.changedPaths("B")).toEqual([
      { path: "Proj.tara.json", status: "A" },
    ]);
  });
  it("marks a modified file", async () => {
    expect(await r.changedPaths("C")).toEqual([
      { path: "Proj.tara.json", status: "M" },
    ]);
  });
  it("marks a deleted file", async () => {
    const r2 = new FakeGitReader({
      commits: [
        { hash: "A", tree: { "x.txt": "1" } },
        { hash: "B", parents: ["A"], tree: {} },
      ],
      refs: { main: "B" },
    });
    expect(await r2.changedPaths("B")).toEqual([{ path: "x.txt", status: "D" }]);
  });
});

describe("verifyCommitAgainst", () => {
  const r = new FakeGitReader({
    commits: [
      { hash: "S", tree: {}, signedBy: "K1" },
      { hash: "U", tree: {} }, // unsigned
      { hash: "X", tree: {}, signedBy: "K1", badSignature: true },
    ],
    refs: {},
  });
  it("is good when the signer's key is in the manifest", async () => {
    expect(await r.verifyCommitAgainst("S", manifestFor("K1"))).toBe("good");
  });
  it("is bad when the signer's key is NOT in the manifest", async () => {
    expect(await r.verifyCommitAgainst("S", manifestFor("K2"))).toBe("bad");
  });
  it("is none for an unsigned commit", async () => {
    expect(await r.verifyCommitAgainst("U", manifestFor("K1"))).toBe("none");
  });
  it("is bad for a cryptographically invalid signature, even if listed", async () => {
    expect(await r.verifyCommitAgainst("X", manifestFor("K1"))).toBe("bad");
  });
  it("verifies against a maintainers-only subset (empty when signer is not a maintainer)", async () => {
    // K1 is a plain signer here; a maintainers-only manifest is empty → bad.
    const plain = manifestFor("K1", false);
    const maintainerOnly = ""; // no maintainers
    expect(await r.verifyCommitAgainst("S", plain)).toBe("good");
    expect(await r.verifyCommitAgainst("S", maintainerOnly)).toBe("bad");
  });
});

describe("isAncestor", () => {
  const r = new FakeGitReader(linearRepo());
  it("is true for a real ancestor and for self", async () => {
    expect(await r.isAncestor("A", "C")).toBe(true);
    expect(await r.isAncestor("B", "B")).toBe(true);
  });
  it("is false for a non-ancestor", async () => {
    expect(await r.isAncestor("C", "A")).toBe(false);
  });
});

describe("repo state flags", () => {
  it("defaults to clean, attached", async () => {
    const r = new FakeGitReader(linearRepo());
    expect(await r.isWorkingTreeClean()).toBe(true);
    expect(await r.isHeadDetached()).toBe(false);
  });
  it("reports configured dirty / detached", async () => {
    const r = new FakeGitReader({
      commits: [{ hash: "A", tree: {} }],
      workingTreeClean: false,
      headDetached: true,
    });
    expect(await r.isWorkingTreeClean()).toBe(false);
    expect(await r.isHeadDetached()).toBe(true);
  });
});
