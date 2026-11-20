// ==================== GIT CALLS WITH FIXED ARGUMENTS — TESTS ====================
// Roadmap 0.20: the repository changes the renderer needs run through
// git:fixedOp with arguments fixed in the main process; the renderer's
// adapter maps exactly its old argument lists onto them.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FIXED_GIT_OPS, isFixedGitOp, runFixedGitOp } from "../ipc/git-fixed-ops";
import { refuseGitArgs } from "../ipc/git-arg-policy";
import { fixedOpOf } from "../../src/features/audit/services/audit-git-adapters";

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("fixed git operations", () => {
  it("the renderer adapter maps exactly the main process's argument lists", () => {
    for (const [op, args] of Object.entries(FIXED_GIT_OPS)) expect(fixedOpOf([...args])).toBe(op);
    expect(fixedOpOf(["config", "core.hooksPath", "/tmp/evil"])).toBeUndefined();
    expect(fixedOpOf(["fetch", "--quiet", "--tags", "--upload-pack=x"])).toBeUndefined();
  });

  it("none of them passes the read-only policy — they need their own channel", () => {
    for (const args of Object.values(FIXED_GIT_OPS)) expect(refuseGitArgs([...args])).toEqual(expect.any(String));
  });

  it("only the known operation names", () => {
    expect(isFixedGitOp("setHooksPath")).toBe(true);
    expect(isFixedGitOp("raw")).toBe(false);
    expect(isFixedGitOp("toString")).toBe(false);
    expect(isFixedGitOp(undefined)).toBe(false);
  });

  it("initRepo and setHooksPath do what their name says, with the fixed value", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fixed-ops-"));
    dirs.push(dir);
    expect((await runFixedGitOp("initRepo", dir)).code).toBe(0);
    expect((await runFixedGitOp("setHooksPath", dir)).code).toBe(0);
    expect(execFileSync("git", ["config", "--get", "core.hooksPath"], { cwd: dir }).toString().trim()).toBe(FIXED_GIT_OPS.setHooksPath[2]);
    // untracking a hook file that is not tracked: --ignore-unmatch, exit 0
    expect((await runFixedGitOp("untrackHookFile", dir)).code).toBe(0);
  });
});
