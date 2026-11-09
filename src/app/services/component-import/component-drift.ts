// ==================== COMPONENT DRIFT ====================
// Multi-project TARA phase 5a (design §9.1): is a newer state of an
// imported component available? Read-only — nothing in the project changes;
// an update is always an explicit action (phase 5c). Pure apart from the
// injected git runner and file reader (Electron adapters in
// component-source-electron.ts).
//
//   pinned import    the component TARA AS COMMITTED at the tip of its
//                    branch (git show <branch>:<path>), never the working
//                    copy — an uncommitted edit of the component team is
//                    not a newer state. With a tag pattern the newest
//                    matching tag instead (releases, not every commit).
//                    `git fetch` only on request (then the remote branch).
//   unpinned import  the file at its local path (remembered in
//                    localStorage) — there is no branch to look at
//
// Content decides, not the commit: the state read is reduced to its
// snapshot exactly as on import (componentSnapshotOfText) and compared by
// the snapshot's content hash. A commit that changes only layout or other
// files is not a newer state.
//
// A newer TARAflow may reduce a component differently (a new snapshot field,
// a fix like patch 11) — then every stored hash differs although no
// component changed (review 2026-11-09; I1 covers determinism within one
// app, not across releases). For a pinned import the check therefore
// rebuilds the IMPORTED commit with the running app too and compares the
// two rebuilt states; when the imported commit's rebuilt hash differs from
// the stored one, the app reads the component differently now
// (`builderChanged`) — not a newer state of the component. An unpinned
// import has no imported commit to rebuild: there the stored hash is all
// there is.
//
// Tag pattern: "newest" is by VERSION (git tag --sort=-v:refname), so
// v1.10 comes after v1.9 and a tag set later on an older commit (a hotfix
// tag) is ordered by its version, not its date.

import type { ComponentImport } from "shared";
import {
  componentSnapshotOfText,
  readComponentSource,
  type ComponentFileReader,
  type ComponentGitRunner,
  type ComponentSourceResult,
} from "./component-source";
import { projectMethodologyFingerprint } from "./snapshot-builder";

export type ComponentDriftReason =
  /** Where the component lies on this machine is not known (open it once via File → Open, or import again). */
  | "path_unknown"
  /** The local path is no git working copy (pinned import). */
  | "no_repo"
  /** Branch / tag not found (or the import has no branch — a detached commit). */
  | "ref_missing"
  /** The file is not at its path (in that state / on disk). */
  | "file_missing"
  /** The state cannot be read as a component TARA (invalid, schema too new, not deterministic). */
  | "unreadable"
  /**
   * The imported commit is not in this clone — it is behind the state the
   * machine imported (e.g. imported on another computer): fetch first.
   * Nothing is compared (review of patch 54: an older state must never be
   * offered as newer).
   */
  | "clone_behind"
  /**
   * The imported commit is missing even after `git fetch`: it no longer
   * exists in the component's repository (history rewritten — a force push
   * after a rebase, sensitive data removed). Fetching again does not help;
   * check with the component team (review of patch 55).
   */
  | "imported_state_gone"
  /** `git fetch` failed — the remote is not reachable (offline is the normal case). */
  | "fetch_failed";

export type ComponentDriftStatus =
  | { kind: "up_to_date"; builderChanged?: boolean }
  | { kind: "newer_available"; contentHash: string; commitSha?: string; tag?: string; builderChanged?: boolean }
  /**
   * The state found and the imported one lie on separate branches (e.g. after
   * a rebase in the component's repository) — neither newer nor older; a
   * hint, never offered as an update without a look.
   */
  | { kind: "diverged"; contentHash: string; commitSha: string; tag?: string; builderChanged?: boolean }
  | { kind: "unreachable"; reason: ComponentDriftReason; detail?: string };

export interface ComponentDriftOptions {
  /** `git fetch` first and look at the remote branch — only on request (design §9.1). */
  fetch?: boolean;
}

function dirOf(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : ".";
}

/**
 * Compares a state's text by content with the imported state: `baseline` is
 * the imported commit rebuilt by the running app (pinned), else the stored
 * hash.
 */
function compare(
  text: string,
  baseline: string,
  at: { commitSha?: string; tag?: string } = {},
  builderChanged = false,
): ComponentDriftStatus {
  const read = componentSnapshotOfText(text);
  if (!read.ok) return { kind: "unreachable", reason: "unreadable", ...(read.detail ? { detail: read.detail } : { detail: read.error }) };
  const changed = builderChanged ? { builderChanged: true } : {};
  return read.contentHash === baseline
    ? { kind: "up_to_date", ...changed }
    : { kind: "newer_available", contentHash: read.contentHash, ...at, ...changed };
}

/** The drift of one import; `localPath` = where its component TARA lies here (resolveComponentPath). */
export async function checkComponentDrift(
  imported: ComponentImport,
  localPath: string | undefined,
  readFile: ComponentFileReader,
  git: ComponentGitRunner,
  options: ComponentDriftOptions = {},
): Promise<ComponentDriftStatus> {
  if (!localPath) return { kind: "unreachable", reason: "path_unknown" };
  const source = imported.source;

  if (source.unpinned) {
    const text = await readFile(localPath);
    return text === null ? { kind: "unreachable", reason: "file_missing" } : compare(text, imported.contentHash);
  }

  const top = await git(["rev-parse", "--show-toplevel"], dirOf(localPath));
  if (top.code !== 0 || !top.stdout.trim()) return { kind: "unreachable", reason: "no_repo" };
  const root = top.stdout.trim();
  if (!source.path) return { kind: "unreachable", reason: "file_missing" };
  if (options.fetch) {
    const fetched = await git(["fetch", "--quiet", "--tags"], root);
    if (fetched.code !== 0) return { kind: "unreachable", reason: "fetch_failed", detail: fetched.stderr.trim() || "git fetch failed" };
  }

  // Which state: the newest tag of the pattern, else the branch tip.
  let ref: string | undefined;
  let tag: string | undefined;
  if (source.tagPattern) {
    const tags = await git(["tag", "--list", source.tagPattern, "--sort=-v:refname"], root);
    tag = tags.code === 0 ? tags.stdout.split("\n").map((t) => t.trim()).find(Boolean) : undefined;
    ref = tag;
  } else if (source.branch) {
    ref = source.branch;
    if (options.fetch) {
      const remote = await git(["rev-parse", "--verify", "--quiet", `origin/${source.branch}`], root);
      if (remote.code === 0) ref = `origin/${source.branch}`;
    }
  }
  if (!ref) return { kind: "unreachable", reason: "ref_missing" };
  const sha = await git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], root);
  if (sha.code !== 0) return { kind: "unreachable", reason: "ref_missing", detail: ref };
  const commitSha = sha.stdout.trim();

  // Ancestry (review of patch 54): only a state AFTER the imported one is
  // newer. The imported commit not in this clone → the clone is behind (e.g.
  // imported on another computer): fetch first, compare nothing.
  if (source.commitSha) {
    const present = await git(["cat-file", "-e", `${source.commitSha}^{commit}`], root);
    // After a fetch the clone is not behind any more: the commit is gone.
    // Note (review of patch 56): a clone that had the imported commit BEFORE
    // the history was rewritten keeps it — a fetch does not delete it, it is
    // only unreachable from any ref. Then this check does not fire; the
    // ancestry below reports "diverged" instead of "imported state gone".
    // Both lead to the same action (check with the component team), so the
    // two messages for one cause are expected.
    if (present.code !== 0) return { kind: "unreachable", reason: options.fetch ? "imported_state_gone" : "clone_behind" };
  }

  // The imported commit rebuilt by the running app: the baseline. Unavailable
  // (e.g. a shallow clone without it) → the stored hash.
  let baseline = imported.contentHash;
  let builderChanged = false;
  if (source.commitSha) {
    const then = await git(["show", `${source.commitSha}:${source.path}`], root);
    const rebuilt = then.code === 0 ? componentSnapshotOfText(then.stdout) : undefined;
    if (rebuilt?.ok) {
      baseline = rebuilt.contentHash;
      builderChanged = rebuilt.contentHash !== imported.contentHash;
    }
  }
  const builder = builderChanged ? { builderChanged: true } : {};
  if (commitSha === source.commitSha) return { kind: "up_to_date", ...builder };
  let diverged = false;
  if (source.commitSha) {
    // An ancestor of the imported commit (a clone not fetched, a tag on an
    // older commit): older, not newer.
    const older = await git(["merge-base", "--is-ancestor", commitSha, source.commitSha], root);
    if (older.code === 0) return { kind: "up_to_date", ...builder };
    const newer = await git(["merge-base", "--is-ancestor", source.commitSha, commitSha], root);
    diverged = newer.code !== 0;
  }
  const shown = await git(["show", `${commitSha}:${source.path}`], root);
  if (shown.code !== 0) return { kind: "unreachable", reason: "file_missing", detail: `${ref}:${source.path}` };
  const result = compare(shown.stdout, baseline, { commitSha, ...(tag ? { tag } : {}) }, builderChanged);
  // Separate branches with other content: a hint, not an update offer.
  return diverged && result.kind === "newer_available"
    ? { kind: "diverged", contentHash: result.contentHash, commitSha, ...(tag ? { tag } : {}), ...builder }
    : result;
}

// ==================== FINDINGS ====================

type Finding = { key: string; elementId?: string; displayId?: string; params?: Record<string, string | number> };
const KEY = (code: string) => `components.findings.${code}`;

/**
 * Info findings of the drift check (phase 5a): CMP_NEWER_STATE_AVAILABLE
 * (where: tag / commit), CMP_SOURCE_DIVERGED (separate branches),
 * CMP_SOURCE_UNREACHABLE (why),
 * CMP_SNAPSHOT_BUILDER_CHANGED (this TARAflow reads the imported state
 * differently — an update refreshes the stored state). Attached to the first
 * instance's multiprocess. Never a warning: an older state is not wrong, and
 * an unreachable source is the normal case on a machine without the
 * component's checkout.
 */
export function componentDriftFindings(
  project: { components?: { imports: readonly ComponentImport[]; instances: readonly { importId: string; multiprocessTfId: string }[] } | null; dfd?: { elements?: readonly { id: string; displayId?: string }[] } | null },
  drift: ReadonlyMap<string, ComponentDriftStatus>,
): Finding[] {
  const components = project.components;
  if (!components || drift.size === 0) return [];
  const elements = new Map((project.dfd?.elements ?? []).map((e) => [e.id, e]));
  return components.imports.flatMap((imported): Finding[] => {
    const status = drift.get(imported.id);
    if (!status) return [];
    const mp = components.instances.find((i) => i.importId === imported.id)?.multiprocessTfId;
    const at = mp && elements.has(mp) ? { elementId: mp, ...(elements.get(mp)!.displayId ? { displayId: elements.get(mp)!.displayId } : {}) } : {};
    // The app reads the imported state differently now — not a newer state of the component.
    const builder = status.kind !== "unreachable" && status.builderChanged
      ? [{ key: KEY("CMP_SNAPSHOT_BUILDER_CHANGED"), ...at, params: { component: imported.name } }]
      : [];
    if (status.kind === "up_to_date") return builder;
    if (status.kind === "newer_available" || status.kind === "diverged") {
      const where = status.tag ?? (status.commitSha ? status.commitSha.slice(0, 8) : "");
      const code = status.kind === "diverged" ? "CMP_SOURCE_DIVERGED" : "CMP_NEWER_STATE_AVAILABLE";
      return [...builder, { key: KEY(code), ...at, params: { component: imported.name, where } }];
    }
    return [{ key: KEY("CMP_SOURCE_UNREACHABLE"), ...at, params: { component: imported.name, reason: status.reason } }];
  });
}

// ==================== READING THE NEWER STATE ====================

/**
 * The newer state the drift check found, read like an import (phase 5c):
 * a pinned import at exactly that commit (`git show`, never the working
 * copy) with its source record moved to it; an unpinned one from its local
 * path (read in full — if the file is committed by now, the import is
 * pinned from then on).
 */
export async function readNewerComponentState(
  imported: ComponentImport,
  localPath: string,
  status: Extract<ComponentDriftStatus, { kind: "newer_available" }>,
  readFile: ComponentFileReader,
  git: ComponentGitRunner,
): Promise<ComponentSourceResult> {
  if (imported.source.unpinned || !status.commitSha || !imported.source.path) {
    return readComponentSource(localPath, readFile, git);
  }
  const top = await git(["rev-parse", "--show-toplevel"], dirOf(localPath));
  if (top.code !== 0) return { ok: false, error: "not_found", detail: "no repository" };
  const shown = await git(["show", `${status.commitSha}:${imported.source.path}`], top.stdout.trim());
  if (shown.code !== 0) return { ok: false, error: "not_found", detail: `${status.commitSha}:${imported.source.path}` };
  const read = componentSnapshotOfText(shown.stdout);
  if (!read.ok) return read;
  const { tag: _oldTag, ...source } = imported.source;
  return {
    ok: true,
    project: read.project,
    snapshot: read.snapshot,
    contentHash: read.contentHash,
    methodology: projectMethodologyFingerprint(read.project),
    source: { ...source, commitSha: status.commitSha, schemaVersion: read.schemaVersion, ...(status.tag ? { tag: status.tag } : {}) },
  };
}
