// ==================== SSH IN BATCH MODE — TESTS ====================
// 0.20.1 (user 2026-11-27): Resolve of a source reference over SSH asked for
// a password in the terminal that started TARAflow and waited until its
// timeout — GIT_TERMINAL_PROMPT=0 stops git's prompts, not ssh's. The calls
// that reach a remote run ssh with BatchMode now, unless the user runs ssh
// their own way (GIT_SSH_COMMAND, GIT_SSH, core.sshCommand).
//
// End to end with a fake `ssh` first on PATH: it records its arguments and
// refuses like a host without a usable key. POSIX only (a shell script).
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SSH_BATCH_COMMAND, userGitEnvironment, withSshBatchMode, withSshBatchModeIf } from "../services/git-environment";
import { remoteHint, resolveRemoteRef } from "../ipc/remote-ref";
import { runFixedGitOp } from "../ipc/git-fixed-ops";

const ISOLATED = { PATH: process.env.PATH ?? "", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

describe("withSshBatchModeIf", () => {
  const user = userGitEnvironment(ISOLATED);

  it("no ssh setup of the user's own: GIT_SSH_COMMAND with BatchMode, let through simple-git's guard", () => {
    const r = withSshBatchModeIf(user, null);
    expect(r.env.GIT_SSH_COMMAND).toBe(SSH_BATCH_COMMAND);
    expect(r.options.allowEnvironment).toContain("GIT_SSH_COMMAND");
    expect(user.env.GIT_SSH_COMMAND).toBeUndefined(); // not changed in place
  });

  it("GIT_SSH_COMMAND, GIT_SSH or core.sshCommand of the user: left as it is", () => {
    for (const extra of [{ GIT_SSH_COMMAND: "ssh -i /k" }, { GIT_SSH: "/usr/bin/plink" }]) {
      const own = userGitEnvironment({ ...ISOLATED, ...extra });
      expect(withSshBatchModeIf(own, null)).toBe(own);
    }
    expect(withSshBatchModeIf(user, "ssh -i /opt/keys/k")).toBe(user);
  });
});

describe("withSshBatchMode — core.sshCommand looked up as the call sees it", () => {
  let repo = "";
  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "ssh-batch-repo-"));
    execFileSync("git", ["init", "-q"], { cwd: repo });
  });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it("nowhere set: BatchMode", async () => {
    expect((await withSshBatchMode(userGitEnvironment(ISOLATED), repo)).env.GIT_SSH_COMMAND).toBe(SSH_BATCH_COMMAND);
  });

  it("set through the environment's git configuration: untouched", async () => {
    const user = userGitEnvironment({ ...ISOLATED, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.sshCommand", GIT_CONFIG_VALUE_0: "ssh -i /opt/keys/k" });
    expect((await withSshBatchMode(user, repo)).env.GIT_SSH_COMMAND).toBeUndefined();
  });

  it("set in the repository's own configuration: untouched there", async () => {
    const own = mkdtempSync(join(tmpdir(), "ssh-batch-own-"));
    execFileSync("git", ["init", "-q"], { cwd: own });
    execFileSync("git", ["config", "core.sshCommand", "ssh -i /opt/keys/k"], { cwd: own });
    expect((await withSshBatchMode(userGitEnvironment(ISOLATED), own)).env.GIT_SSH_COMMAND).toBeUndefined();
    rmSync(own, { recursive: true, force: true });
  });
});

describe("remoteHint", () => {
  it("host key and refused key; anything else none", () => {
    expect(remoteHint("Host key verification failed.\nfatal: Could not read from remote repository.")).toBe("host_key");
    expect(remoteHint("git@ssh.dev.azure.com: Permission denied (publickey).")).toBe("ssh_key");
    expect(remoteHint("remote: Repository not found.")).toBeUndefined();
  });
});

describe.skipIf(process.platform === "win32")("end to end with a fake ssh", () => {
  let bin = "";
  let log = "";
  const saved: Record<string, string | undefined> = {};
  const set = (k: string, v: string | undefined) => {
    if (!(k in saved)) saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  };

  beforeAll(() => {
    bin = mkdtempSync(join(tmpdir(), "fake-ssh-"));
    log = join(bin, "args.log");
    const script = join(bin, "ssh");
    writeFileSync(script, `#!/bin/sh\necho "$@" >> "${log}"\necho "git@fake.invalid: Permission denied (publickey)." >&2\nexit 255\n`);
    chmodSync(script, 0o755);
    // the machine's git setup out of the way, the fake ssh first on PATH
    for (const k of Object.keys(process.env).filter((k) => /^GIT_/.test(k))) set(k, undefined);
    set("GIT_CONFIG_GLOBAL", "/dev/null");
    set("GIT_CONFIG_NOSYSTEM", "1");
    set("PATH", `${bin}:${process.env.PATH ?? ""}`);
  });
  beforeEach(() => writeFileSync(log, ""));
  afterAll(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(bin, { recursive: true, force: true });
  });

  it("Resolve: ssh runs in BatchMode; the refusal is no_access with the key hint", async () => {
    const r = await resolveRemoteRef("git@fake.invalid:team/repo.git", "main", 10_000);
    expect(readFileSync(log, "utf8")).toContain("-o BatchMode=yes");
    expect(r.data).toMatchObject({ reachable: false, failure: "no_access", hint: "ssh_key" });
  });

  it("Resolve with the user's own GIT_SSH_COMMAND: that one, without BatchMode", async () => {
    set("GIT_SSH_COMMAND", "ssh -o Marker=own");
    try {
      await resolveRemoteRef("git@fake.invalid:team/repo.git", "main", 10_000);
      const args = readFileSync(log, "utf8");
      expect(args).toContain("-o Marker=own");
      expect(args).not.toContain("BatchMode");
    } finally {
      set("GIT_SSH_COMMAND", undefined);
    }
  });

  it("the component fetch (fetchTags): ssh in BatchMode", async () => {
    const repo = mkdtempSync(join(tmpdir(), "fetch-tags-"));
    execFileSync("git", ["init", "-q"], { cwd: repo });
    execFileSync("git", ["remote", "add", "origin", "git@fake.invalid:team/repo.git"], { cwd: repo });
    const r = await runFixedGitOp("fetchTags", repo);
    expect(r.code).not.toBe(0);
    expect(readFileSync(log, "utf8")).toContain("-o BatchMode=yes");
    rmSync(repo, { recursive: true, force: true });
  });
});
