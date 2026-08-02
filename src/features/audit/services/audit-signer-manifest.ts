// ==================== AUDIT SIGNER MANIFEST ====================
// The committed trust root of the audit trail: which SSH keys are authorized to
// sign audit commits. Lives at `<repoRoot>/.tara/allowed_signers` — an infra
// file in the same category as `.gitattributes`, changed only by a signed
// `audit:` commit.
//
// TWO QUESTIONS, TWO CONSUMERS:
//   - git (LOCAL, offline) answers "is this signature cryptographically valid
//     for a key in the file?" — via `gpg.ssh.allowedSignersFile` pointing here.
//   - the Audit Verification Engine (Phase 4) answers "was this signer
//     authorized by the manifest as it stood BEFORE the commit?" — it walks
//     history and reconstructs the manifest at each position. That historical
//     check is NOT this module's job; this module only models + parses +
//     serializes the file and answers point-in-time membership.
//
// The git SERVER (GitHub/GitLab) is deliberately NOT the trust source: the
// committed manifest is, so the trail verifies offline, survives a host change,
// and records every authority change as an auditable signed commit.
//
// Pure and dependency-free (no React, no window, no git) so it is fully
// unit-testable. Callers (the add-signer flow, the open-flow config wiring,
// later the verifier) supply I/O.

// ── Model ────────────────────────────────────────────────────────────────────

/**
 * One line of an OpenSSH `allowed_signers` file:
 *   <principal> [options] <keytype> <keyblob> [comment]
 * e.g. `me@example.com namespaces="git" ssh-ed25519 AAAA…C taraflow audit`
 *
 * The public KEY (keyType + keyBlob) is the identity for authorization and
 * de-duplication; the principal is the commit-author email git matches against.
 */
export interface SignerEntry {
  /** Commit-author email git verifies the signature's principal against. */
  principal: string;
  /** Signer options, e.g. `namespaces="git"`. Empty string if none. */
  options: string;
  /** Key algorithm, e.g. `ssh-ed25519`. */
  keyType: string;
  /** Base64 key body (no algorithm prefix, no comment). */
  keyBlob: string;
  /** Optional trailing comment. */
  comment?: string;
}

/** OpenSSH key-type tokens we accept as the start of the key field. */
const KEY_TYPE_RE =
  /^(?:sk-)?(?:ssh-(?:rsa|ed25519|dss)|ecdsa-sha2-[\w-]+)$/;

// ── Parse / serialize ────────────────────────────────────────────────────────

/** Parse one line into an entry, or null for blank/comment/malformed lines. */
function parseLine(line: string): SignerEntry | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const tokens = trimmed.split(/\s+/);
  // The key field is the first token that looks like a key type. Everything
  // before it (after the principal) is options; the next token is the blob.
  const ki = tokens.findIndex((t) => KEY_TYPE_RE.test(t));
  if (ki < 1 || ki + 1 >= tokens.length) return null; // no principal or no blob

  return {
    principal: tokens[0],
    options: tokens.slice(1, ki).join(" "),
    keyType: tokens[ki],
    keyBlob: tokens[ki + 1],
    comment: tokens.slice(ki + 2).join(" ") || undefined,
  };
}

/** Parse a whole `allowed_signers` file. Unparseable lines are skipped. */
export function parseAllowedSigners(text: string): SignerEntry[] {
  return text
    .split(/\r?\n/)
    .map(parseLine)
    .filter((e): e is SignerEntry => e !== null);
}

/** Render one entry back to its canonical single-line form. */
function formatLine(e: SignerEntry): string {
  return [e.principal, e.options, e.keyType, e.keyBlob, e.comment]
    .filter((part) => part && part.length > 0)
    .join(" ");
}

/**
 * Serialize entries to a byte-stable file: sorted by principal then key, LF
 * newlines, exactly one trailing newline — same diff-stability discipline as
 * TCS, so a manifest commit shows only the real add/remove, never reordering.
 */
export function serializeAllowedSigners(entries: SignerEntry[]): string {
  const lines = [...entries]
    .sort(
      (a, b) =>
        a.principal.localeCompare(b.principal) ||
        a.keyBlob.localeCompare(b.keyBlob),
    )
    .map(formatLine);
  return lines.length ? lines.join("\n") + "\n" : "";
}

// ── Authorization + mutation (pure) ──────────────────────────────────────────

/** Same public key? (identity = keyType + keyBlob, principal-independent.) */
function sameKey(a: SignerEntry, b: SignerEntry): boolean {
  return a.keyType === b.keyType && a.keyBlob === b.keyBlob;
}

/** Is this public key present in the manifest? (Point-in-time membership.) */
export function isAuthorized(
  entries: SignerEntry[],
  keyType: string,
  keyBlob: string,
): boolean {
  return entries.some((e) => e.keyType === keyType && e.keyBlob === keyBlob);
}

/** Add a signer; idempotent (same principal + key is a no-op). Returns a new array. */
export function addSigner(
  entries: SignerEntry[],
  entry: SignerEntry,
): SignerEntry[] {
  const exists = entries.some(
    (e) => e.principal === entry.principal && sameKey(e, entry),
  );
  return exists ? entries : [...entries, entry];
}

/** Remove every entry with this public key. Returns a new array. */
export function removeSigner(
  entries: SignerEntry[],
  keyType: string,
  keyBlob: string,
): SignerEntry[] {
  return entries.filter((e) => !(e.keyType === keyType && e.keyBlob === keyBlob));
}

/**
 * Build an entry from the contents of a `*.pub` file plus the commit-author
 * email. A pubkey line is `<keytype> <keyblob> [comment]`; we pin the git
 * namespace (mandatory — without `namespaces="git"` git won't verify a commit
 * signature against the entry).
 */
export function entryFromPubkey(
  principal: string,
  pubkeyFileContents: string,
  namespaces = "git",
): SignerEntry {
  const [keyType, keyBlob, ...rest] = pubkeyFileContents.trim().split(/\s+/);
  if (!keyType || !keyBlob || !KEY_TYPE_RE.test(keyType)) {
    throw new Error("Not a valid SSH public key line");
  }
  return {
    principal,
    options: `namespaces="${namespaces}"`,
    keyType,
    keyBlob,
    comment: rest.join(" ") || undefined,
  };
}

// ── Path helper ──────────────────────────────────────────────────────────────

/** `<repoRoot>/.tara/allowed_signers`, using the separator the root uses. */
export function allowedSignersPathOf(repoRoot: string): string {
  const sep = repoRoot.includes("\\") ? "\\" : "/";
  const clean = repoRoot.replace(/[/\\]+$/, "");
  return clean + sep + ".tara" + sep + "allowed_signers";
}

/** Repo-relative POSIX path for staging/committing (git pathspec form). */
export const ALLOWED_SIGNERS_REL_PATH = ".tara/allowed_signers";
