// Generic rules for every registered model field (model-coverage-
// implementation-plan.md §3, §7 "Generic"): checked once here for all fields
// of MODEL_FIELDS, so a field added with CM-5 … CM-7 is covered without a
// test of its own.
//
//   R-1  "not_specified" first; a yes/no field is exactly not_specified / yes / no
//   R-3  one predicate per field — no consumer decides "shown" on its own:
//        every source file that names a registered field reads it through
//        property-visibility (isFieldShown / readModelField /
//        withoutHiddenFields), except the declarations listed in DECLARATIVE
//   R-4  hidden = ignored everywhere (the evaluator masks through the same
//        predicate — evaluate-matrix.visibility.test.ts)
//   R-6  the element types exist and declare the property
//   R-7  label, help text and every value label in EN and DE
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { MODEL_FIELDS } from "shared";

const SRC = path.join(process.cwd(), "src");
const ELEMENT_TYPES = [
  "Process", "Multiprocess", "DataStore", "DataFlow", "ExternalEntity",
  "Interface", "TrustBoundary", "ChipBoundary", "PhysicalBoundary",
];

/** Files that name fields without reading them for a decision. */
const DECLARATIVE = [
  "shared/models/property-visibility.ts", // the registry
  "features/dfd/models/element-properties.ts", // the property types
  "features/compliance/data/evidence-rules.ts", // rules; the evaluator masks hidden fields
  "app/services/versions/", // migrations write the stored form
];
const PREDICATE_USE = /\b(isFieldShown|readModelField|withoutHiddenFields)\b/;

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "tests" && entry.name !== "node_modules") out.push(...sources(full));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

const FILES = sources(SRC).map((file) => ({ rel: path.relative(SRC, file).split(path.sep).join("/"), text: fs.readFileSync(file, "utf-8") }));

/** Files that name `property` but neither declare it nor use the predicate. */
function bypasses(property: string): string[] {
  const named = new RegExp(`\\b${property}\\b`);
  return FILES.filter(
    (f) => named.test(f.text) && !DECLARATIVE.some((d) => f.rel.startsWith(d)) && !PREDICATE_USE.test(f.text),
  ).map((f) => f.rel);
}

function dfdLocale(lang: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(SRC, "i18n/locales", lang, "dfd.json"), "utf-8"));
}
const fieldTexts = (lang: string, property: string): Record<string, unknown> | undefined =>
  ((dfdLocale(lang).tabs as Record<string, Record<string, unknown>>)?.dfd?.modelFields as Record<string, Record<string, unknown>> | undefined)?.[property];

describe("the guard itself", () => {
  it("finds a property read around the predicate (inputValidation is read directly by forms and rules)", () => {
    expect(bypasses("inputValidation").length).toBeGreaterThan(0);
  });
});

describe.each(MODEL_FIELDS.map((f) => [f.property, f] as const))("model field %s", (property, field) => {
  it("R-1: not_specified first, values unique, yes/no three-valued", () => {
    expect(field.values[0]).toBe("not_specified");
    expect(new Set(field.values).size).toBe(field.values.length);
    if (field.values.includes("yes") || field.values.includes("no")) expect(field.values).toEqual(["not_specified", "yes", "no"]);
  });

  it("R-6: known element types that declare the property", () => {
    expect(field.elementTypes.length).toBeGreaterThan(0);
    for (const type of field.elementTypes) expect(ELEMENT_TYPES).toContain(type);
    const declarations = FILES.find((f) => f.rel === "features/dfd/models/element-properties.ts")!.text;
    expect(declarations).toMatch(new RegExp(`\\b${property}\\?:`));
  });

  it("R-3 / R-4: every consumer goes through the predicate", () => {
    expect(bypasses(property)).toEqual([]);
  });

  it.each(["en", "de"])("R-7: label, help and value labels in %s", (lang) => {
    const texts = fieldTexts(lang, property) as { label?: string; help?: string; values?: Record<string, string> } | undefined;
    expect(texts?.label).toBeTruthy();
    expect(texts?.help).toBeTruthy();
    for (const value of field.values.slice(1)) expect(texts?.values?.[value], value).toBeTruthy();
  });
});

describe("registry", () => {
  it("one entry per property", () => {
    const properties = MODEL_FIELDS.map((f) => f.property);
    expect(new Set(properties).size).toBe(properties.length);
  });
});
