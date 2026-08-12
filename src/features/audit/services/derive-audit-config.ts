// ==================== DERIVE AUDIT CONFIG FROM GIT ====================
// Pre-fills the audit config from the opened git repo so the user doesn't
// retype what git already knows: remote URL + provider, author name/email,
// default branch, and signing (format/key). NON-DESTRUCTIVE — only fills fields
// that are still empty or at their package default; a value the user set is
// never overwritten.
//
// Split like the rest of the audit services: a thin reader over the bound
// GitService's `raw` (side-effecting) + a PURE merge (deriveAuditConfigFromGit)
// that is unit-tested without git. The reader targets the BOUND repo, so no
// path arg is needed (mirrors useAuditProtection's git.raw usage).
//
// Lives at: src/features/audit/services/derive-audit-config.ts

import type { GitOperationResult } from "../models/git-types";
import {
  DEFAULT_AUDIT_CONFIG,
  type AuditConfig,
  type GitProvider,
  type SigningFormat,
} from "../models/audit-types";

export interface GitConfigReader {
  raw: (args: string[]) => Promise<GitOperationResult<string>>;
}

export interface GitDerivedInfo {
  remoteUrl?: string;
  provider?: GitProvider;
  authorName?: string;
  authorEmail?: string;
  defaultBranch?: string;
  signing?: {
    format?: SigningFormat;
    enabled?: boolean;
    sshSigningKeyPath?: string;
    keyId?: string;
  };
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Infer the provider from a remote URL host. Unknown hosts → "generic". */
export function inferProviderFromUrl(url: string | undefined): GitProvider {
  if (!url) return "generic";
  const u = url.toLowerCase();
  if (u.includes("github.com")) return "github";
  if (u.includes("gitlab")) return "gitlab";
  if (u.includes("bitbucket")) return "bitbucket";
  // Azure DevOps (ssh.dev.azure.com / visualstudio.com), self-hosted, etc.
  return "generic";
}

/** `origin/main` → `main`; passthrough for a bare branch; null stays null. */
function stripOriginPrefix(ref: string | null): string | undefined {
  if (!ref) return undefined;
  const m = /^origin\/(.+)$/.exec(ref.trim());
  return (m ? m[1] : ref.trim()) || undefined;
}

// ── Reader (side-effecting, thin) ────────────────────────────────────────────

async function readValue(
  git: GitConfigReader,
  args: string[],
): Promise<string | null> {
  const res = await git.raw(args);
  if (!res.success) return null;
  const v = (res.data ?? "").trim();
  return v.length ? v : null;
}

/** Read git-derived defaults from the BOUND audit repo. Never throws. */
export async function readGitDerivedInfo(
  git: GitConfigReader,
): Promise<GitDerivedInfo> {
  const [remoteUrl, name, email, signingKey, gpgFormat, gpgSign, originHead] =
    await Promise.all([
      readValue(git, ["remote", "get-url", "origin"]),
      readValue(git, ["config", "user.name"]),
      readValue(git, ["config", "user.email"]),
      readValue(git, ["config", "user.signingkey"]),
      readValue(git, ["config", "gpg.format"]),
      readValue(git, ["config", "commit.gpgsign"]),
      readValue(git, ["rev-parse", "--abbrev-ref", "origin/HEAD"]),
    ]);

  const format: SigningFormat | undefined =
    gpgFormat === "ssh" ? "ssh" : gpgFormat ? "gpg" : undefined;

  const signing: GitDerivedInfo["signing"] = {};
  if (format) signing.format = format;
  if (gpgSign != null) signing.enabled = gpgSign === "true";
  if (signingKey) {
    // SSH signing key is a path; GPG key is an id. Default to ssh when unknown.
    if (format === "gpg") signing.keyId = signingKey;
    else signing.sshSigningKeyPath = signingKey;
  }

  return {
    remoteUrl: remoteUrl ?? undefined,
    provider: remoteUrl ? inferProviderFromUrl(remoteUrl) : undefined,
    authorName: name ?? undefined,
    authorEmail: email ?? undefined,
    defaultBranch: stripOriginPrefix(originHead),
    signing: Object.keys(signing).length ? signing : undefined,
  };
}

// ── Pure merge (unit-tested) ─────────────────────────────────────────────────

/** A field is "at default" if it still equals the package default value. */
function atDefault<K extends keyof AuditConfig>(
  current: AuditConfig,
  key: K,
): boolean {
  return current[key] === DEFAULT_AUDIT_CONFIG[key];
}

/**
 * Return a copy of `current` with empty / still-default fields filled from git.
 * Rules (never overwrite a user-set value):
 *   - remoteUrl / author.name / author.email: fill only when empty.
 *   - provider / defaultBranch: override only while still at the package default.
 *   - signing: fill key path / id / format when empty; does NOT auto-enable
 *     signing (the user toggles that) — pre-filling the key just makes enabling
 *     one click.
 */
export function deriveAuditConfigFromGit(
  current: AuditConfig,
  info: GitDerivedInfo,
): AuditConfig {
  const next: AuditConfig = {
    ...current,
    author: { ...current.author },
    signing: { ...(current.signing ?? DEFAULT_AUDIT_CONFIG.signing!) },
  };

  if (!current.remoteUrl && info.remoteUrl) next.remoteUrl = info.remoteUrl;
  if (info.provider && atDefault(current, "provider")) {
    next.provider = info.provider;
  }
  if (info.defaultBranch && atDefault(current, "defaultBranch")) {
    next.defaultBranch = info.defaultBranch;
  }
  if (!current.author.name && info.authorName) {
    next.author.name = info.authorName;
  }
  if (!current.author.email && info.authorEmail) {
    next.author.email = info.authorEmail;
  }

  if (info.signing) {
    const sig = next.signing!;
    const untouchedSigning =
      !sig.sshSigningKeyPath && !sig.keyId && sig.enabled === false;
    if (info.signing.format && untouchedSigning) sig.format = info.signing.format;
    if (info.signing.sshSigningKeyPath && !sig.sshSigningKeyPath) {
      sig.sshSigningKeyPath = info.signing.sshSigningKeyPath;
    }
    if (info.signing.keyId && !sig.keyId) sig.keyId = info.signing.keyId;
  }

  return next;
}
