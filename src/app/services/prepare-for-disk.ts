// ==================== PREPARE FOR DISK ====================
// Single Responsibility: decide what a .tara.json is allowed to contain,
// and serialize it in one canonical, byte-stable form (TCS v1).
//
// WHY THIS IS ITS OWN MODULE
// --------------------------
// This logic used to live privately inside project-repository.ts, which meant
// only the repository's two write paths applied it. Every other writer —
// useProjectPersistence (Electron IPC, File System Access, download),
// useProjectFileDownload, projectService.exportProject,
// storageService.exportProjectAsJSON — called JSON.stringify(project) directly
// and shipped the runtime-only fields to disk.
//
// The concrete leak: `filePath` is the absolute path of the file on the
// author's machine. It ended up inside committed test fixtures and tripped the
// pre-commit secret scan; more importantly, every project file handed to a
// customer or attached to an audit carried the author's local directory layout.
// `hasUnsavedChanges` (a UI flag) and the recomputed `dfd.graph` (large, and
// rebuilt on load anyway) rode along the same way.
//
// It cannot live in project-repository.ts and be shared, because
// storage-service.ts needs it too and project-repository already imports from
// storage-service — exporting it there would close an import cycle.
//
// RULE: nothing writes or exports a Project without going through here.
// Adding a runtime-only field to Project means adding it to the Omit below.
//
// TCS (TARAflow Canonical Serialization) — see spec TCS-v1.md
// ----------------------------------------------------------
// For the audit trail to be defensible, the same project state MUST serialize
// to the same bytes on every machine, so that (a) Git diffs reflect semantic
// change, not serializer noise, and (b) the Audit Verification Engine can prove
// reproducibility by re-serializing a loaded project and comparing bytes.
//
// serialiseProject() now produces TCS output. Every existing caller therefore
// gets canonical bytes for free. The first save of a pre-TCS file is a one-time
// reformat (keys reorder, trailing newline appears) — this is expected.
//
// IDEMPOTENCE / CHURN (2026-07-31)
// --------------------------------
// TCS promises "same state → same bytes → same commit". That only holds if the
// on-disk form contains no field that changes without a real content change.
// These were quietly breaking it and are now stripped or normalized here:
//   - audit.lastCommitState — the app wrote the commit RESULT (incl. the commit
//     HASH) back into the very file the commit committed. A commit can never
//     contain its own hash, so the file was dirty the instant any commit
//     finished. Audit results live in git; the UI derives "last commit" from
//     `git log`. (commitHistory + the audit-internal lastModified sentinel go
//     with it — bookkeeping, not content.)
//   - dfd.thumbnail — draw.io embeds a random `ge-svg-<rand>` id that
//     regenerates on every render → a guaranteed diff even for an unchanged
//     diagram. The id is pinned to a stable value; the preview is kept.
//   - isOpen / lastOpened / currentPhase — session and navigation state, not
//     project content. (lastOpened ordering is tracked by the registry, which
//     falls back to now().)
// info.lastModified is deliberately KEPT — the recent-projects list displays it.
// Its remaining "bumped on every save" churn is a separate, narrower fix
// (bump only on real change), not a strip.
//
// LOCAL / CREDENTIAL FIELDS IN audit.config (2026-08-09)
// ------------------------------------------------------
// The signing/auth config carried per-user, machine-local values into the
// shared file — the same class of leak as `filePath`:
//   - signing.sshSigningKeyPath / auth.sshKeyPath — ABSOLUTE local key paths
//     (e.g. /home/<user>/.ssh/…). A privacy leak when the file is shared, and
//     machine-specific churn when a colleague opens the same project.
//   - signing.keyId / gpg.keyId — a specific signer's key id (per-user).
//   - auth.patAccount — a credential-store account handle (per-user).
//   - *.hasStoredKey — a runtime presence flag.
// These belong in the credential-service, not the project file. They are
// stripped here (`configForDisk`); only project-level policy stays:
// signing.{enabled,format}, gpg.{enabled}, auth.{method}, and the rest of the
// config (provider, remoteUrl, branches, author, rounds).
//
// IMPORTANT: this is the WRITE half. The OPEN/LOAD path must HYDRATE the stripped
// signing fields from the credential-service (credentials.getSSHKeyPath), or
// signing settings won't survive a reload. Ship both halves together.

import type { Project } from "../models/project-types";

// The canonical TCS serializer lives in its own project-types-free module
// (./tcs-serialize) so the Electron main process and the CLI can import it
// WITHOUT dragging the Project type graph. Imported for local use below and
// re-exported so existing callers of prepare-for-disk keep working unchanged.
import { canonicalStringify } from "./tcs-serialize";

/** The audit block as it may appear on disk — results/bookkeeping removed. */
type AuditDataOnDisk = Omit<
  NonNullable<Project["audit"]>,
  "lastCommitState" | "commitHistory" | "lastModified"
>;

/** The audit config as it appears in memory (derived from Project, no new import). */
type AuditConfigShape = NonNullable<Project["audit"]>["config"];

/** A Project as it may appear in a .tara.json — runtime-only fields removed. */
export type ProjectOnDisk = Omit<
  Project,
  | "hasUnsavedChanges"
  | "filePath"
  | "isOpen"
  | "lastOpened"
  | "currentPhase"
  | "audit"
> & { audit: AuditDataOnDisk | null };

/**
 * Pin draw.io's random export id so an unchanged diagram serializes identically.
 * The thumbnail is a `data:image/svg+xml;base64,…` URL; draw.io embeds one
 * random `ge-svg-<rand>` id (root <svg id> + a matching <style> selector) that
 * regenerates on every render. atob yields a byte-string (each char ≤ 0xFF), so
 * btoa round-trips even UTF-8 labels safely. Any hiccup → return input unchanged
 * (a preview quirk must never break a save).
 */
function normalizeThumbnail(thumbnail: string | undefined): string | undefined {
  if (!thumbnail) return thumbnail;
  const PREFIX = "data:image/svg+xml;base64,";
  if (!thumbnail.startsWith(PREFIX)) return thumbnail;
  try {
    const svg = atob(thumbnail.slice(PREFIX.length));
    const pinned = svg.replace(/ge-svg-[A-Za-z0-9_-]+/g, "ge-svg-thumb");
    return PREFIX + btoa(pinned);
  } catch {
    return thumbnail;
  }
}

/**
 * Strip per-user / machine-local / credential values from the audit config,
 * keeping only project-level policy. Pure — returns a new config. The stripped
 * signing fields are re-hydrated from the credential-service on open.
 */
function configForDisk(config: AuditConfigShape): AuditConfigShape {
  const { signing, gpg, auth, ...rest } = config;
  // Guarded: prepareForDisk must never throw on a partial config (a minimal or
  // migrated one may lack a sub-object). Reduce each only when present.
  return {
    ...rest,
    // Keep the auth METHOD (project policy); drop the account handle + key path.
    ...(auth ? { auth: { method: auth.method } } : {}),
    // Keep whether GPG signing is on; drop the specific key id + runtime flag.
    ...(gpg ? { gpg: { enabled: gpg.enabled } } : {}),
    // Keep whether signing is on + the format; drop key id / key path / flag.
    ...(signing
      ? { signing: { enabled: signing.enabled, format: signing.format } }
      : {}),
  } as AuditConfigShape;
}

/** Drop audit RESULTS + the internal lastModified sentinel; reduce the config. */
function auditForDisk(audit: NonNullable<Project["audit"]>): AuditDataOnDisk {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lastCommitState, commitHistory, lastModified, ...rest } = audit;
  return { ...rest, config: configForDisk(rest.config) };
}

/**
 * Strip runtime-only and derived data from a project before it leaves the app.
 *
 * Removed entirely (never on disk):
 * - `filePath`            where this file lives on THIS machine; a privacy leak
 *                         when shared, and set again on load.
 * - `hasUnsavedChanges`   UI state; meaningless once written.
 * - `isOpen` / `lastOpened` / `currentPhase`  session + navigation state.
 * Reduced:
 * - `dfd.graph`           derived, rebuilt on load, and large → dropped.
 * - `dfd.thumbnail`       kept but its random id pinned (see normalizeThumbnail).
 * - `audit`               audit RESULTS (lastCommitState/commitHistory) and the
 *                         internal lastModified sentinel dropped; config reduced
 *                         to project-level policy (see configForDisk).
 *
 * Pure: returns a new object, mutates nothing. The in-memory project keeps all
 * of its fields — filePath is needed for the next save, currentPhase/isOpen for
 * the running UI, and the full signing config for the current session's commits.
 */
export function prepareForDisk(project: Project): ProjectOnDisk {
  // Runtime-only / session / navigation fields never reach disk.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    hasUnsavedChanges,
    filePath,
    isOpen,
    lastOpened,
    currentPhase,
    audit,
    ...rest
  } = project;

  return {
    ...rest,
    dfd: project.dfd
      ? {
          ...project.dfd,
          graph: undefined,
          thumbnail: normalizeThumbnail(project.dfd.thumbnail),
        }
      : null,
    audit: audit ? auditForDisk(audit) : null,
  };
}

// ==================== TCS CANONICAL SERIALIZATION ====================
// The serializer (canonicalStringify / TCS_VERSION) now lives in ./tcs-serialize
// (project-types-free) and is imported + re-exported at the top of this file.

/**
 * The canonical on-disk representation of a Project: prepareForDisk + TCS v1.
 * This is the ONLY function that should ever produce the bytes of a .tara.json.
 */
export function serializeTCS(project: Project): string {
  return canonicalStringify(prepareForDisk(project));
}

/**
 * Backwards-compatible name kept for every existing caller. Now produces TCS
 * output, so all writers (export, download, file save) become canonical without
 * any change at the call site.
 *
 * Previously: JSON.stringify(prepareForDisk(project), null, 2)
 */
export function serialiseProject(project: Project): string {
  return serializeTCS(project);
}