// ==================== GIT ARGUMENT POLICY — TESTS ====================
// Characterization first: every git call the renderer makes today through
// git:rawInDir / git:raw (inventory 2026-11-20) must stay allowed — then the
// refusals of the hardening (roadmap 0.20, review 2026-11-20).
import { describe, expect, it } from "vitest";
import { refuseGitArgs } from "../ipc/git-arg-policy";

const SHA = "e68d84da75045293f91cdbfb007c10dee0bfaa60";

/** The read calls of the renderer, by caller. */
const TODAY: [string, string[]][] = [
  // component import / drift (component-source.ts, component-drift.ts, component-paths.ts)
  ["component", ["rev-parse", "--show-toplevel"]],
  ["component", ["rev-parse", "--show-prefix"]],
  ["component", ["remote", "get-url", "origin"]],
  ["component", ["ls-files", "--error-unmatch", "--", "import-example/SmokeDetectorCase.tara.json"]],
  ["component", ["status", "--porcelain", "--", "SmokeDetectorCase.tara.json"]],
  ["component", ["rev-parse", "HEAD"]],
  ["component", ["rev-parse", "--abbrev-ref", "HEAD"]],
  ["component", ["tag", "--points-at", "HEAD"]],
  ["component", ["tag", "--points-at", "HEAD", "--list", "v*", "--sort=-v:refname"]],
  ["component", ["tag", "--list", "v*", "--sort=-v:refname"]],
  ["component", ["show", "HEAD:SmokeDetectorCase.tara.json"]],
  ["component", ["show", `${SHA}:import-example/SmokeDetectorCase.tara.json`]],
  ["component", ["rev-parse", "--verify", "--quiet", "origin/main"]],
  ["component", ["rev-parse", "--verify", "--quiet", "v1.2^{commit}"]],
  ["component", ["cat-file", "-e", `${SHA}^{commit}`]],
  ["component", ["merge-base", "--is-ancestor", SHA, "HEAD"]],
  // audit repository (audit-repo-*.ts, project-repository.ts)
  ["audit", ["rev-parse", "--is-inside-work-tree"]],
  ["audit", ["check-attr", "merge", "diff", "--", ".tara/probe.tara.json"]],
  ["audit", ["check-ignore", "-q", ".tara/hooks/probe"]],
  ["audit", ["ls-files", "--error-unmatch", ".tara/hooks/commit-msg"]],
  ["audit", ["config", "--get", "core.hooksPath"]],
  ["audit", ["config", "--get", "user.signingkey"]],
  // bound audit repository via git:raw (audit-tab, derive-audit-config, useAuditProtection, audit-prev-state, verification-commits)
  ["git:raw", ["log", "-1", "--format=%cI", "--", "project.tara.json"]],
  ["git:raw", ["config", "user.name"]],
  ["git:raw", ["config", "user.email"]],
  ["git:raw", ["config", "user.signingkey"]],
  ["git:raw", ["config", "gpg.format"]],
  ["git:raw", ["config", "commit.gpgsign"]],
  ["git:raw", ["rev-parse", "--abbrev-ref", "origin/HEAD"]],
  ["git:raw", ["log", "--format=%H", "--diff-filter=A", "--", ".tara/allowed_signers"]],
  ["git:raw", ["log", "--format=%H %G?", "audit-root..HEAD"]],
  ["git:raw", ["log", "--merges", "--format=%H", "audit-root..HEAD"]],
  ["git:raw", ["rev-list", "-n", "1", "audit-root"]],
  ["git:raw", ["rev-list", "--topo-order", "main"]],
  ["git:raw", ["show", "HEAD:project.tara.json"]],
  ["git:raw", ["status", "--porcelain", "--", "project.tara.json"]],
  ["git:raw", ["show", "HEAD:.tara/allowed_signers"]],
  ["git:raw", ["log", "HEAD", "--diff-filter=A", "--format=%H", "--", ".tara/allowed_signers"]],
  ["git:raw", ["log", "--format=%h", "--reverse", "-Sver-123", "--", "project.tara.json"]],
  ["git:raw", ["symbolic-ref", "-q", "HEAD"]],
];

describe("git argument policy — today's read calls stay allowed (characterization)", () => {
  it.each(TODAY)("%s: git %s", (_caller, args) => {
    expect(refuseGitArgs(args)).toBeNull();
  });
});

const REFUSED: [string, unknown][] = [
  // global options before the subcommand
  ["-c core.hooksPath (the XSS → code execution path)", ["-c", "core.hooksPath=/tmp/evil", "status"]],
  ["--config-env", ["--config-env=core.sshCommand=EVIL", "status"]],
  ["-C another directory", ["-C", "/tmp", "status"]],
  ["--git-dir", ["--git-dir=/tmp/x", "status"]],
  ["--exec-path", ["--exec-path=/tmp", "status"]],
  // subcommands that change something or reach out
  ["config set core.hooksPath", ["config", "core.hooksPath", "/tmp/evil"]],
  ["config set core.sshCommand", ["config", "core.sshCommand", "evil"]],
  ["config --unset", ["config", "--unset", "user.name"]],
  ["config --global edit", ["config", "--global", "--edit"]],
  ["fetch (own channel)", ["fetch", "--quiet", "--tags"]],
  ["fetch --upload-pack", ["fetch", "--upload-pack=touch /tmp/x", "origin"]],
  ["init (own channel)", ["init"]],
  ["rm --cached (own channel)", ["rm", "--cached", "--ignore-unmatch", ".tara/hooks/commit-msg"]],
  ["push", ["push", "origin", "main"]],
  ["commit", ["commit", "-m", "x"]],
  ["clone", ["clone", "ext::sh -c touch% /tmp/x", "/tmp/y"]],
  ["ls-remote --upload-pack", ["ls-remote", "--upload-pack=x", "origin"]],
  ["submodule", ["submodule", "foreach", "touch /tmp/x"]],
  ["remote add", ["remote", "add", "x", "/tmp/x"]],
  ["remote set-url", ["remote", "set-url", "origin", "/tmp/x"]],
  ["tag create", ["tag", "v9"]],
  ["tag delete", ["tag", "-d", "v1"]],
  ["tag --list -d", ["tag", "--list", "-d", "v1"]],
  ["symbolic-ref write", ["symbolic-ref", "HEAD", "refs/heads/evil"]],
  // options that run a program or write a file
  ["log --output", ["log", "--output=/tmp/x"]],
  ["show --ext-diff", ["show", "--ext-diff", "HEAD"]],
  ["cat-file --textconv", ["cat-file", "--textconv", "HEAD:a"]],
  ["cat-file --filters", ["cat-file", "--filters", "HEAD:a"]],
  ["log -c after the subcommand", ["log", "-c", "core.pager=evil"]],
  // malformed
  ["no arguments", []],
  ["not an array", "status"],
  ["a non-string argument", ["status", 1]],
];

describe("git argument policy — refused", () => {
  it.each(REFUSED)("%s", (_label, args) => {
    expect(refuseGitArgs(args)).toEqual(expect.any(String));
  });
});

describe("abbreviated long options (review 2026-11-21)", () => {
  it("an unambiguous abbreviation of a forbidden option is refused — git would expand it", () => {
    // git 2.39 / 2.43 accept "--fi" (--filters) and "--te" (--textconv) too
    for (const arg of ["--fi", "--te", "--filt", "--filte", "--textc", "--outp=x", "--upload-p=sh", "--ext-d", "--work-t=/tmp", "--o"]) {
      expect(refuseGitArgs(["cat-file", arg, "HEAD:file"]), arg).not.toBeNull();
    }
  });

  it("real options that are a prefix stay allowed; short or unrelated names are not touched", () => {
    expect(refuseGitArgs(["log", "--text", "-1"])).toBeNull();
    expect(refuseGitArgs(["log", "--format=%H", "-1"])).toBeNull();
    expect(refuseGitArgs(["log", "--oneline", "-1"])).toBeNull();
    // a name that is no prefix of a forbidden option
    expect(refuseGitArgs(["log", "--reverse", "-1"])).toBeNull();
    // "--" alone ends the options
    expect(refuseGitArgs(["log", "-1", "--", "file"])).toBeNull();
  });
});
