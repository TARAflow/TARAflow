// ==================== CHANGES THE AUDIT DIFF DOES NOT LIST ====================
// Review of patch 134 (2026-11-20): when the DiffService lists no change but
// git reports the project file modified, the Audit tab offered "Derived
// values only" — without checking it. Every change in a field the diff does
// not cover went into the signed trail under a description that was then
// wrong.
//
// 0.20 item 16 (decided with the user 2026-11-22): not only then. The diff
// compares a chosen set of fields; a commit that listed one of them signed
// every other change of the file with it, unnamed — a threat's relevance, a
// risk's treatment, the project's tags, the hazards, the compliance
// statements. Now every commit names them: the committed file (HEAD) against
// the file that is committed (the working copy) — both written by
// prepareForDisk, compared with sameValue (no false changes from key order)
// — each changed field the DiffService does not cover and the register
// (models/audit-field-register.ts) does not leave out, with old → new.
//
// Paths go by record keys, not positions: risks.risks[R-12].treatment, an
// insert does not shift every later record. Sorted, at most MAX_LISTED_PATHS
// in the commit, the rest counted. English, like the rest of the trail.
//
// When the diff lists nothing and every changed field is one the register
// leaves out, the commit is "Derived values" (the places named).

import { sameValue } from "shared/utils/same-value";
import type { ChangeDetail, PhaseChanges } from "../models/audit-types";
import { auditFieldEntry, isSecretPath, matchesPath, type AuditFieldClass } from "../models/audit-field-register";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const escape = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");
const isObject = (v: unknown): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);
const isPrimitive = (v: unknown) => v === null || (typeof v !== "object" && typeof v !== "function");

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

// ---------------------------------------------------------------- field diff

/**
 * The project as the audit compares it: the file's JSON with the threat
 * tables flattened to threats.perElement / threats.perInteraction — a table
 * only groups threats, its own fields come from the DFD.
 */
export function auditView(file: unknown): Json {
  if (!isObject(file)) return file ?? {};
  const view: Json = { ...file };
  const threats = view.threats;
  if (isObject(threats)) {
    const flat = (tables: unknown) => (Array.isArray(tables) ? tables : []).flatMap((t: Json) => (Array.isArray(t?.threats) ? t.threats : []));
    const { perElementTables, perInteractionTables, ...rest } = threats;
    view.threats = { ...rest, perElement: flat(perElementTables), perInteraction: flat(perInteractionTables) };
  }
  return view;
}

/** Arrays whose entries carry their key in another field than `id`. */
const KEYS: { path: string[]; key: (x: Json) => unknown }[] = [
  { path: ["dfd", "pages"], key: (x) => x.pageId },
  { path: ["hazards", "relations"], key: (x) => (x.from && x.to ? `${x.from}->${x.to}${x.type ? `:${x.type}` : ""}` : undefined) },
  { path: ["**", "securityGoals"], key: (x) => x.type },
  { path: ["**", "impactRatings"], key: (x) => x.criterionId },
  { path: ["**", "factorRatings"], key: (x) => x.factorId },
  { path: ["**", "mitigatedFactorRatings"], key: (x) => x.factorId },
  { path: ["**", "activeFactors"], key: (x) => x.factorId },
  { path: ["**", "eeMapping"], key: (x) => x.componentEeId },
  { path: ["components", "instances", "*", "assumptions"], key: (x) => x.assumptionId },
  { path: ["**", "linkedDFDElements"], key: (x) => (x.elementId ? `${x.elementId}:${x.relationType ?? ""}` : undefined) },
];

/** The keys of an array of records ("[R-12]"), or undefined — then by position ("[3]"). */
function keysOf(path: string[], list: Json[]): string[] | undefined {
  if (list.length === 0 || !list.every(isObject)) return undefined;
  const special = KEYS.find((k) => matchesPath(k.path, path));
  const keys = list.map((x) => (special ? special.key(x) : x.id));
  if (!keys.every((k) => typeof k === "string" && k !== "")) return undefined;
  return new Set(keys).size === keys.length ? keys.map((k) => `[${k}]`) : undefined;
}

export interface FieldChange {
  /** Segments: object keys, "[record key]" or "[position]" for array entries. */
  path: string[];
  before: unknown;
  after: unknown;
}

/** Every changed field between two audit views; records paired by key, a list of values as one field. */
export function fieldChanges(before: unknown, after: unknown, path: string[] = []): FieldChange[] {
  // no canonical compare of whole subtrees here: the walk finds the
  // differences itself (linear) — sameValue only where a value is compared whole
  if (before === after) return [];
  const out: FieldChange[] = [];
  const push = (p: string[], b: unknown, a: unknown) => out.push({ path: p, before: b, after: a });
  if (isObject(before) && isObject(after)) {
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      if (key in before && key in after) out.push(...fieldChanges(before[key], after[key], [...path, key]));
      else if (!sameValue(before[key], after[key])) push([...path, key], before[key], after[key]);
    }
    return out;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.every(isPrimitive) && after.every(isPrimitive)) {
      if (!sameValue(before, after)) push(path, before, after);
      return out;
    }
    const bk = keysOf(path, before);
    const ak = keysOf(path, after);
    if ((bk || ak) && (bk || before.length === 0) && (ak || after.length === 0)) {
      const bm = new Map((bk ?? []).map((k, i) => [k, before[i]]));
      const am = new Map((ak ?? []).map((k, i) => [k, after[i]]));
      for (const k of new Set([...(bk ?? []), ...(ak ?? [])])) {
        if (bm.has(k) && am.has(k)) out.push(...fieldChanges(bm.get(k), am.get(k), [...path, k]));
        else push([...path, k], bm.get(k), am.get(k));
      }
      return out;
    }
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      if (i < before.length && i < after.length) out.push(...fieldChanges(before[i], after[i], [...path, `[${i}]`]));
      else push([...path, `[${i}]`], before[i], after[i]);
    }
    return out;
  }
  if (!sameValue(before, after)) push(path, before, after);
  return out;
}

/**
 * "risks.risks[R-12].treatment". `labels` names a record by what the analyst
 * sees ("[DB-E-1]" for the threat "[00c8f01d-…]", 0.20 manual test D4) —
 * the path stays the record's key where there is no label.
 */
export function formatFieldPath(path: readonly string[], labels?: ReadonlyMap<string, string>): string {
  return path.reduce((s, seg) => {
    if (!seg.startsWith("[")) return s ? `${s}.${seg}` : seg;
    const label = labels?.get(seg.slice(1, -1));
    return `${s}${label ? `[${label}]` : seg}`;
  }, "");
}

/**
 * Record id → the label the analyst sees: a display id (threats, assets,
 * DFD elements), "R-<threat>" for a risk. A hazard keeps its id (its label
 * is a sentence). Ids that two records share keep no label (the path stays
 * unambiguous).
 */
export function recordLabels(...views: unknown[]): Map<string, string> {
  const labels = new Map<string, string>();
  const clash = new Set<string>();
  const add = (id: string, label: string) => {
    const known = labels.get(id);
    if (known !== undefined && known !== label) clash.add(id);
    else labels.set(id, label);
  };
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const x of v) {
        if (isObject(x) && typeof x.id === "string") {
          const label =
            typeof x.displayId === "string" && x.displayId
              ? x.displayId
              : typeof x.threatDisplayId === "string" && x.threatDisplayId
                ? `R-${x.threatDisplayId}`
                : undefined;
          if (label && label !== x.id) add(x.id, label);
        }
        walk(x);
      }
    } else if (isObject(v)) for (const x of Object.values(v)) walk(x);
  };
  for (const view of views) walk(view);
  for (const id of clash) labels.delete(id);
  // a label two records carry would hide which one changed
  const count = new Map<string, number>();
  for (const l of labels.values()) count.set(l, (count.get(l) ?? 0) + 1);
  for (const [id, l] of labels) if ((count.get(l) ?? 0) > 1) labels.delete(id);
  return labels;
}

// ---------------------------------------------------------------- unlisted

export interface UnlistedChange {
  path: string;
  before: unknown;
  after: unknown;
  /** Credentials: listed without their values. */
  secret?: boolean;
  /** Derived only: why the register leaves it out (derived, presentation, …). */
  notAudited?: AuditFieldClass;
}

export interface UnlistedChanges {
  /** Every changed field is one the register leaves out as not audited. */
  derivedOnly: boolean;
  /** The places, sorted: the audited fields the diff does not list — or, derived only, the derived ones (timestamps only if nothing else). */
  changes: UnlistedChange[];
}

/** How a place that is not audited is named in the commit. */
const NOT_AUDITED_NAME: Record<AuditFieldClass, string> = {
  covered: "derived value",
  derived: "derived value",
  presentation: "layout or report setting",
  runtime: "session state",
  snapshot: "component snapshot",
};
const isTimestamp = (path: string[]) => /^(lastModified|lastValidated|created)$/.test(path[path.length - 1] ?? "");

/**
 * What changed between the committed file and the one to commit that the
 * audit diff does not list. `listedByDiff`: the diff listed changes — the
 * fields it covers are left out (they are in its lines). Unreadable text →
 * not derived, no places.
 */
export function unlistedChanges(
  headText: string | null | undefined,
  fileText: string | null | undefined,
  opts: { listedByDiff?: boolean } = {},
): UnlistedChanges {
  if (!headText || !fileText) return { derivedOnly: false, changes: [] };
  let before: unknown;
  let after: unknown;
  try {
    before = JSON.parse(headText);
    after = JSON.parse(fileText);
  } catch {
    return { derivedOnly: false, changes: [] };
  }
  return unlistedChangesOf(before, after, opts);
}

/** unlistedChanges on the parsed files. */
export function unlistedChangesOf(before: unknown, after: unknown, opts: { listedByDiff?: boolean } = {}): UnlistedChanges {
  const beforeView = auditView(before);
  const afterView = auditView(after);
  const all = fieldChanges(beforeView, afterView).map((c) => ({ ...c, entry: auditFieldEntry(c.path) }));
  const labels = all.length > 0 ? recordLabels(afterView, beforeView) : undefined;
  const audited = all.filter((c) => !c.entry || (c.entry.class === "covered" && !opts.listedByDiff));
  const derivedOnly = all.length > 0 && audited.length === 0;
  const meaningful = all.filter((c) => !isTimestamp(c.path));
  const shown = derivedOnly ? (meaningful.length > 0 ? meaningful : all) : audited;
  const changes = shown
    .map((c) => ({
      path: formatFieldPath(c.path, labels),
      before: withoutSecrets(c.path, c.before),
      after: withoutSecrets(c.path, c.after),
      ...(isSecretPath(c.path) ? { secret: true } : {}),
      ...(derivedOnly && c.entry ? { notAudited: c.entry.class } : {}),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { derivedOnly, changes };
}

/**
 * The value with every part under a secret field name (a token, a password)
 * replaced by "(set)" — wherever the change sits: a whole section removed
 * printed it as JSON (0.20 manual test D7, 2026-11-26).
 */
export function withoutSecrets(path: readonly string[], value: unknown): unknown {
  if (isSecretPath(path)) return value === undefined ? undefined : "(set)";
  if (Array.isArray(value)) return value.map((x, i) => withoutSecrets([...path, `[${i}]`], x));
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutSecrets([...path, k], v)]));
  return value;
}

/** At most this many places in the commit; the rest counted. */
export const MAX_LISTED_PATHS = 20;
const MAX_VALUE = 120;

/** A value on one line of the commit body: plain values as they are, the rest as JSON, cut. */
function oneLine(value: unknown): unknown {
  if (value === undefined || value === null || typeof value === "number" || typeof value === "boolean") return value;
  const text = (Array.isArray(value) && value.every(isPrimitive) ? `[${value.join(", ")}]` : typeof value === "string" ? value : JSON.stringify(value))
    .replace(/\s*\r?\n\s*/g, " ⏎ ")
    .trim();
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text;
}

const valueTypeOf = (v: unknown): ChangeDetail["valueType"] =>
  Array.isArray(v) ? "array" : v !== null && typeof v === "object" ? "object" : typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "string";

/**
 * The change list for the commit: "Derived values" with the places, or
 * "Not listed by the audit diff" with the places and old → new.
 */
export function unlistedChangeList(changes: UnlistedChanges): PhaseChanges[] {
  const shown = changes.changes.slice(0, MAX_LISTED_PATHS);
  const more = changes.changes.length - shown.length;
  const items = shown.map((c) => ({
    type: "modified" as const,
    id: c.path,
    name: changes.derivedOnly ? NOT_AUDITED_NAME[c.notAudited ?? "derived"] : "not listed by the audit diff",
    description: changes.derivedOnly ? "A value the trail does not list by name" : "A change the audit diff does not list",
    ...(changes.derivedOnly
      ? {}
      : {
          details: [
            {
              field: c.path,
              fieldLabel: "value",
              oldValue: c.secret ? (c.before === undefined ? undefined : "(set)") : oneLine(c.before),
              newValue: c.secret ? (c.after === undefined ? undefined : "(changed)") : oneLine(c.after),
              valueType: valueTypeOf(c.after ?? c.before),
            },
          ],
        }),
  }));
  if (more > 0) items.push({ type: "modified", id: "…", name: `${more} more`, description: `${more} more places` });
  if (items.length === 0) {
    items.push({ type: "modified", id: "file", name: "the file differs from HEAD", description: "The places could not be read" });
  }
  return [
    changes.derivedOnly
      ? { phase: "derived", phaseLabel: "Derived values", changeCount: changes.changes.length, changes: items }
      : { phase: "unlisted", phaseLabel: "Changes the audit diff does not list", changeCount: Math.max(changes.changes.length, 1), changes: items },
  ];
}

/**
 * The commit's change list: the audit diff's, plus what it does not list.
 * `fileDiffers`: git reports the file modified against HEAD.
 */
export function withUnlistedChanges(
  listed: PhaseChanges[],
  headText: string | null | undefined,
  fileText: string | null | undefined,
  fileDiffers: boolean,
): PhaseChanges[] {
  if (!fileDiffers) return listed;
  if (listed.length === 0) return unlistedChangeList(unlistedChanges(headText, fileText));
  const extra = unlistedChanges(headText, fileText, { listedByDiff: true });
  if (extra.derivedOnly || extra.changes.length === 0) return listed;
  return [...listed, ...unlistedChangeList(extra)];
}
