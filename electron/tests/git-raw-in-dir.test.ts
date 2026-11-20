// ==================== RAW GIT IN A DIRECTORY — TESTS ====================
// `git:rawInDir` must report the REAL exit code, also for a "no" that git
// gives without any stderr output (merge-base --is-ancestor, rev-parse
// --verify --quiet). simple-git took those for success, and the drift check
// of an imported component reported "up to date" for a newer commit
// (manual test 2026-11-16).
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawGitInDir } from "../ipc/git-raw-in-dir";

let dir = "";
let first = "";
let second = "";
const git = (...args: string[]) => {
  try {
    return execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return ""; // config --get of an unset key exits 1
  }
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "raw-in-dir-"));
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  writeFileSync(join(dir, "a.txt"), "1");
  git("add", "a.txt");
  git("commit", "-q", "-m", "first");
  first = git("rev-parse", "HEAD");
  writeFileSync(join(dir, "a.txt"), "2");
  git("commit", "-q", "-am", "second");
  second = git("rev-parse", "HEAD");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("rawGitInDir", () => {
  it("success: exit 0 with the output", async () => {
    const r = await rawGitInDir(dir, ["rev-parse", "HEAD"]);
    expect(r).toMatchObject({ code: 0 });
    expect(r.stdout.trim()).toBe(second);
  });

  it("a silent 'no' keeps its exit code 1 (merge-base --is-ancestor)", async () => {
    expect((await rawGitInDir(dir, ["merge-base", "--is-ancestor", first, second])).code).toBe(0);
    expect((await rawGitInDir(dir, ["merge-base", "--is-ancestor", second, first])).code).toBe(1);
  });

  it("rev-parse --verify --quiet of a missing ref: exit 1, no output", async () => {
    const r = await rawGitInDir(dir, ["rev-parse", "--verify", "--quiet", "nope^{commit}"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toBe("");
  });

  it("a failure with a message keeps it in stderr and never throws", async () => {
    const r = await rawGitInDir(dir, ["show", "nope:x"]);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toMatch(/nope/);
  });
});

describe("rawGitInDir — read-only (roadmap 0.20)", () => {
  it("refuses a hooks path through -c and never runs it: code 128, the reason in stderr", async () => {
    const r = await rawGitInDir(dir, ["-c", "core.hooksPath=/tmp/evil", "status"]);
    expect(r.code).toBe(128);
    expect(r.stderr).toMatch(/^refused: /);
  });

  it("refuses setting a config value — the repository's config stays unchanged", async () => {
    const r = await rawGitInDir(dir, ["config", "core.hooksPath", "/tmp/evil"]);
    expect(r.code).toBe(128);
    expect(git("config", "--get", "core.hooksPath") || "").toBe("");
  });
});
