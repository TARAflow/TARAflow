// ==================== GIT SIGNING — TESTS ====================
// If you use Jest with globals, delete the next import line.
import { describe, it, expect } from "vitest";
import { resolveGitSigning, signingFromConfig } from "../services/git-signing";
import type { AuditConfig } from "features/audit/models/audit-types";

const find = (config: Array<[string, string]>, key: string) =>
  config.find(([k]) => k === key)?.[1];

describe("resolveGitSigning", () => {
  it("signs with GPG when enabled, key present, toggle on", () => {
    const r = resolveGitSigning(
      { enabled: true, format: "gpg", keyId: "ABCD1234" },
      true,
    );
    expect(r.sign).toBe(true);
    expect(find(r.config, "commit.gpgsign")).toBe("true");
    expect(find(r.config, "gpg.format")).toBe("openpgp");
    expect(find(r.config, "user.signingkey")).toBe("ABCD1234");
  });

  it("signs with SSH when enabled, key path present, toggle on", () => {
    const r = resolveGitSigning(
      { enabled: true, format: "ssh", sshSigningKeyPath: "~/.ssh/id_ed25519" },
      true,
    );
    expect(r.sign).toBe(true);
    expect(find(r.config, "gpg.format")).toBe("ssh");
    expect(find(r.config, "user.signingkey")).toBe("~/.ssh/id_ed25519");
    expect(find(r.config, "commit.gpgsign")).toBe("true");
  });

  it("does not sign when the per-commit toggle is off", () => {
    const r = resolveGitSigning(
      { enabled: true, format: "ssh", sshSigningKeyPath: "k" },
      false,
    );
    expect(r.sign).toBe(false);
    expect(find(r.config, "commit.gpgsign")).toBe("false");
    expect(r.config).toHaveLength(1); // no signingkey/format leaked
  });

  it("does not sign (and does not claim to) when the key is missing", () => {
    const r = resolveGitSigning({ enabled: true, format: "gpg" }, true);
    expect(r.sign).toBe(false);
    expect(find(r.config, "commit.gpgsign")).toBe("false");
    expect(r.config).toHaveLength(1);
  });

  it("does not sign when signing is disabled", () => {
    const r = resolveGitSigning(
      { enabled: false, format: "ssh", sshSigningKeyPath: "k" },
      true,
    );
    expect(r.sign).toBe(false);
    expect(find(r.config, "commit.gpgsign")).toBe("false");
  });
});

describe("signingFromConfig", () => {
  it("falls back to the legacy gpg block (format gpg)", () => {
    const cfg = { gpg: { enabled: true, keyId: "KID" } } as AuditConfig;
    const s = signingFromConfig(cfg);
    expect(s).toEqual({ enabled: true, format: "gpg", keyId: "KID" });
  });

  it("prefers the new signing block when present", () => {
    const cfg = {
      signing: { enabled: true, format: "ssh", sshSigningKeyPath: "p" },
      gpg: { enabled: false },
    } as AuditConfig;
    const s = signingFromConfig(cfg);
    expect(s.format).toBe("ssh");
    expect(s.sshSigningKeyPath).toBe("p");
  });

  it("treats a missing gpg block as disabled", () => {
    const s = signingFromConfig({} as AuditConfig);
    expect(s.enabled).toBe(false);
    expect(s.format).toBe("gpg");
  });
});
