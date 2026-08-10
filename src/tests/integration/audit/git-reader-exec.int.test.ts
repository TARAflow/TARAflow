// ======== AUDIT VERIFICATION — GIT READER EXEC (integration) ========
// Exercises the real-git adapter against a throwaway repository. Requires a git
// binary on PATH. Signature crypto ("good"/"bad") needs an SSH signing key and
// is covered by the real example fixtures; here we build UNSIGNED commits and
// assert the structural methods + verifyCommitAgainst → "none".
//
// Suggested location: src/tests/integration/features/audit/services/verify/
// git-reader-exec.int.test.ts  (needs a real git; keep out of the pure unit run
// if your CI lacks git).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGitReaderExec } from "features/audit/services/verify/git-reader-exec";

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", cwd, ...args],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

describe("createGitReaderExec (real git)", () => {
  let dir: string;
  let reader: ReturnType<typeof createGitReaderExec>;
  const hash: Record<string, string> = {};
  const MANIFEST = ".tara/allowed_signers";

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "taraflow-exec-"));
    reader = createGitReaderExec(dir);

    await git(dir, ["init", "-q", "-b", "main"]);
    await git(dir, ["config", "user.name", "Tester"]);
    await git(dir, ["config", "user.email", "tester@example.com"]);
    await git(dir, ["config", "commit.gpgsign", "false"]);

    // C1 (pre-anchor): a project file.
    await writeFile(join(dir, "proj.tara.json"), '{"v":0}');
    await git(dir, ["add", "proj.tara.json"]);
    await git(dir, ["commit", "-q", "-m", "seed"]);
    hash.C1 = (await git(dir, ["rev-parse", "HEAD"])).trim();

    // C2 (anchor): introduce the manifest.
    await mkdir(join(dir, ".tara"), { recursive: true });
    await writeFile(
      join(dir, MANIFEST),
      'me@example.com namespaces="git,taraflow-maintainer" ssh-ed25519 AAAAKEY x\n',
    );
    await git(dir, ["add", MANIFEST]);
    await git(dir, ["commit", "-q", "-m", "audit: bootstrap signer manifest"]);
    hash.C2 = (await git(dir, ["rev-parse", "HEAD"])).trim();
    await git(dir, ["tag", "audit-root", hash.C2]);

    // C3: a [TARA] round modifying the project file.
    await writeFile(join(dir, "proj.tara.json"), '{"v":1}');
    await git(dir, ["add", "proj.tara.json"]);
    await git(dir, [
      "commit",
      "-q",
      "-m",
      "[TARA] Detail Review\n\nAffected-Phases: X\nBatch-Size: 1\nAuthor: Tester\nDate: 2026-01-01T00:00:00Z",
    ]);
    hash.C3 = (await git(dir, ["rev-parse", "HEAD"])).trim();
  });

  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("resolveRef peels a tag to its commit and returns null for unknown refs", async () => {
    expect(await reader.resolveRef("main")).toBe(hash.C3);
    expect(await reader.resolveRef("audit-root")).toBe(hash.C2);
    expect(await reader.resolveRef("refs/tags/audit-root")).toBe(hash.C2);
    expect(await reader.resolveRef("nope")).toBeNull();
  });

  it("history returns anchor..tip inclusive in ancestry order, with parents", async () => {
    const h = await reader.history(hash.C2, hash.C3);
    expect(h.map((c) => c.hash)).toEqual([hash.C2, hash.C3]);
    expect(h[0].parents).toEqual([hash.C1]);
    expect(h[0].subject).toBe("audit: bootstrap signer manifest");
    expect(h[1].subject).toBe("[TARA] Detail Review");
    // full raw message is preserved (trailers included)
    expect(h[1].message).toContain("Affected-Phases: X");
    expect(h[1].author).toEqual({ name: "Tester", email: "tester@example.com" });
  });

  it("history rejects when the anchor is not an ancestor of the tip", async () => {
    await expect(reader.history(hash.C3, hash.C1)).rejects.toThrow(
      /not an ancestor/,
    );
  });

  it("countAncestors counts commits before a commit", async () => {
    expect(await reader.countAncestors(hash.C1)).toBe(0);
    expect(await reader.countAncestors(hash.C2)).toBe(1);
    expect(await reader.countAncestors(hash.C3)).toBe(2);
  });

  it("readFileAt returns blob content, or null when the tree lacks the path", async () => {
    expect(await reader.readFileAt(hash.C3, "proj.tara.json")).toBe('{"v":1}');
    expect(await reader.readFileAt(hash.C2, "proj.tara.json")).toBe('{"v":0}');
    // manifest did not exist at the pre-anchor commit
    expect(await reader.readFileAt(hash.C1, MANIFEST)).toBeNull();
    expect(await reader.readFileAt(hash.C3, "nope")).toBeNull();
  });

  it("changedPaths reports add/modify per commit (root shows adds)", async () => {
    expect(await reader.changedPaths(hash.C1)).toEqual([
      { path: "proj.tara.json", status: "A" },
    ]);
    expect(await reader.changedPaths(hash.C2)).toEqual([
      { path: MANIFEST, status: "A" },
    ]);
    expect(await reader.changedPaths(hash.C3)).toEqual([
      { path: "proj.tara.json", status: "M" },
    ]);
  });

  it("isAncestor answers ancestry (incl. self)", async () => {
    expect(await reader.isAncestor(hash.C1, hash.C3)).toBe(true);
    expect(await reader.isAncestor(hash.C2, hash.C2)).toBe(true);
    expect(await reader.isAncestor(hash.C3, hash.C1)).toBe(false);
  });

  it("verifyCommitAgainst is 'none' for an unsigned commit", async () => {
    const manifestText =
      'me@example.com namespaces="git,taraflow-maintainer" ssh-ed25519 AAAAKEY x\n';
    expect(await reader.verifyCommitAgainst(hash.C2, manifestText)).toBe("none");
  });

  it("reports a clean working tree and an attached HEAD", async () => {
    expect(await reader.isWorkingTreeClean()).toBe(true);
    expect(await reader.isHeadDetached()).toBe(false);
  });

  it("detects a dirty working tree and a detached HEAD", async () => {
    await writeFile(join(dir, "proj.tara.json"), '{"v":2}'); // uncommitted change
    expect(await reader.isWorkingTreeClean()).toBe(false);
    await git(dir, ["checkout", "-q", "--", "proj.tara.json"]); // clean up

    await git(dir, ["checkout", "-q", "--detach", hash.C2]);
    expect(await reader.isHeadDetached()).toBe(true);
    await git(dir, ["checkout", "-q", "main"]);
  });
});
