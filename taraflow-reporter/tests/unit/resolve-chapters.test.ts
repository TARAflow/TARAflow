// taraflow-reporter/tests/unit/resolve-chapters.test.ts
//
// ISO/SAE 21434 conformance plan F3: the CLI completes a stored chapter list
// with the default chapters, like the app's Documentation tab.

import { describe, expect, it } from "vitest";
import { resolveCliChapters } from "../../cli/resolve-chapters";
import {
  DEFAULT_CHAPTER_CONFIG,
  withDefaultChapters,
  type DocChapterConfig,
} from "../../../src/features/documentation/models/doc-types";

/** A list saved before methodology / attack-path / traceability existed. */
const OLD: DocChapterConfig[] = DEFAULT_CHAPTER_CONFIG.filter(
  (c) =>
    !["methodology", "threats-attack-path", "traceability-matrix"].includes(c.id),
).map((c) => (c.id === "assets" ? { ...c, enabled: false } : c));

describe("resolveCliChapters", () => {
  it("adds the missing default chapters, same as the app", () => {
    const out = resolveCliChapters(OLD);
    expect(out).toEqual(withDefaultChapters(OLD));
    expect(out.map((c) => c.id)).toEqual(DEFAULT_CHAPTER_CONFIG.map((c) => c.id));
  });

  it("keeps the stored settings of existing chapters", () => {
    expect(resolveCliChapters(OLD).find((c) => c.id === "assets")!.enabled).toBe(false);
  });

  it("--chapters can select a chapter missing from the stored list", () => {
    const out = resolveCliChapters(OLD, ["methodology", "assets"]);
    expect(out.filter((c) => c.enabled).map((c) => c.id)).toEqual([
      "methodology",
      "assets",
    ]);
  });

  it("no stored list: the defaults", () => {
    expect(resolveCliChapters(undefined)).toEqual(DEFAULT_CHAPTER_CONFIG);
  });
});
