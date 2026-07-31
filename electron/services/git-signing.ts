// ==================== GIT SIGNING (pure) ====================
// The single decision point for HOW a commit gets signed. Given the signing
// settings + the per-commit toggle, it returns the exact `git config` key/values
// to apply and whether the commit will actually be signed. Pure and testable;
// git-service-main applies the result.
//
// Supports both formats (design §5.B): SSH signing (default, git ≥ 2.34) and GPG.
//
// Types SigningFormat / SigningSettings and the optional `AuditConfig.signing`
// field are added in audit-types.ts (see signing-wiring.patch.md).

import type { AuditConfig, SigningSettings } from "audit/models/audit-types";

export interface GitSignDecision {
  /** Whether this commit will carry a signature. */
  sign: boolean;
  /** `git config` key/value pairs to apply before committing (in order). */
  config: Array<[string, string]>;
}

/**
 * Read the effective signing settings from a config, falling back to the legacy
 * `gpg` block so existing projects keep working (format defaults to "gpg").
 */
export function signingFromConfig(config: AuditConfig): SigningSettings {
  if (config.signing) return config.signing;
  return {
    enabled: !!config.gpg?.enabled,
    format: "gpg",
    keyId: config.gpg?.keyId,
  };
}

/**
 * Decide the git signing configuration.
 *
 * A commit is signed only when signing is enabled AND the per-commit toggle is
 * on AND a key for the chosen format is present. Otherwise `commit.gpgsign` is
 * explicitly set false — never claim a signature we can't produce.
 */
export function resolveGitSigning(
  s: SigningSettings,
  signThisCommit: boolean,
): GitSignDecision {
  const hasKey = s.format === "ssh" ? !!s.sshSigningKeyPath : !!s.keyId;
  const sign = !!s.enabled && !!signThisCommit && hasKey;

  const config: Array<[string, string]> = [
    ["commit.gpgsign", sign ? "true" : "false"],
  ];

  if (sign && s.format === "ssh") {
    config.push(["gpg.format", "ssh"]);
    config.push(["user.signingkey", s.sshSigningKeyPath as string]);
  } else if (sign && s.format === "gpg") {
    // reset gpg.format in case a previous op left it on "ssh"
    config.push(["gpg.format", "openpgp"]);
    config.push(["user.signingkey", s.keyId as string]);
  }

  return { sign, config };
}
