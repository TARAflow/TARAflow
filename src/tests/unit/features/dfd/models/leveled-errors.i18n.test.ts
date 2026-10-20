// Review finding 2: every error code a leveled action reports to the UI has
// a text in English and German (tabs.dfd.leveledErrors.<CODE>).
import { describe, expect, it } from "vitest";
import { LEVELED_ACTION_ERRORS, leveledErrorKey } from "features/dfd/models/leveled-errors";
import en from "../../../../../i18n/locales/en/dfd.json";
import de from "../../../../../i18n/locales/de/dfd.json";

const lookup = (bundle: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);

describe("leveled action errors", () => {
  it.each([
    ["en", en],
    ["de", de],
  ])("have a text for every code (%s)", (_lang, bundle) => {
    const missing = LEVELED_ACTION_ERRORS.filter((code) => {
      const text = lookup(bundle, leveledErrorKey(code));
      return typeof text !== "string" || text.trim() === "";
    });
    expect(missing).toEqual([]);
  });

  it("has no text without a code", () => {
    const texts = Object.keys((lookup(en, "tabs.dfd.leveledErrors") as object) ?? {});
    expect(texts.sort()).toEqual([...LEVELED_ACTION_ERRORS].sort());
  });
});
