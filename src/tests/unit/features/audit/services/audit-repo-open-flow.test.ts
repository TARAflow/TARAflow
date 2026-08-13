// ==================== AUDIT REPO OPEN-FLOW — TESTS ====================
// If you use Jest with globals, delete the next import line.
import { describe, it, expect } from "vitest";
import {
  runAuditRepoOpenFlow,
  dirnameOf,
  gitattributesPathOf,
  type AuditRepoOpenFlowDeps,
} from "features/audit/services/audit-repo-open-flow";
import type { GitRunner } from "features/audit/services/audit-repo-locator";
import type { FileIO } from "features/audit/services/audit-repo-attributes";

// ── path helpers ─────────────────────────────────────────────────────────────

describe("path helpers", () => {
  it("dirnameOf handles posix and windows separators", () => {
    expect(dirnameOf("/home/u/proj/foo.tara.json")).toBe("/home/u/proj");
    expect(dirnameOf("C:\\p\\foo.tara.json")).toBe("C:\\p");
    expect(dirnameOf("foo.tara.json")).toBe(".");
  });

  it("gitattributesPathOf uses the root's own separator", () => {
    expect(gitattributesPathOf("/r")).toBe("/r/.gitattributes");
    expect(gitattributesPathOf("C:\\r")).toBe("C:\\r\\.gitattributes");
  });
});

// ── fakes ────────────────────────────────────────────────────────────────────

function gitRunnerFor(kind: "not-repo" | "attrs-ok" | "attrs-missing"): GitRunner {
  return async (args) => {
    if (args[1] === "--show-toplevel") {
      return kind === "not-repo"
        ? { stdout: "", stderr: "fatal", code: 128 }
        : { stdout: "/r\n", stderr: "", code: 0 };
    }
    if (args[0] === "check-attr") {
      const p = args[args.length - 1];
      const v = kind === "attrs-ok" ? { text: "set", eol: "lf" } : { text: "unspecified", eol: "unspecified" };
      return { stdout: `${p}: text: ${v.text}\n${p}: eol: ${v.eol}`, stderr: "", code: 0 };
    }
    return { stdout: "", stderr: "", code: 0 };
  };
}

const fileIO: FileIO = { async read() { return null; }, async write() {} };

function trackingDeps(git: GitRunner) {
  const setRepoPathCalls: string[] = [];
  const cacheCalls: Array<[string, string | null]> = [];
  const deps: AuditRepoOpenFlowDeps = {
    gitRunner: git,
    fileIO,
    setRepoPath: async (root) => {
      setRepoPathCalls.push(root);
      return { success: true };
    },
    cacheRepoRoot: async (id, root) => {
      cacheCalls.push([id, root]);
    },
  };
  return { deps, setRepoPathCalls, cacheCalls };
}

// ── open-flow branches ───────────────────────────────────────────────────────

describe("runAuditRepoOpenFlow", () => {
  it("returns no-file when the project has no filePath", async () => {
    const { deps } = trackingDeps(gitRunnerFor("attrs-ok"));
    const out = await runAuditRepoOpenFlow(deps, { id: "p" });
    expect(out.kind).toBe("no-file");
  });

  it("returns not-a-repo and caches null when outside a work tree", async () => {
    const { deps, cacheCalls, setRepoPathCalls } = trackingDeps(gitRunnerFor("not-repo"));
    const out = await runAuditRepoOpenFlow(deps, {
      id: "p1",
      filePath: "/loose/foo.tara.json",
    });
    expect(out).toEqual({ kind: "not-a-repo", fileDir: "/loose" });
    expect(cacheCalls).toContainEqual(["p1", null]);
    expect(setRepoPathCalls).toEqual([]); // never bind a non-repo
  });

  it("binds + caches the root and returns repo-ok when attributes are fine", async () => {
    const { deps, cacheCalls, setRepoPathCalls } = trackingDeps(gitRunnerFor("attrs-ok"));
    const out = await runAuditRepoOpenFlow(deps, {
      id: "p2",
      filePath: "/r/sub/foo.tara.json",
    });
    expect(out).toMatchObject({ kind: "repo-ok", repoRoot: "/r" });
    // hooks status now rides along; the fake has none installed → flagged for install
    if (out.kind === "repo-ok") {
      expect(out.hooks.ok).toBe(false);
      expect(out.hooks.toWrite).toEqual(["commit-msg"]);
    }
    expect(setRepoPathCalls).toEqual(["/r"]);
    expect(cacheCalls).toContainEqual(["p2", "/r"]);
  });

  it("returns repo-needs-attributes when the .gitattributes rule is absent", async () => {
    const { deps, setRepoPathCalls } = trackingDeps(gitRunnerFor("attrs-missing"));
    const out = await runAuditRepoOpenFlow(deps, {
      id: "p3",
      filePath: "/r/foo.tara.json",
    });
    expect(out.kind).toBe("repo-needs-attributes");
    if (out.kind === "repo-needs-attributes") {
      expect(out.repoRoot).toBe("/r");
      expect(out.status.ok).toBe(false);
    }
    expect(setRepoPathCalls).toEqual(["/r"]); // still bound — repo exists
  });
});
