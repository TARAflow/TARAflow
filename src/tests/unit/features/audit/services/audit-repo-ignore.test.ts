// Mirror of src/features/audit/services/audit-repo-ignore.ts
// Place at: src/tests/unit/features/audit/services/audit-repo-ignore.test.ts

import { describe, it, expect } from "vitest";
import {
  IGNORE_MANAGED_BLOCK_MARKER,
  taraIgnoreBlock,
  hasManagedBlock,
  withTaraIgnoreAppended,
  gitignorePathOf,
  inspectAuditRepoIgnore,
  applyAuditRepoIgnore,
} from "features/audit/services/audit-repo-ignore";
import type { GitRunner, FileIO } from "features/audit/services/audit-repo-attributes";

// ── injected fakes ───────────────────────────────────────────────────────────
function fakeGit(opts: { ignored?: boolean; tracked?: boolean }) {
  const calls: string[][] = [];
  const run: GitRunner = async (args) => {
    calls.push(args);
    if (args[0] === "check-ignore") {
      return { stdout: "", stderr: "", code: opts.ignored ? 0 : 1 };
    }
    if (args[0] === "ls-files") {
      return { stdout: "", stderr: "", code: opts.tracked ? 0 : 1 };
    }
    if (args[0] === "rm") {
      opts.tracked = false; // simulate untrack
      return { stdout: "", stderr: "", code: 0 };
    }
    return { stdout: "", stderr: "", code: 0 };
  };
  return { run, calls };
}
function fakeIO(seed: Record<string, string> = {}) {
  const store = { ...seed };
  const io: FileIO = {
    read: async (p) => (p in store ? store[p] : null),
    write: async (p, c) => {
      store[p] = c;
    },
  };
  return { io, store };
}

const REPO = "/repo";
const GI = gitignorePathOf(REPO);

describe("audit-repo-ignore — managed block", () => {
  it("block carries the marker and ignores only .tara/hooks/", () => {
    const b = taraIgnoreBlock();
    expect(b).toContain(IGNORE_MANAGED_BLOCK_MARKER);
    expect(b).toContain("/.tara/hooks/");
    expect(b).not.toContain("allowed_signers");
    expect(b).not.toMatch(/^\/?\.tara\/\s*$/m); // never ignores .tara/ wholesale
  });

  it("append is idempotent and preserves existing entries", () => {
    const existing = "*.backup.json\ndiff*.txt\n";
    const once = withTaraIgnoreAppended(existing);
    expect(once).toContain("*.backup.json");
    expect(once).toContain("diff*.txt");
    expect(once).toContain("/.tara/hooks/");
    expect(hasManagedBlock(once)).toBe(true);
    // second application changes nothing
    expect(withTaraIgnoreAppended(once)).toBe(once);
  });

  it("append handles a missing/empty .gitignore", () => {
    expect(withTaraIgnoreAppended(null)).toBe(taraIgnoreBlock());
  });
});

describe("audit-repo-ignore — orchestration", () => {
  it("inspect: not ignored + no block → needsCommit", async () => {
    const { run } = fakeGit({ ignored: false, tracked: false });
    const { io } = fakeIO();
    const st = await inspectAuditRepoIgnore(run, io, REPO, GI);
    expect(st.ok).toBe(false);
    expect(st.managedBlockPresent).toBe(false);
    expect(st.needsCommit).toBe(true);
  });

  it("inspect: ignored + not tracked → ok, no commit", async () => {
    const { run } = fakeGit({ ignored: true, tracked: false });
    const { io } = fakeIO({ [GI]: taraIgnoreBlock() });
    const st = await inspectAuditRepoIgnore(run, io, REPO, GI);
    expect(st.ok).toBe(true);
    expect(st.needsCommit).toBe(false);
  });

  it("apply: writes the block and stages .gitignore", async () => {
    const { run } = fakeGit({ ignored: false, tracked: false });
    const { io, store } = fakeIO({ [GI]: "*.backup.json\n" });
    const res = await applyAuditRepoIgnore(run, io, REPO, GI);
    expect(res.gitignoreChanged).toBe(true);
    expect(res.toStage).toContain(".gitignore");
    expect(store[GI]).toContain("/.tara/hooks/");
    expect(store[GI]).toContain("*.backup.json"); // preserved
  });

  it("apply: un-tracks a previously committed hook and stages the removal", async () => {
    const { run, calls } = fakeGit({ ignored: true, tracked: true });
    const { io } = fakeIO({ [GI]: taraIgnoreBlock() }); // block already present
    const res = await applyAuditRepoIgnore(run, io, REPO, GI);
    expect(res.gitignoreChanged).toBe(false); // block already there
    expect(res.untracked).toBe(true);
    expect(res.toStage).toContain(".tara/hooks/commit-msg");
    expect(calls.some((c) => c[0] === "rm" && c.includes("--cached"))).toBe(true);
  });

  it("apply: nothing to do when already ignored and untracked", async () => {
    const { run } = fakeGit({ ignored: true, tracked: false });
    const { io } = fakeIO({ [GI]: taraIgnoreBlock() });
    const res = await applyAuditRepoIgnore(run, io, REPO, GI);
    expect(res.gitignoreChanged).toBe(false);
    expect(res.untracked).toBe(false);
    expect(res.toStage).toEqual([]);
  });
});
