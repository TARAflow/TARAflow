// src/tests/unit/features/audit/services/audit-diff-coverage.test.ts
//
// 0.20 item 16: every change of the project file goes into the audit commit.
// Every field of the fixtures is changed once (one sample per field kind and
// file); for each change:
//   - the DiffService lists it, or the unlisted-change list names it — not
//     both (no double lines), and
//   - a field the register calls "covered" is listed by the DiffService, and
//   - a field neither lists is one the register leaves out on purpose
//     (derived, presentation, runtime, snapshot).
// A new field fails here until it is listed or registered.
//
// More files (e.g. the TARAflow_Examples), locally:
//   AUDIT_COVERAGE_FILES=../TARAflow_Examples/Pump.tara.json,… npx vitest run <this file>

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { diffService } from "features/audit/services/diff-service";
import { auditView, fieldChanges, formatFieldPath, unlistedChangesOf } from "features/audit/services/unlisted-changes";
import { auditFieldEntry } from "features/audit/models/audit-field-register";
import type { Project } from "app";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const FIXTURES = [
  "SmokeDetector.tara.json",
  "headlamp-iso21434.tara.json",
  "cnc-ref.tara.json",
  "Simple_Test_Project.tara.json",
  "examples/simple-controller.base.tara.json",
  "component-0.19/SmokeDetectorCase.tara.json",
].map((f) => resolve(__dirname, "../../../../fixtures", f));
const EXTRA = (process.env.AUDIT_COVERAGE_FILES ?? "").split(",").filter(Boolean);

/** Every leaf (and every empty array / object) of a JSON value, as key paths. */
function leaves(v: Json, base: (string | number)[] = [], out: (string | number)[][] = []) {
  if (Array.isArray(v)) {
    if (v.length === 0) out.push(base);
    v.forEach((x, i) => leaves(x, [...base, i], out));
  } else if (v && typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 0) out.push(base);
    keys.forEach((k) => leaves(v[k], [...base, k], out));
  } else out.push(base);
  return out;
}

function mutated(v: Json): Json {
  if (typeof v === "string") return `${v}x`;
  if (typeof v === "number") return v + 1;
  if (typeof v === "boolean") return !v;
  if (v === null) return "x";
  if (Array.isArray(v)) return [...v, "x"];
  return { ...v, probe: "x" };
}

/** The violations for one file: "<field kind>: <what is wrong>". */
function violations(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const original = JSON.parse(text);
  const out = new Set<string>();
  const seen = new Set<string>();
  for (const path of leaves(original)) {
    if (path.length === 0) continue;
    const kind = path.map((x) => (typeof x === "number" ? "*" : x)).join("/");
    if (seen.has(kind)) continue;
    seen.add(kind);
    // only the changed section is a copy; the others are the same objects,
    // which the compares pass over (keeps the test fast)
    const top = path[0] as string;
    const current = { ...original, [top]: structuredClone(original[top]) };
    let o: Json = current;
    for (const k of path.slice(0, -1)) o = o[k];
    const leaf = o[path[path.length - 1]];
    const emptyContainer = typeof leaf === "object" && leaf !== null && Object.keys(leaf).length === 0;
    o[path[path.length - 1]] = mutated(leaf);

    const listed = diffService.detectChanges(current as Project, original as Project).length > 0;
    const unlisted = unlistedChangesOf(original, current, { listedByDiff: true });
    const named = !unlisted.derivedOnly && unlisted.changes.length > 0;
    const fields = fieldChanges(auditView(original), auditView(current));
    const classes = fields.map((f) => auditFieldEntry(f.path)?.class);
    const where = fields.map((f) => formatFieldPath(f.path)).join(", ") || kind;
    if (listed && named) out.add(`${kind}: listed twice (${where})`);
    // a junk value pushed into an empty list of records says nothing about the comparison
    if (classes.includes("covered") && !listed && !emptyContainer) out.add(`${kind}: registered as covered, but the DiffService does not list it (${where})`);
    if (!listed && !named && classes.some((c) => c === undefined || (c === "covered" && !emptyContainer))) out.add(`${kind}: in no list (${where})`);
  }
  return [...out].sort();
}

describe("audit diff coverage — every field of the file is listed, named or left out on purpose", () => {
  it.each([...FIXTURES, ...EXTRA])("%s", { timeout: 120_000 }, (file) => {
    expect(violations(file)).toEqual([]);
  });
});
