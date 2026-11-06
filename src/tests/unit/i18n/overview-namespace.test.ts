// src/tests/unit/i18n/overview-namespace.test.ts
//
// I18N-1: the Overview blocks (itemDefinition, sourceBinding, overviewViews,
// verificationStatus) moved from common.json into overview.json. Every key
// lives in exactly one of the two files, EN and DE keep the same keys, and
// both i18n setups — the app and the CLI reporter — still resolve the keys
// without a namespace prefix (fallbackNS), so no t() call had to change.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import appI18n from "i18n/services/i18n";
import { initI18nNode } from "../../../../taraflow-reporter/cli/i18n-node";

type Tree = Record<string, unknown>;
const read = (lang: string, ns: string): Tree =>
  JSON.parse(readFileSync(join(process.cwd(), "src/i18n/locales", lang, `${ns}.json`), "utf8"));

/** All leaf key paths of a tree. */
const leaves = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([k, v]) =>
    v && typeof v === "object" ? leaves(v as Tree, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const MOVED = ["verificationStatus", "overviewViews", "itemDefinition", "sourceBinding"];

describe("overview namespace (I18N-1)", () => {
  it.each(["en", "de"])("%s: the moved blocks are in overview.json only", (lang) => {
    const common = read(lang, "common");
    const overview = read(lang, "overview");
    expect(Object.keys(overview)).toEqual(MOVED);
    for (const block of MOVED) expect(common[block]).toBeUndefined();
    const shared = Object.keys(overview).filter((k) => k in common);
    expect(shared).toEqual([]);
  });

  it("English and German overview.json have the same keys", () => {
    expect(leaves(read("de", "overview")).sort()).toEqual(leaves(read("en", "overview")).sort());
  });

  it("the app resolves the moved keys without a namespace prefix", async () => {
    await appI18n.changeLanguage("de");
    const de = read("de", "overview") as { verificationStatus: Record<string, string> };
    expect(appI18n.t("verificationStatus.label")).toBe(de.verificationStatus.label);
    expect(appI18n.exists("itemDefinition.intro")).toBe(true);
    expect(appI18n.exists("sourceBinding.empty")).toBe(true);
    await appI18n.changeLanguage("en");
  });

  it("the CLI reporter resolves them too (report: verification status line)", async () => {
    const i18n = await initI18nNode("en");
    const en = read("en", "overview") as { verificationStatus: Record<string, string> };
    expect(i18n.t("verificationStatus.label")).toBe(en.verificationStatus.label);
  });
});
