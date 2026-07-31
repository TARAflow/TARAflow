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

import type { Project } from "../models/project-types";

/** TCS ruleset version. Bumping this is a deliberate, file-reformatting change. */
export const TCS_VERSION = 1;

/** A Project as it may appear in a .tara.json — runtime-only fields removed. */
export type ProjectOnDisk = Omit<Project, "hasUnsavedChanges" | "filePath">;

/**
 * Strip runtime-only and derived data from a project before it leaves the app.
 *
 * - `filePath`            where this file happens to live on THIS machine; set
 *                         again on load, and a privacy leak when shared.
 * - `hasUnsavedChanges`   UI state; meaningless once written.
 * - `dfd.graph`           derived, rebuilt on load, and large.
 *
 * Pure: returns a new object, mutates nothing. The in-memory project keeps its
 * filePath — it is needed for the next save.
 */
export function prepareForDisk(project: Project): ProjectOnDisk {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { hasUnsavedChanges, filePath, ...rest } = project;
  return {
    ...rest,
    dfd: project.dfd ? { ...project.dfd, graph: undefined } : null,
  };
}

// ==================== TCS CANONICAL SERIALIZATION ====================
//
// We do NOT use JSON.stringify with a pre-sorted object, because V8 enumerates
// integer-like keys ("0", "1", "42") in numeric order regardless of insertion
// order — so an object built with sorted keys would still emit those keys in
// the engine's order, not ours. phaseStatus is exactly such a map. A dedicated
// stringifier emits keys in our sorted order explicitly and sidesteps the quirk.

/** Compare two strings by Unicode code point (correct for astral-plane chars). */
function compareCodePoint(a: string, b: string): number {
  const ca = Array.from(a);
  const cb = Array.from(b);
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i++) {
    const d = ca[i].codePointAt(0)! - cb[i].codePointAt(0)!;
    if (d !== 0) return d;
  }
  return ca.length - cb.length;
}

/**
 * Canonical JSON per TCS v1:
 *   - object keys recursively sorted by code point
 *   - arrays keep their order (order can be semantic — never blind-sorted)
 *   - `undefined` object members dropped; `undefined` array slots → null
 *   - non-finite numbers (NaN/Infinity) rejected, not silently coerced to null
 *   - -0 normalized to 0
 *   - 2-space indent, LF newlines (JSON.stringify emits \n on every platform)
 *
 * No trailing newline here — callers add exactly one (see canonicalStringify).
 */
function tcsStringify(value: unknown, indent: string, step: string): string {
  if (value === null) return "null";

  const t = typeof value;

  if (t === "number") {
    const n = value as number;
    if (!Number.isFinite(n)) {
      throw new Error(
        `TCS: non-finite number (${n}) cannot be serialized. ` +
          `Fix the source data before writing.`,
      );
    }
    return Object.is(n, -0) ? "0" : JSON.stringify(n);
  }

  if (t === "string" || t === "boolean") {
    // JSON.stringify already does minimal escaping and keeps non-ASCII literal.
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const inner = indent + step;
    const items = value.map(
      (v) => inner + tcsStringify(v === undefined ? null : v, inner, step),
    );
    return "[\n" + items.join(",\n") + "\n" + indent + "]";
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(compareCodePoint);
    if (keys.length === 0) return "{}";
    const inner = indent + step;
    const parts = keys.map(
      (k) =>
        inner +
        JSON.stringify(k) +
        ": " +
        tcsStringify(obj[k], inner, step),
    );
    return "{\n" + parts.join(",\n") + "\n" + indent + "}";
  }

  // undefined / function / symbol at a position we can't represent.
  throw new Error(`TCS: unsupported value of type "${t}".`);
}

/**
 * Canonically serialize ANY already-plain value to a TCS string (with the single
 * trailing newline). Used by the Verification Engine to re-serialize a project
 * object loaded from a historical commit and compare it byte-for-byte with what
 * is stored there.
 */
export function canonicalStringify(value: unknown): string {
  return tcsStringify(value, "", "  ") + "\n";
}

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