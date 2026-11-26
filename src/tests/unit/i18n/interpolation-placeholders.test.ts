// src/tests/unit/i18n/interpolation-placeholders.test.ts
//
// 0.20 manual test (2026-11-27, user): the hazard item dialog showed
// "{{reviewed}}/1 geprüft" — the code passed the count as `done`, the
// translations ask for `reviewed`. For every t("key", { … }) call with a
// literal key and plain options (no spread), each {{placeholder}} of the
// English and German text has to be among the options. Top-level namespace
// files only; a call with a spread is skipped (its options are not known).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");

function flatten(o: unknown, prefix: string[], out: Map<string, string>) {
  if (typeof o === "string") out.set(prefix.join("."), o);
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) flatten(v, [...prefix, k], out);
}

function texts(lang: string): Map<string, string> {
  const dir = path.join(ROOT, "i18n/locales", lang);
  const out = new Map<string, string>();
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json")))
    flatten(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), [], out);
  return out;
}

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "tests" ? [] : sources(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** The top-level option names of t("key", { … }) calls, undefined with a spread. */
function callsIn(source: string): { key: string; line: number; options: Set<string> | undefined }[] {
  const out: { key: string; line: number; options: Set<string> | undefined }[] = [];
  for (const m of source.matchAll(/\bt\(\s*"([\w.-]+)"\s*,\s*\{/g)) {
    let depth = 1;
    let j = m.index! + m[0].length;
    let flat = "";
    let quote: string | null = null;
    for (; j < source.length && depth > 0; j++) {
      const c = source[j];
      if (quote) {
        if (c === "\\") j++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        quote = c;
        if (depth === 1) flat += '""';
      } else if ("{([".includes(c)) depth++;
      else if ("})]".includes(c)) depth--;
      else if (depth === 1) flat += c;
    }
    const line = source.slice(0, m.index).split("\n").length;
    const options = flat.includes("...")
      ? undefined
      : new Set([...flat.matchAll(/(?:^|,)\s*([A-Za-z_]\w*)\s*(?=:|,|$)/g)].map((x) => x[1]));
    out.push({ key: m[1], line, options });
  }
  return out;
}

describe("interpolation placeholders", () => {
  it("the parser: top-level options, shorthand, a spread is unknown", () => {
    expect([...callsIn('t("a.b", { defaultValue: "{{x}}", x: f({ y: 1 }), z })')[0].options!]).toEqual(["defaultValue", "x", "z"]);
    expect(callsIn('t("a.b", { ...o, defaultValue: "x" })')[0].options).toBeUndefined();
  });

  it("every placeholder of the en and de text is passed by the code", () => {
    const langs = { en: texts("en"), de: texts("de") };
    const problems: string[] = [];
    for (const file of sources(ROOT)) {
      for (const call of callsIn(fs.readFileSync(file, "utf8"))) {
        if (!call.options) continue;
        for (const [lang, map] of Object.entries(langs))
          for (const suffix of ["", "_one", "_other"]) {
            const text = map.get(call.key + suffix);
            if (text === undefined) continue;
            const missing = [...text.matchAll(/\{\{\s*(\w+)/g)].map((x) => x[1]).filter((p) => !call.options!.has(p));
            if (missing.length) problems.push(`${path.relative(ROOT, file)}:${call.line} ${call.key} (${lang}): ${missing.join(", ")}`);
          }
      }
    }
    expect(problems).toEqual([]);
  });
});
