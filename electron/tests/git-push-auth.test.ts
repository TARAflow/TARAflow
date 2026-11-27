// ==================== CREDENTIALS OF A PUSH — TESTS ====================
// Roadmap 0.20: the SSH key field reaches the push (core.sshCommand for one
// call, the user's GIT_SSH_COMMAND / GIT_SSH win); a personal access token
// goes into one call as an HTTP header, never into the stored remote URL;
// a URL that still carries a token from an earlier push is cleaned.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { simpleGit } from "simple-git";
import { pushAuthConfig, storedUrlRepair } from "../services/git-push-auth";
import { userGitEnvironment } from "../services/git-environment";

const HTTPS = "https://git.example.com/team/audit.git";

describe("pushAuthConfig — SSH key field", () => {
  it("method ssh with a key: core.sshCommand with the quoted path, IdentitiesOnly and BatchMode", () => {
    expect(pushAuthConfig({ method: "ssh", sshKeyPath: "/opt/keys/id_audit", env: {} }).config).toEqual([
      "core.sshCommand=ssh -i '/opt/keys/id_audit' -o IdentitiesOnly=yes -o BatchMode=yes",
    ]);
  });

  it("a path with spaces and a quote stays one word for the shell", () => {
    const [entry] = pushAuthConfig({ method: "ssh", sshKeyPath: "C:/Users/Jo O'Neil/.ssh/key", env: {} }).config;
    expect(entry).toBe(`core.sshCommand=ssh -i 'C:/Users/Jo O'\\''Neil/.ssh/key' -o IdentitiesOnly=yes -o BatchMode=yes`);
  });

  it("GIT_SSH_COMMAND or GIT_SSH in the environment win — the field is not applied", () => {
    for (const env of [{ GIT_SSH_COMMAND: "ssh -i /k" }, { GIT_SSH: "/usr/bin/plink" }]) {
      expect(pushAuthConfig({ method: "ssh", sshKeyPath: "/k2", env })).toEqual({ config: [], sshKeySkipped: "environment" });
    }
  });

  it("an empty field, method pat, or a path with a line break: nothing", () => {
    expect(pushAuthConfig({ method: "ssh", sshKeyPath: "  ", env: {} }).config).toEqual([]);
    expect(pushAuthConfig({ method: "pat", sshKeyPath: "/k", env: {} }).config).toEqual([]);
    expect(pushAuthConfig({ method: "ssh", sshKeyPath: "/k\n-o ProxyCommand=evil", env: {} })).toEqual({ config: [], sshKeySkipped: "invalid" });
  });
});

describe("pushAuthConfig — personal access token", () => {
  it("an https remote: the token as Basic credentials (user = token, as the URL carried it)", () => {
    const [entry] = pushAuthConfig({ method: "pat", token: "ghp_abc", remoteUrl: HTTPS, env: {} }).config;
    expect(entry).toBe(`http.extraHeader=Authorization: Basic ${Buffer.from("ghp_abc:").toString("base64")}`);
  });

  it("no token, or an ssh remote: nothing", () => {
    expect(pushAuthConfig({ method: "pat", token: null, remoteUrl: HTTPS, env: {} }).config).toEqual([]);
    expect(pushAuthConfig({ method: "pat", token: "t", remoteUrl: "git@github.com:team/audit.git", env: {} }).config).toEqual([]);
  });
});

describe("storedUrlRepair", () => {
  it("a token stored by an earlier push is removed", () => {
    expect(storedUrlRepair("https://ghp_abc@git.example.com/team/audit.git")).toBe(HTTPS);
    expect(storedUrlRepair("https://user:ghp_abc@git.example.com/team/audit.git")).toBe(HTTPS);
  });

  it("a clean URL or an scp-style ssh remote: nothing to repair", () => {
    expect(storedUrlRepair(HTTPS)).toBeNull();
    expect(storedUrlRepair("git@github.com:team/audit.git")).toBeNull();
    expect(storedUrlRepair(undefined)).toBeNull();
  });
});

describe("a push with the per-call configuration (real git, local remote)", () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

  it("simple-git accepts both entries, the push succeeds, the repository stores neither", async () => {
    const remote = mkdtempSync(join(tmpdir(), "push-remote-"));
    const work = mkdtempSync(join(tmpdir(), "push-work-"));
    dirs.push(remote, work);
    const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd }).toString().trim();
    git(remote, "init", "-q", "--bare");
    git(work, "init", "-q", "-b", "main");
    git(work, "config", "user.email", "t@example.com");
    git(work, "config", "user.name", "T");
    git(work, "config", "commit.gpgsign", "false");
    writeFileSync(join(work, "a.txt"), "1");
    git(work, "add", "a.txt");
    git(work, "commit", "-q", "-m", "first");
    git(work, "remote", "add", "origin", remote);

    const user = userGitEnvironment();
    const config = [
      ...pushAuthConfig({ method: "pat", token: "t0ken", remoteUrl: "https://x/y.git", env: {} }).config,
      ...pushAuthConfig({ method: "ssh", sshKeyPath: "/nonexistent/key", env: {} }).config,
    ];
    await simpleGit({ baseDir: work, ...user.options, config }).env(user.env).push(["origin", "main", "--set-upstream"]);

    expect(git(remote, "rev-parse", "main")).toBe(git(work, "rev-parse", "HEAD"));
    const stored = git(work, "config", "--list", "--local");
    expect(stored).not.toMatch(/extraheader|sshcommand|t0ken/i);
  });
});
