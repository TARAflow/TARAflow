// ==================== AUDIT REPO — GITATTRIBUTES GUARD ====================
// When the user points TARAflow at a local audit repository, we must ensure the
// repo enforces canonical handling of *.tara.json (LF, treated as text). Without
// it, a checkout on Windows can rewrite line endings and every committed project
// file drifts from its TCS bytes — silently breaking the reproducibility the
// audit trail depends on.
//
// This module is pure logic + injected side effects (git runner, fs), so it is
// fully unit-testable without Electron. The authoritative check uses
// `git check-attr`, which also honours global/`core.attributesfile` rules — we
// never hand-parse .gitattributes to decide "is it satisfied?".
//
// Flow the UI drives:
//   1. user selects the local audit repo path
//   2. inspectAuditRepoAttributes() → status
//   3. if not satisfied → ask the user
//   4. on confirm → applyTaraAttributes() writes the managed block, re-checks

// ── Injected side effects ─────────────────────────────────────────────────

export interface GitRunner {
  /** Run git with args in `cwd`. Must not throw on non-zero exit. */
  (args: string[], cwd: string): Promise<{
    stdout: string;
    stderr: string;
    code: number;
  }>;
}

export interface FileIO {
  read(path: string): Promise<string | null>; // null if absent
  write(path: string, content: string): Promise<void>;
}

// ── Contract ───────────────────────────────────────────────────────────────

export const TARA_GLOB = "*.tara.json";

/** The attributes a *.tara.json path must resolve to for a safe audit repo. */
export const REQUIRED_TARA_ATTRS: ReadonlyArray<{
  attr: string;
  expected: string;
}> = [
  { attr: "text", expected: "set" },
  { attr: "eol", expected: "lf" },
];

/** A path that need not exist — check-attr matches on the pattern, not the file. */
const PROBE_PATH = "__tcs_probe__.tara.json";

/** Marker identifying the block TARAflow manages, so appends stay idempotent. */
export const MANAGED_BLOCK_MARKER =
  "# TARAflow: canonical .tara.json handling (managed)";

export interface MissingAttr {
  attr: string;
  expected: string;
  actual: string;
}

export interface AttrStatus {
  /** True only if every required attribute resolves to its expected value. */
  ok: boolean;
  /** Resolved value per attribute (or "unspecified"). */
  actual: Record<string, string>;
  missing: MissingAttr[];
  /** True if a TARAflow-managed block already exists in the repo .gitattributes. */
  managedBlockPresent: boolean;
}

// ── Pure helpers (unit-tested directly) ──────────────────────────────────────

/** Parse `git check-attr <a> <b> -- <path>` output into { attr: value }. */
export function parseCheckAttr(
  stdout: string,
  attrs: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    for (const a of attrs) {
      // line format: "<path>: <attr>: <value>"
      const m = line.match(new RegExp(`:\\s${a}:\\s(.+?)\\s*$`));
      if (m) out[a] = m[1].trim();
    }
  }
  return out;
}

/** Evaluate resolved attributes against the requirement. */
export function evaluateAttrs(
  actual: Record<string, string>,
): Pick<AttrStatus, "ok" | "missing"> {
  const missing = REQUIRED_TARA_ATTRS.filter(
    (r) => (actual[r.attr] ?? "unspecified") !== r.expected,
  ).map((r) => ({
    attr: r.attr,
    expected: r.expected,
    actual: actual[r.attr] ?? "unspecified",
  }));
  return { ok: missing.length === 0, missing };
}

/** The block TARAflow appends to a repo's .gitattributes. */
export function taraAttributesBlock(): string {
  return [
    MANAGED_BLOCK_MARKER,
    `${TARA_GLOB} text eol=lf`,
    `${TARA_GLOB} diff=tara`,
    "",
  ].join("\n");
}

export function hasManagedBlock(existing: string | null): boolean {
  return !!existing && existing.includes(MANAGED_BLOCK_MARKER);
}

/**
 * Return .gitattributes content with the managed block appended.
 * Idempotent: if the marker is already present, returns the input unchanged.
 * Preserves existing content and avoids stray blank lines.
 */
export function withTaraAttributesAppended(existing: string | null): string {
  if (hasManagedBlock(existing)) return existing as string;
  const base =
    existing && existing.length > 0
      ? existing.endsWith("\n")
        ? existing
        : existing + "\n"
      : "";
  const sep = base.length > 0 ? "\n" : "";
  return base + sep + taraAttributesBlock();
}

// ── Orchestration (side-effecting, thin) ─────────────────────────────────────

/** Is `repoPath` inside a git work tree? */
export async function isGitRepo(
  run: GitRunner,
  repoPath: string,
): Promise<boolean> {
  const res = await run(["rev-parse", "--is-inside-work-tree"], repoPath);
  return res.code === 0 && res.stdout.trim() === "true";
}

/** Inspect whether the audit repo enforces canonical *.tara.json handling. */
export async function inspectAuditRepoAttributes(
  run: GitRunner,
  io: FileIO,
  repoPath: string,
  gitattributesPath: string,
): Promise<AttrStatus> {
  const attrs = REQUIRED_TARA_ATTRS.map((r) => r.attr);
  const res = await run(["check-attr", ...attrs, "--", PROBE_PATH], repoPath);
  const actual = parseCheckAttr(res.stdout, attrs);
  const { ok, missing } = evaluateAttrs(actual);
  const existing = await io.read(gitattributesPath);
  return { ok, actual, missing, managedBlockPresent: hasManagedBlock(existing) };
}

/**
 * Write the managed block into the repo's .gitattributes and re-check.
 * Returns the post-write status so the caller can confirm success.
 */
export async function applyTaraAttributes(
  run: GitRunner,
  io: FileIO,
  repoPath: string,
  gitattributesPath: string,
): Promise<AttrStatus> {
  const existing = await io.read(gitattributesPath);
  if (!hasManagedBlock(existing)) {
    await io.write(gitattributesPath, withTaraAttributesAppended(existing));
  }
  return inspectAuditRepoAttributes(run, io, repoPath, gitattributesPath);
}