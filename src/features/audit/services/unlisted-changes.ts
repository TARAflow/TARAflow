// ==================== CHANGES THE AUDIT DIFF DOES NOT LIST ====================
// Review of patch 134 (2026-11-20): when the DiffService lists no change but
// git reports the project file modified, the Audit tab offered "Derived
// values only" — without checking it. Every change in a field the diff does
// not cover went into the signed trail under a description that was then
// wrong.
//
// Now the changed places are determined: the committed file (HEAD) against
// the file that is committed (the working copy), compared as JSON, each
// difference as a JSON pointer. Only when every one of them is a known
// derived value — today the threat id the risk sync copies into a risk, and
// the timestamps — is it "derived values only". Otherwise it is "changes the
// audit diff does not list", with the places: each such case is a gap in the
// DiffService, shown instead of covered up. The places go into the commit.

import type { PhaseChanges } from "../models/audit-types";

/** Values the app derives; a change of only these is no analyst's change. */
export const DERIVED_VALUE_PATHS: readonly RegExp[] = [
  // the risk sync copies the threat's display id into its risk (renumbering)
  /^\/risks\/risks\/\d+\/threatDisplayId$/,
  // timestamps (the write guard skips a write of these alone)
  /(^|\/)lastModified$/,
  /(^|\/)lastValidated$/,
];

const escape = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The JSON pointers where `after` differs from `before` (leaves; a whole value where one side lacks it). */
export function changedJsonPaths(before: unknown, after: unknown, base = ""): string[] {
  if (Array.isArray(before) && Array.isArray(after)) {
    const out: string[] = [];
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      if (i >= before.length || i >= after.length) out.push(`${base}/${i}`);
      else out.push(...changedJsonPaths(before[i], after[i], `${base}/${i}`));
    }
    return out;
  }
  if (isObject(before) && isObject(after)) {
    const out: string[] = [];
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      const path = `${base}/${escape(key)}`;
      if (!(key in before) || !(key in after)) out.push(path);
      else out.push(...changedJsonPaths(before[key], after[key], path));
    }
    return out;
  }
  return Object.is(before, after) ? [] : [base || "/"];
}

export interface UnlistedChanges {
  /** Every changed place is a known derived value. */
  derivedOnly: boolean;
  /** The changed places (JSON pointers), timestamps left out unless nothing else changed. */
  paths: string[];
}

const isTimestamp = (p: string) => /(^|\/)(lastModified|lastValidated)$/.test(p);

/**
 * What changed between the committed file and the one to commit, when the
 * audit diff lists nothing. `undefined` texts (unreadable) → not derived,
 * no places known.
 */
export function unlistedChanges(headText: string | null | undefined, fileText: string | null | undefined): UnlistedChanges {
  if (!headText || !fileText) return { derivedOnly: false, paths: [] };
  let before: unknown;
  let after: unknown;
  try {
    before = JSON.parse(headText);
    after = JSON.parse(fileText);
  } catch {
    return { derivedOnly: false, paths: [] };
  }
  const all = changedJsonPaths(before, after);
  const derivedOnly = all.length > 0 && all.every((p) => DERIVED_VALUE_PATHS.some((re) => re.test(p)));
  const meaningful = all.filter((p) => !isTimestamp(p));
  return { derivedOnly, paths: meaningful.length > 0 ? meaningful : all };
}

/** At most this many places in the commit; the rest counted. */
export const MAX_LISTED_PATHS = 20;

/**
 * The change list for the commit: "Derived values" with the places, or
 * "Not listed by the audit diff" with the places.
 */
export function unlistedChangeList(changes: UnlistedChanges): PhaseChanges[] {
  const shown = changes.paths.slice(0, MAX_LISTED_PATHS);
  const more = changes.paths.length - shown.length;
  const items = shown.map((path) => ({
    type: "modified" as const,
    id: path,
    name: changes.derivedOnly ? "derived value" : "not listed by the audit diff",
    description: changes.derivedOnly ? "A value the app derives" : "A change the audit diff does not list",
  }));
  if (more > 0) items.push({ type: "modified", id: "…", name: `${more} more`, description: `${more} more places` });
  if (items.length === 0) {
    items.push({ type: "modified", id: "file", name: "the file differs from HEAD", description: "The places could not be read" });
  }
  return [
    changes.derivedOnly
      ? { phase: "derived", phaseLabel: "Derived values", changeCount: changes.paths.length, changes: items }
      : { phase: "unlisted", phaseLabel: "Changes the audit diff does not list", changeCount: Math.max(changes.paths.length, 1), changes: items },
  ];
}
