// ==================== RESOLVE A REMOTE REF — TESTS ====================
// Manual test 2026-11-17: "Resolve" on a source reference said "Could not
// reach <host>" for every failure. git's message is classified now, git
// never waits on a prompt, and the message carries no credentials.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classifyRemoteError, resolveRemoteRef } from "../ipc/remote-ref";

let dir = "";
let head = "";
const git = (...args: string[]) => execFileSync("git", args, { cwd: dir }).toString().trim();

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "remote-ref-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  writeFileSync(join(dir, "a.txt"), "1");
  git("add", "a.txt");
  git("commit", "-q", "-m", "first");
  head = git("rev-parse", "HEAD");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("classifyRemoteError", () => {
  it.each([
    ["remote: Repository not found.\nfatal: repository 'https://github.com/o/x.git/' not found", "not_found"],
    ["fatal: '/tmp/nope' does not appear to be a git repository", "not_found"],
    ["fatal: could not read Username for 'https://github.com': terminal prompts disabled", "no_access"],
    ["git@github.com: Permission denied (publickey).", "no_access"],
    ["fatal: unable to access 'https://h/x.git/': The requested URL returned error: 403", "no_access"],
    ["fatal: unable to access 'https://h/x.git/': Could not resolve host: h", "offline"],
    ["ssh: connect to host h port 22: Connection timed out", "offline"],
    ["fatal: unable to access 'https://127.0.0.1:1/x.git/': Failed to connect to 127.0.0.1 port 1: Connection refused", "offline"],
    ["block timeout reached", "timeout"],
    ["something else", "unknown"],
  ])("%s → %s", (message, failure) => {
    expect(classifyRemoteError(message)).toBe(failure);
  });
});

describe("resolveRemoteRef", () => {
  it("a reachable repository: the ref's commit", async () => {
    const r = await resolveRemoteRef(dir, "main");
    expect(r).toMatchObject({ success: true, data: { reachable: true, sha: head } });
  });

  it("reached, but no such ref: sha null", async () => {
    const r = await resolveRemoteRef(dir, "no-such-tag");
    expect(r).toMatchObject({ success: true, data: { reachable: true, sha: null } });
  });

  it("no repository there: not_found", async () => {
    const r = await resolveRemoteRef(join(dir, "missing"), "main");
    expect(r).toMatchObject({ success: false, data: { reachable: false, failure: "not_found" } });
  });

  it("the message carries no credentials of the URL", async () => {
    const r = await resolveRemoteRef("https://user:s3cret@127.0.0.1:1/x.git", "main", 5000);
    expect(r.success).toBe(false);
    expect(r.error ?? "").not.toContain("s3cret");
    expect(r.data.failure).toBe("offline");
  });
});
