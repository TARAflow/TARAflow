// ==================== COMPONENT SOURCE ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §4.1, §17
// I1): reads a component TARA for the import — checked, migrated, reduced to
// its snapshot. Pure apart from the injected git runner and file reader, so
// it is testable without Electron (the IPC adapters are in
// component-source-electron.ts).
//
// Checks, in order:
//   1. the file is valid JSON of a TARAflow project
//   2. it lies in a git working copy, is tracked and clean (committed) — no
//      draft imports (D6)
//   3. it is not written by a newer TARAflow (schema too new)
//   4. migration is deterministic (I1): migrated twice, the snapshot hashes
//      must agree — old files get fresh ids on every migration
// The source (remote URL, branch, tag, commit) is recorded; the local path
// never leaves this function.

import type { ComponentSource, MethodologyFingerprint } from "shared";
import type { Project } from "../../models/project-types";
import type { ComponentSnapshot } from "../../models/component-snapshot-types";
import { parseAndRepairWithMetadata, isRecognisableProject } from "../migration-service";
import {
  buildComponentSnapshot,
  projectMethodologyFingerprint,
  snapshotContentHash,
} from "./snapshot-builder";

/** Runs git in a directory; never throws — failures are a non-zero code. */
export type ComponentGitRunner = (
  args: string[],
  cwd: string,
) => Promise<{ stdout: string; stderr: string; code: number }>;

/** Reads a text file; null when it does not exist. */
export type ComponentFileReader = (path: string) => Promise<string | null>;

export type ComponentSourceError =
  | "not_found"
  | "invalid"
  | "not_in_repo"
  | "untracked"
  | "dirty"
  | "schema_too_new"
  | "not_deterministic";

export interface ComponentSourceOk {
  ok: true;
  /** The migrated component project (for the EE mapping and the preview). */
  project: Project;
  snapshot: ComponentSnapshot;
  contentHash: string;
  methodology: MethodologyFingerprint | null;
  source: ComponentSource;
}

export interface ComponentSourceFailure {
  ok: false;
  error: ComponentSourceError;
  /** Technical detail for the log / tooltip (git stderr, parse message). */
  detail?: string;
}

export type ComponentSourceResult = ComponentSourceOk | ComponentSourceFailure;

const fail = (error: ComponentSourceError, detail?: string): ComponentSourceFailure => ({
  ok: false,
  error,
  ...(detail ? { detail } : {}),
});

function dirOf(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : ".";
}

function baseOf(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

/** Migrates a deep copy of the raw file; null when it cannot be read as a project. */
function migrate(raw: unknown): Project | null {
  return parseAndRepairWithMetadata(structuredClone(raw))?.project ?? null;
}

/** Reads, checks and reduces a component TARA (design §4.1, §17 I1). */
export async function readComponentSource(
  filePath: string,
  readFile: ComponentFileReader,
  git: ComponentGitRunner,
): Promise<ComponentSourceResult> {
  // 1. JSON of a TARAflow project
  const text = await readFile(filePath);
  if (text === null) return fail("not_found");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return fail("invalid", err instanceof Error ? err.message : String(err));
  }
  if (!isRecognisableProject(raw)) return fail("invalid");

  // 2. git: tracked and clean
  const cwd = dirOf(filePath);
  const file = baseOf(filePath);
  const top = await git(["rev-parse", "--show-toplevel"], cwd);
  if (top.code !== 0) return fail("not_in_repo", top.stderr.trim());
  const tracked = await git(["ls-files", "--error-unmatch", "--", file], cwd);
  if (tracked.code !== 0) return fail("untracked");
  const status = await git(["status", "--porcelain", "--", file], cwd);
  if (status.code !== 0 || status.stdout.trim() !== "") return fail("dirty", status.stdout.trim());

  // 3. + 4. migrate twice: schema too new, determinism
  const schemaVersion = Number((raw as { schemaVersion?: unknown }).schemaVersion ?? 0);
  let first: Project | null;
  let second: Project | null;
  try {
    first = migrate(raw);
    second = migrate(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/Unsupported schema version/.test(message)) return fail("schema_too_new", message);
    return fail("invalid", message);
  }
  if (!first || !second) return fail("invalid");
  const snapshot = buildComponentSnapshot(first);
  const contentHash = snapshotContentHash(snapshot);
  if (snapshotContentHash(buildComponentSnapshot(second)) !== contentHash) {
    return fail("not_deterministic");
  }

  // Source record — remote URL, never the local path.
  const sha = await git(["rev-parse", "HEAD"], cwd);
  if (sha.code !== 0) return fail("not_in_repo", sha.stderr.trim());
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const remote = await git(["remote", "get-url", "origin"], cwd);
  const tags = await git(["tag", "--points-at", "HEAD"], cwd);
  const branchName = branch.code === 0 ? branch.stdout.trim() : "";
  const tag = tags.code === 0 ? tags.stdout.split("\n").map((t) => t.trim()).filter(Boolean).sort()[0] : undefined;
  const source: ComponentSource = {
    commitSha: sha.stdout.trim(),
    schemaVersion,
    ...(remote.code === 0 && remote.stdout.trim() ? { repoUrl: remote.stdout.trim() } : {}),
    ...(branchName && branchName !== "HEAD" ? { branch: branchName } : {}),
    ...(tag ? { tag } : {}),
  };

  return {
    ok: true,
    project: first,
    snapshot,
    contentHash,
    methodology: projectMethodologyFingerprint(first),
    source,
  };
}

/**
 * Every component project id in a snapshot: the component itself and,
 * recursively, the components it imported (design §6.5).
 */
export function componentIdsOf(snapshot: ComponentSnapshot): Set<string> {
  const ids = new Set<string>([snapshot.component.projectId]);
  for (const nested of snapshot.components?.imports ?? []) {
    ids.add(nested.componentId);
    for (const id of componentIdsOf(nested.snapshot)) ids.add(id);
  }
  return ids;
}

/**
 * A component that is the machine itself, or contains it through its own
 * imports, cannot be imported (design §4.1).
 */
export function isComponentCycle(machineProjectId: string, snapshot: ComponentSnapshot): boolean {
  return componentIdsOf(snapshot).has(machineProjectId);
}
