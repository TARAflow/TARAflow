// ==================== TCS CANONICAL SERIALIZATION ====================
// The pure canonical serializer (TCS v1) — the ONE definition of "canonical"
// for project files and the audit trail.
//
// WHY IN SHARED
// -------------
// Pure, no imports: usable from features (calculation stamps hash canonical
// JSON, ISO 21434 conformance plan 0c), from the app layer (prepare-for-disk),
// from the Electron main process and from the CLI verifier. Those last two
// import it through src/app/services/tcs-serialize.ts, which stays a pure
// re-export so their esbuild bundles and tsconfig.electron.json (no app path
// aliases) keep working.
//
// History: extracted from prepare-for-disk (2026-08-11) into
// app/services/tcs-serialize.ts so consumers did not drag the Project type
// graph; moved here 2026-10-24 so features can use it too.
//
// Location: src/shared/utils/tcs-canonical.ts

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
