// ==================== AUDIT REPO LOCATOR — TESTS ====================
// If you use Jest with globals, delete the next import line.
import { describe, it, expect } from "vitest";
import {
  locateAuditRepo,
  perProjectLogArgs,
  type GitRunner,
} from "features/audit/services/audit-repo-locator";

/**
 * Fake git modelling `rev-parse --show-toplevel` from a map of dir → repo root.
 * A dir with no mapping (and no mapped ancestor) is "not a repo" (code 128).
 */
function fakeGit(roots: Record<string, string>): GitRunner {
  return async (args, cwd) => {
    if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
      // find the longest mapped path that is cwd or an ancestor of cwd
      const match = Object.keys(roots)
        .filter((d) => cwd === d || cwd.startsWith(d + "/"))
        .sort((a, b) => b.length - a.length)[0];
      if (match) {
        return { stdout: roots[match] + "\n", stderr: "", code: 0 };
      }
      return {
        stdout: "",
        stderr:
          "fatal: not a git repository (or any of the parent directories): .git\n",
        code: 128,
      };
    }
    return { stdout: "", stderr: "", code: 0 };
  };
}

describe("locateAuditRepo", () => {
  it("resolves a file directly in the repo root", async () => {
    const git = fakeGit({ "/home/u/proj": "/home/u/proj" });
    const loc = await locateAuditRepo(git, "/home/u/proj");
    expect(loc.isRepo).toBe(true);
    expect(loc.repoRoot).toBe("/home/u/proj");
    expect(loc.nextAction).toBe("inspect-attributes");
  });

  it("resolves a file in a SUBFOLDER to the repo ROOT (an ancestor)", async () => {
    const git = fakeGit({ "/home/u/proj": "/home/u/proj" });
    const loc = await locateAuditRepo(git, "/home/u/proj/tara/deep");
    expect(loc.isRepo).toBe(true);
    expect(loc.repoRoot).toBe("/home/u/proj"); // NOT the file's own dir
  });

  it("reports not-a-repo and offers init when outside any work tree", async () => {
    const git = fakeGit({}); // nothing is a repo
    const loc = await locateAuditRepo(git, "/tmp/loose/folder");
    expect(loc.isRepo).toBe(false);
    expect(loc.repoRoot).toBeNull();
    expect(loc.nextAction).toBe("offer-init");
  });

  it("trims trailing newline from the toplevel path", async () => {
    const git: GitRunner = async () => ({
      stdout: "/repo/root\n",
      stderr: "",
      code: 0,
    });
    const loc = await locateAuditRepo(git, "/repo/root/x");
    expect(loc.repoRoot).toBe("/repo/root");
  });

  it("treats an empty stdout with code 0 as not-a-repo (defensive)", async () => {
    const git: GitRunner = async () => ({ stdout: "\n", stderr: "", code: 0 });
    const loc = await locateAuditRepo(git, "/x");
    expect(loc.isRepo).toBe(false);
    expect(loc.nextAction).toBe("offer-init");
  });

  it("perProjectLogArgs builds a path-scoped log filter", () => {
    expect(perProjectLogArgs("tara/foo.tara.json")).toEqual([
      "log",
      "--",
      "tara/foo.tara.json",
    ]);
  });
});
