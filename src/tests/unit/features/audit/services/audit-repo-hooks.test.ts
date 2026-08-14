import { describe, it, expect } from "vitest";
import {
  HOOKS_VERSION,
  MANAGED_HOOKS,
  HOOKS_PATH_REL,
  hookScript,
  parseHookVersion,
  isManagedHook,
  normalizeHooksPath,
  hookPathOf,
  inspectAuditRepoHooks,
  applyAuditRepoHooks,
} from "audit/services/audit-repo-hooks";
import type { GitRunner, FileIO } from "audit/services/audit-repo-attributes";

function fakeGit(hp: string | null) {
  let cur = hp;
  const run: GitRunner = async (args) => {
    if (args[0] === "config" && args[1] === "--get")
      return cur == null
        ? { stdout: "", stderr: "", code: 1 }
        : { stdout: cur + "\n", stderr: "", code: 0 };
    if (args[0] === "config" && args[1] === "core.hooksPath") {
      cur = args[2];
      return { stdout: "", stderr: "", code: 0 };
    }
    return { stdout: "", stderr: "", code: 0 };
  };
  return {
    run,
    get hooksPath() {
      return cur;
    },
  };
}
function fakeIO(seed: Record<string, string> = {}) {
  const files = new Map(Object.entries(seed));
  const chmodded: string[] = [];
  const io: FileIO = {
    read: async (p) => (files.has(p) ? files.get(p)! : null),
    write: async (p, c) => {
      files.set(p, c);
    },
  };
  return {
    io,
    files,
    chmodded,
    makeExecutable: async (p: string) => {
      chmodded.push(p);
    },
  };
}
const REPO = "/repo";

describe("audit-repo-hooks (pure-sh)", () => {
  it("hookScript is managed, versioned, POSIX sh, and lists the required trailers", () => {
    const s = hookScript("commit-msg");
    expect(s.startsWith("#!/bin/sh\n")).toBe(true);
    expect(isManagedHook(s)).toBe(true);
    expect(parseHookVersion(s)).toBe(HOOKS_VERSION);
    expect(s).toContain("for key in Affected-Phases Batch-Size Author Date;");
    expect(s).not.toContain("taraflow-hook"); // no external helper
    // Scope gate: schema only enforced on commits touching audit paths, so
    // ordinary source commits in the same repo stay free-form.
    expect(s).toContain("git diff --cached --name-only");
    expect(s).toContain("\\.tara\\.json$|(^|/)\\.tara/");
  });
  it("fresh repo → not ok, toWrite commit-msg", async () => {
    const g = fakeGit(null),
      f = fakeIO();
    const st = await inspectAuditRepoHooks(g.run, f.io, REPO);
    expect(st.ok).toBe(false);
    expect(st.toWrite).toEqual([...MANAGED_HOOKS]);
  });
  it("configured + current → ok", async () => {
    const seed: Record<string, string> = {};
    for (const n of MANAGED_HOOKS) seed[hookPathOf(REPO, n)] = hookScript(n);
    const g = fakeGit(HOOKS_PATH_REL),
      f = fakeIO(seed);
    expect((await inspectAuditRepoHooks(g.run, f.io, REPO)).ok).toBe(true);
  });
  it("stale version → toWrite", async () => {
    const seed: Record<string, string> = {};
    seed[hookPathOf(REPO, "commit-msg")] = hookScript("commit-msg").replace(
      `HOOKS_VERSION=${HOOKS_VERSION}`,
      "HOOKS_VERSION=0",
    );
    const g = fakeGit(HOOKS_PATH_REL),
      f = fakeIO(seed);
    const st = await inspectAuditRepoHooks(g.run, f.io, REPO);
    expect(st.ok).toBe(false);
    expect(st.toWrite).toEqual(["commit-msg"]);
  });
  it("apply sets hooksPath, writes + chmods, then ok", async () => {
    const g = fakeGit(null),
      f = fakeIO();
    const st = await applyAuditRepoHooks(g.run, f.io, f.makeExecutable, REPO);
    expect(g.hooksPath).toBe(HOOKS_PATH_REL);
    expect(f.chmodded).toContain(hookPathOf(REPO, "commit-msg"));
    expect(st.ok).toBe(true);
  });
  it("normalizeHooksPath tolerates separators/trailing slash", () => {
    expect(normalizeHooksPath(".tara\\hooks\\")).toBe(".tara/hooks");
  });
});

// Regression: an IPC git runner that returns the value but a NON-zero code
// (doesn't propagate 0 on success) must still count as configured.
import { inspectAuditRepoHooks as _inspect } from "audit/services/audit-repo-hooks";
describe("readHooksPath robustness (code-agnostic)", () => {
  it("treats a printed value as configured even when code !== 0", async () => {
    const run = async (args: string[]) => {
      if (args[0] === "config" && args[1] === "--get")
        return { stdout: ".tara/hooks\n", stderr: "", code: 1 }; // value + bad code
      return { stdout: "", stderr: "", code: 0 };
    };
    const seed: Record<string,string> = {};
    for (const n of MANAGED_HOOKS) seed[hookPathOf(REPO, n)] = hookScript(n);
    const files = new Map(Object.entries(seed));
    const io = { read: async (p: string) => files.get(p) ?? null, write: async () => {} };
    const st = await _inspect(run as any, io as any, REPO);
    expect(st.hooksPathConfigured).toBe(true);
    expect(st.ok).toBe(true);
  });
});

describe("applyAuditRepoHooks fails loudly on config error", () => {
  it("throws when git config core.hooksPath fails", async () => {
    const run = async (args: string[]) => {
      if (args[0] === "config" && args[1] === "core.hooksPath")
        return { stdout: "", stderr: "not permitted without allowUnsafeHooksPath", code: 128 };
      return { stdout: "", stderr: "", code: 0 };
    };
    const io = { read: async () => null, write: async () => {} };
    await expect(
      applyAuditRepoHooks(run as any, io as any, async () => {}, "/repo"),
    ).rejects.toThrow(/allowUnsafeHooksPath/);
  });
});