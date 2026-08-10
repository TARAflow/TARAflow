// ==================== AUDIT VERIFICATION — GIT READER PORT ====================
// The semantic interface the engine reads git through. Suggested location:
// features/audit/services/verify/git-reader.ts.
//
// WHY A PORT (and not "just call git")
// ------------------------------------
// One engine, many callers (Audit UI in the main process, the CLI, CI, hooks).
// The pure engine core (trust-walk, checks) is written against THIS interface,
// so it is unit-testable with an in-memory fake (git-reader-fake.ts) — no real
// repo, no child processes. Exactly ONE reference adapter implements it against
// git plumbing (git-reader-exec.ts, later), over a single primitive
// `raw(args) => { stdout, stderr, code }` (the same shape as the app's existing
// `git:rawInDir`, which does NOT throw on a non-zero exit — important for
// `verify-commit`, which exits non-zero on an unverifiable signature).
//
// The METHODS below are the contract; the concrete plumbing (which git command
// produces each answer) is the adapter's private choice.

export type CommitHash = string; // full 40-char hex

export interface Identity {
  name: string;
  email: string;
}

export interface CommitInfo {
  hash: CommitHash;
  /** Parent hashes. length > 1 ⇒ a merge (history-shape check uses this). */
  parents: CommitHash[];
  /** The commit-author identity git records (`%an`/`%ae`). */
  author: Identity;
  /** The committer identity (`%cn`/`%ce`); recorded for reporting only. */
  committer: Identity;
  /**
   * Committer date, ISO-8601. For DISPLAY / reporting ONLY — authority is
   * anchored to position in signed history, NEVER to a timestamp (timestamps
   * are attacker-controlled). No check may branch on this field.
   */
  committedAt: string;
  /** First line of the message (`%s`). */
  subject: string;
  /** Full raw commit message (`%B`); trailer parsing is a pure step on top. */
  message: string;
}

/** A path touched by a commit, relative to the repo root, with its change kind. */
export interface ChangedPath {
  path: string;
  /** "A" added, "M" modified, "D" deleted (git name-status letters). */
  status: "A" | "M" | "D";
}

/**
 * Result of verifying a commit's signature AGAINST A SPECIFIC allowed_signers
 * text (the historical manifest the engine reconstructs):
 *   - "good"  signature is cryptographically valid AND its signer is present in
 *             the supplied manifest → the signer was authorized by exactly that
 *             manifest.
 *   - "bad"   a signature is present but does not verify against the supplied
 *             manifest — either the signer is NOT in it, or the signature is
 *             cryptographically invalid. v1 does not separate these (both are
 *             errors); the trust walk reports SIGNER_NOT_AUTHORIZED.
 *   - "none"  the commit carries no signature at all.
 *   - "error" verification could not be run (bad input, tooling failure).
 */
export type VerifyResult = "good" | "bad" | "none" | "error";

/**
 * Everything the engine needs to read from a repository, expressed
 * semantically. All reads are local/offline; the hosting provider is never
 * consulted. Every method is async because the reference adapter shells out to
 * git.
 */
export interface GitReader {
  /**
   * Resolve a ref (branch, tag, or full ref name) to the COMMIT it ultimately
   * points at — peeling annotated/signed tags to their commit. Returns null if
   * the ref does not exist. Used for the target-ref tip and for locating the
   * `audit-root` tag (to detect a moved tag against the pinned anchor).
   */
  resolveRef(ref: string): Promise<CommitHash | null>;

  /**
   * The audit commits from `anchor` (inclusive) to `tip` (inclusive), in
   * ANCESTRY order — anchor first, tip last. `anchor` must be an ancestor of
   * `tip`; if it is not, the reader rejects (the engine treats that as an
   * anchor-not-in-history finding before walking). Each CommitInfo carries all
   * of its parents so the history-shape check can see merges.
   */
  history(anchor: CommitHash, tip: CommitHash): Promise<CommitInfo[]>;

  /**
   * How many commits strictly precede `commit` in its ancestry (its total
   * ancestor count). Used to report PRE_ANCHOR_COMMITS: commits that exist
   * before the audit anchor and are outside the audit scope.
   */
  countAncestors(commit: CommitHash): Promise<number>;

  /**
   * The exact bytes of `path` in `commit`'s tree, or null when the tree does
   * NOT contain that path. Covers three needs at once: reading the manifest at
   * a commit, reading a `*.tara.json` blob for the TCS check, and — via the
   * null result — detecting whether a commit's tree contains the manifest
   * (add-detection for the anchor).
   */
  readFileAt(commit: CommitHash, path: string): Promise<string | null>;

  /**
   * Paths changed by `commit` relative to its first parent (for the root: every
   * path in its tree, all "A"). Used to detect a manifest-changing commit
   * (`.tara/allowed_signers` present here) and to scope the TCS check to the
   * `*.tara.json` files each commit actually changed (so each blob version is
   * checked exactly once across history).
   */
  changedPaths(commit: CommitHash): Promise<ChangedPath[]>;

  /**
   * Verify `commit`'s signature against the supplied allowed_signers TEXT (a
   * reconstructed historical manifest). The adapter materializes the text to a
   * temp file and runs git with `gpg.ssh.allowedSignersFile` pointed at it, so
   * verification is faithful, local, and works on a bare clone. See
   * VerifyResult. The text is passed (not a path) so the pure core stays in
   * charge of WHICH manifest/subset to check (full set vs. maintainers only).
   */
  verifyCommitAgainst(
    commit: CommitHash,
    allowedSignersText: string,
  ): Promise<VerifyResult>;

  /** Is `ancestor` an ancestor of (or equal to) `descendant`? */
  isAncestor(ancestor: CommitHash, descendant: CommitHash): Promise<boolean>;

  /** Is the working tree clean (no staged or unstaged changes)? */
  isWorkingTreeClean(): Promise<boolean>;

  /** Is HEAD detached (not on a branch)? */
  isHeadDetached(): Promise<boolean>;
}
