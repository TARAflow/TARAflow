// ==================== THE USER'S GIT ENVIRONMENT — TESTS ====================
// Roadmap 0.20: the fixed-argument git calls (GitService, Resolve, the
// component fetch) inherit a fixed list of the user's git variables — and
// nothing else of simple-git's guarded set.
import { describe, expect, it } from "vitest";
import { simpleGit } from "simple-git";
import { userGitEnvironment } from "../services/git-environment";

const SOURCE = {
  PATH: "/usr/bin:/bin",
  HOME: "/home/test",
  SSH_AUTH_SOCK: "/tmp/agent",
  HTTPS_PROXY: "http://proxy:3128",
  GIT_SSH_COMMAND: "ssh -o StrictHostKeyChecking=yes",
  GIT_SSL_CAINFO: "/etc/ca.pem",
  GIT_ASKPASS: "/usr/bin/askpass",
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "url.https://mirror.example/.insteadOf",
  GIT_CONFIG_VALUE_0: "https://github.invalid/",
  GIT_EXEC_PATH: "/tmp/evil",
  GIT_PROXY_COMMAND: "/tmp/evil",
  GIT_TEMPLATE_DIR: "/tmp/evil",
  GIT_EXTERNAL_DIFF: "/tmp/evil",
  EDITOR: "vim",
  PAGER: "less",
  GIT_TERMINAL_PROMPT: "1",
};

describe("userGitEnvironment", () => {
  const { env, options } = userGitEnvironment(SOURCE);

  it("keeps the allowlisted git variables and everything outside the guard", () => {
    for (const k of ["PATH", "HOME", "SSH_AUTH_SOCK", "HTTPS_PROXY", "GIT_SSH_COMMAND", "GIT_SSL_CAINFO", "GIT_ASKPASS", "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0"])
      expect(env[k], k).toBe(SOURCE[k as keyof typeof SOURCE]);
  });

  it("drops the rest of the guarded set (exec path, proxy command, template dir, external diff, editor, pager)", () => {
    for (const k of ["GIT_EXEC_PATH", "GIT_PROXY_COMMAND", "GIT_TEMPLATE_DIR", "GIT_EXTERNAL_DIFF", "EDITOR", "PAGER"]) expect(env[k], k).toBeUndefined();
  });

  it("never prompts", () => {
    expect(env.GIT_TERMINAL_PROMPT).toBe("0");
  });

  it("names exactly the guarded variables it passes in allowEnvironment", () => {
    expect([...(options.allowEnvironment ?? [])].sort()).toEqual(
      ["GIT_ASKPASS", "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_SSH_COMMAND", "GIT_SSL_CAINFO", "GIT_TERMINAL_PROMPT"].sort(),
    );
  });

  it("simple-git accepts the result (no guard or unsafe error before git runs)", async () => {
    const r = await simpleGit(process.cwd(), options).env({ ...env, PATH: process.env.PATH ?? "" }).raw(["--version"]);
    expect(r).toMatch(/^git version/);
  });
});
