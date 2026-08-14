// ==================== AUDIT REPO — GIT HOOKS GUARD ====================
// Installs a TARAflow-managed git hook that gives a LOCAL pre-check at commit
// time — for BOTH the app's commits AND console/CLI commits (that's the point
// of a real hook vs an in-app gate). Checked on audit-tab open like the
// .gitattributes guard, and installed the same way.
//
// ZERO INSTALL: the hook is self-contained POSIX sh (git + sh only — present
// everywhere, incl. Git-for-Windows). No Node helper, no separate tool. It can
// therefore enforce the COMMIT-MESSAGE SCHEMA (subject + required trailers,
// generated from REQUIRED_TARA_TRAILERS so it can't drift from the engine).
// The TCS canonicalisation check is NOT here (it needs the real serializer) —
// that stays with the engine (the authority) + TARAflow's own canonical writes.
//
// Mirrors audit-repo-attributes.ts: pure logic + injected side effects.

import type { GitRunner, FileIO } from "./audit-repo-attributes";
import { REQUIRED_TARA_TRAILERS } from "./verify/message";

export const HOOKS_VERSION = 2;
export const MANAGED_HOOKS = ["commit-msg"] as const;
export type HookName = (typeof MANAGED_HOOKS)[number];
export const HOOKS_PATH_REL = ".tara/hooks";
export const MANAGED_MARKER = "taraflow-managed hook";
export type MakeExecutable = (path: string) => Promise<void>;

function joinRepo(repoRoot: string, ...parts: string[]): string {
  const sep = repoRoot.includes("\\") ? "\\" : "/";
  const clean = repoRoot.replace(/[/\\]+$/, "");
  return clean + sep + parts.join("/").replace(/\//g, sep);
}
export function hooksDirOf(repoRoot: string): string { return joinRepo(repoRoot, ".tara", "hooks"); }
export function hookPathOf(repoRoot: string, name: HookName): string { return joinRepo(repoRoot, ".tara", "hooks", name); }

/** The managed commit-msg hook: self-contained POSIX sh, generated from the
 *  shared required-trailer set so it always matches the engine's schema. */
export function hookScript(name: HookName): string {
  if (name !== "commit-msg") throw new Error(`no template for hook: ${name}`);
  const keys = REQUIRED_TARA_TRAILERS.join(" ");
  return [
    "#!/bin/sh",
    `# ${MANAGED_MARKER} — HOOKS_VERSION=${HOOKS_VERSION}`,
    "# Managed by TARAflow — do not edit; regenerated on update.",
    "# Local pre-check; the audit CLI/CI with a pinned anchor is authoritative.",
    "# Blocks a commit whose message is neither 'audit: …' nor a",
    "# '[TARA] <round>' carrying the required trailers. Self-contained POSIX sh.",
    "# SCOPE: core.hooksPath is repo-wide, so this fires for EVERY commit. Only",
    "# commits touching an audit path (*.tara.json or .tara/) must follow the",
    "# schema — ordinary source commits in the same repo stay free-form.",
    'msg_file="$1"',
    "",
    "# Exempt commits that touch no audit-scoped path (a *.tara.json project",
    "# file or anything under .tara/). git diff --cached honours the temporary",
    "# index of a path-scoped commit and works on an unborn HEAD.",
    "changed=$(git diff --cached --name-only 2>/dev/null)",
    "if ! printf '%s\\n' \"$changed\" | grep -qE '\\.tara\\.json$|(^|/)\\.tara/'; then",
    "  exit 0",
    "fi",
    "",
    'subject=$(head -n1 "$msg_file")',
    "",
    "# audit: infra commits are exempt from the round schema",
    'case "$subject" in',
    '  "audit: "*) exit 0 ;;',
    "esac",
    "",
    "# otherwise the subject must be a [TARA] <round> header",
    'case "$subject" in',
    '  "[TARA] "*) ;;',
    "  *)",
    `    echo "taraflow: commit subject must be 'audit: …' or '[TARA] <round>'." >&2`,
    "    exit 1 ;;",
    "esac",
    "",
    "# the round name must be non-empty",
    'rest=${subject#"[TARA] "}',
    'if [ -z "$(printf %s "$rest" | tr -d "[:space:]")" ]; then',
    `  echo "taraflow: '[TARA]' subject is missing the round name." >&2`,
    "  exit 1",
    "fi",
    "",
    "# the required trailers must all be present",
    'missing=""',
    `for key in ${keys}; do`,
    '  grep -qE "^${key}:[[:space:]]" "$msg_file" || missing="${missing} ${key}"',
    "done",
    'if [ -n "$missing" ]; then',
    '  echo "taraflow: [TARA] commit is missing required trailer(s):${missing}." >&2',
    "  exit 1",
    "fi",
    "exit 0",
    "",
  ].join("\n");
}

export function parseHookVersion(content: string | null): number | null {
  if (!content || !content.includes(MANAGED_MARKER)) return null;
  const m = content.match(/HOOKS_VERSION=(\d+)/);
  return m ? Number(m[1]) : null;
}
export function isManagedHook(content: string | null): boolean {
  return !!content && content.includes(MANAGED_MARKER);
}
export function normalizeHooksPath(value: string | null): string | null {
  if (value == null) return null;
  return value.trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

export interface HookFileStatus { name: HookName; present: boolean; managed: boolean; version: number | null; current: boolean; }
export interface HooksStatus { ok: boolean; hooksPathConfigured: boolean; hooksPathValue: string | null; hooks: HookFileStatus[]; toWrite: HookName[]; }

async function readHooksPath(run: GitRunner, repoPath: string): Promise<string | null> {
  // `git config --get core.hooksPath` prints the value ONLY when it is set, so
  // stdout presence is the reliable signal. Do NOT gate on the exit code — some
  // IPC git runners don't propagate a 0 on success, which would make a correctly
  // configured repo look unconfigured and the "install hooks" warning stick.
  const res = await run(["config", "--get", "core.hooksPath"], repoPath);
  const v = (res.stdout ?? "").trim();
  return v.length ? v : null;
}

export async function inspectAuditRepoHooks(run: GitRunner, io: FileIO, repoPath: string): Promise<HooksStatus> {
  const hooksPathValue = await readHooksPath(run, repoPath);
  const hooksPathConfigured = normalizeHooksPath(hooksPathValue) === HOOKS_PATH_REL;
  const hooks: HookFileStatus[] = [];
  const toWrite: HookName[] = [];
  for (const name of MANAGED_HOOKS) {
    const content = await io.read(hookPathOf(repoPath, name));
    const managed = isManagedHook(content);
    const version = parseHookVersion(content);
    const present = content !== null;
    const current = present && managed && version === HOOKS_VERSION;
    hooks.push({ name, present, managed, version, current });
    if (!current) toWrite.push(name);
  }
  return { ok: hooksPathConfigured && toWrite.length === 0, hooksPathConfigured, hooksPathValue, hooks, toWrite };
}

export async function applyAuditRepoHooks(run: GitRunner, io: FileIO, makeExecutable: MakeExecutable, repoPath: string): Promise<HooksStatus> {
  // Set core.hooksPath and FAIL LOUDLY if it doesn't take. (simple-git blocks
  // this by default — the main-process git:rawInDir must opt in via
  // `{ unsafe: { allowUnsafeHooksPath: true } }` — and a silent failure here
  // used to leave the hook written but unconfigured, so the warning stuck.)
  const cfg = await run(["config", "core.hooksPath", HOOKS_PATH_REL], repoPath);
  if (cfg.code !== 0) {
    throw new Error(
      cfg.stderr?.trim() ||
        `git config core.hooksPath failed (exit ${cfg.code})`,
    );
  }
  for (const name of MANAGED_HOOKS) {
    const path = hookPathOf(repoPath, name);
    await io.write(path, hookScript(name));
    await makeExecutable(path);
  }
  return inspectAuditRepoHooks(run, io, repoPath);
}