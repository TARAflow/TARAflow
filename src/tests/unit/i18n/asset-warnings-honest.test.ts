// Model field purpose design, phase 0 (P4, 0.19): a validator message states
// the real effect of an asset field. The asset warnings claimed effects that
// do not exist ("required for … threat selection"); no calculation reads
// those fields yet. This guard keeps such claims out of the texts.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const messages = (lang: string): Record<string, string> =>
  JSON.parse(readFileSync(`src/i18n/locales/${lang}/dfd.json`, "utf-8")).dfdValidation;

describe("asset field warnings claim no effect that does not exist", () => {
  for (const [lang, claim] of [
    ["en", /required for/i],
    ["de", /erforderlich für/i],
  ] as const) {
    it(lang, () => {
      const assetMissing = Object.entries(messages(lang)).filter(([k]) => k.startsWith("assetMissing"));
      expect(assetMissing.length).toBeGreaterThan(1);
      for (const [key, text] of assetMissing) expect(text, key).not.toMatch(claim);
    });
  }
});
