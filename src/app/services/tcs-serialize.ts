// ==================== TCS CANONICAL SERIALIZATION ====================
// The pure canonical serializer (TCS v1), extracted from prepare-for-disk so it
// can be imported WITHOUT pulling in the Project type graph.
//
// WHY ITS OWN MODULE
// ------------------
// `canonicalStringify` operates on any plain value (`unknown`) and needs no app
// types. It used to live in prepare-for-disk.ts — but that module imports
// `../models/project-types` (for `prepareForDisk(project: Project)`), and
// project-types transitively imports EVERY feature via path aliases
// (`features/*`, `shared`). So importing `canonicalStringify` from
// prepare-for-disk dragged the whole app type graph into any consumer's compile.
//
// The Audit Verification Engine wiring (Electron MAIN via
// electron/services/audit-verify-main.ts, and the CLI) needs `canonicalStringify`
// but must NOT pull the app type graph into `tsconfig.electron.json` (which does
// not define the app path aliases) — that caused TS2307 on project-types.ts.
//
// So the serializer lives here (no project-types import), and prepare-for-disk
// re-exports it for existing callers. Import canonicalStringify from HERE in any
// non-renderer (main/CLI) context.
//
// Location: src/app/services/tcs-serialize.ts

/** TCS ruleset version. Bumping this is a deliberate, file-reformatting change. */
export const TCS_VERSION = 1;

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
        inner + JSON.stringify(k) + ": " + tcsStringify(obj[k], inner, step),
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
