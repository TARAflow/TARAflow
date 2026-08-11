// ======== AUDIT VERIFY (main) — integration test ========
// Exercises runAuditVerify against a real throwaway repo. Requires a git binary.
// Suggested location: electron/services/audit-verify-main.test.ts (or your
// integration test tree). Signature crypto (good/bad) needs SSH keys and is
// covered by the real fixtures; here an UNSIGNED anchor with no maintainer must
// yield success:true + data.result === "fail".
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAuditVerify } from "../services/audit-verify-main";

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", ["-C", cwd, ...args], { encoding: "utf8" }, (err, stdout) =>
      err ? reject(err) : resolve(stdout),
    );
  });
}

describe("runAuditVerify", () => {
  let dir: string;
  let anchor: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "audit-verify-"));
    await git(dir, ["init", "-q", "-b", "main"]);
    await git(dir, ["config", "user.name", "T"]);
    await git(dir, ["config", "user.email", "t@x"]);
    await git(dir, ["config", "commit.gpgsign", "false"]);
    await mkdir(join(dir, ".tara"), { recursive: true });
    // manifest introduces a signer but NO maintainer → trail must fail
    await writeFile(
      join(dir, ".tara/allowed_signers"),
      'ks@x namespaces="git" ssh-ed25519 AAAAKS x\n',
    );
    await git(dir, ["add", ".tara/allowed_signers"]);
    await git(dir, ["commit", "-q", "-m", "audit: bootstrap"]);
    anchor = (await git(dir, ["rev-parse", "HEAD"])).trim();
  });

  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("returns success:false when no repo path is available", async () => {
    const r = await runAuditVerify({ policy: { bootstrapAnchor: "x" } });
    expect(r.success).toBe(false);
  });

  it("returns success:false when the anchor is missing", async () => {
    const r = await runAuditVerify({ policy: {} as any }, dir);
    expect(r.success).toBe(false);
  });

  it("uses the bound repo path when repoPath is omitted", async () => {
    const r = await runAuditVerify(
      { policy: { bootstrapAnchor: anchor, ref: "main" } },
      dir,
    );
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.aveVersion).toBe(1);
  });

  it("runs the engine and reports a failing trail as success:true + data.result=fail", async () => {
    const r = await runAuditVerify({
      repoPath: dir,
      policy: { bootstrapAnchor: anchor, ref: "main" },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.result).toBe("fail");
      expect(r.data.findings.some((f) => f.id === "MANIFEST_NO_MAINTAINER")).toBe(
        true,
      );
    }
  });

  it("surfaces an unresolvable ref as an ENGINE_ERROR finding (engine ran)", async () => {
    const r = await runAuditVerify({
      repoPath: dir,
      policy: { bootstrapAnchor: anchor, ref: "does-not-exist" },
    });
    expect(r.success).toBe(true); // the engine RAN; the error is a finding
    if (r.success) {
      expect(r.data.findings.some((f) => f.id === "ENGINE_ERROR")).toBe(true);
    }
  });
});
