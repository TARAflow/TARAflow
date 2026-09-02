// src/features/overview/utils/source-binding-utils.test.ts
import { describe, expect, it } from "vitest";
import {
  SOURCE_REF_TYPE_OPTIONS,
  createEmptySourceBinding,
  isSourceBindingComplete,
  looksLikeLocalPath,
} from "features/overview/utils/source-binding-utils";

describe("createEmptySourceBinding", () => {
  it("creates a row with the given id, empty fields, and an empty driftEvents array (never undefined)", () => {
    const binding = createEmptySourceBinding("row-1");

    expect(binding).toEqual({
      id: "row-1",
      repoUrl: "",
      refType: "branch",
      refLabel: "",
      driftEvents: [],
    });
  });

  it("does not set resolvedCommitSha/resolvedAt/currentDriftStatus — Phase 1 has no resolution", () => {
    const binding = createEmptySourceBinding("row-2");

    expect(binding.resolvedCommitSha).toBeUndefined();
    expect(binding.resolvedAt).toBeUndefined();
    expect(binding.currentDriftStatus).toBeUndefined();
  });
});

describe("isSourceBindingComplete", () => {
  it("is false when repoUrl is empty", () => {
    expect(
      isSourceBindingComplete({
        id: "1",
        repoUrl: "",
        refType: "branch",
        refLabel: "main",
        driftEvents: [],
      }),
    ).toBe(false);
  });

  it("is false when refLabel is empty", () => {
    expect(
      isSourceBindingComplete({
        id: "1",
        repoUrl: "https://github.com/org/repo.git",
        refType: "branch",
        refLabel: "",
        driftEvents: [],
      }),
    ).toBe(false);
  });

  it("is false when fields are whitespace-only", () => {
    expect(
      isSourceBindingComplete({
        id: "1",
        repoUrl: "   ",
        refType: "branch",
        refLabel: "  ",
        driftEvents: [],
      }),
    ).toBe(false);
  });

  it("is true once both repoUrl and refLabel are filled in — resolution state is irrelevant", () => {
    expect(
      isSourceBindingComplete({
        id: "1",
        repoUrl: "https://github.com/org/repo.git",
        refType: "tag",
        refLabel: "v2.3.1",
        driftEvents: [],
      }),
    ).toBe(true);
  });
});

describe("looksLikeLocalPath", () => {
  it("does not flag an empty value (nothing entered yet, not a bad entry)", () => {
    expect(looksLikeLocalPath("")).toBe(false);
    expect(looksLikeLocalPath("   ")).toBe(false);
  });

  it.each([
    "https://github.com/org/repo.git",
    "http://gitlab.internal.example.com/org/repo.git",
    "git@github.com:org/repo.git",
    "ssh://git@gitlab.internal.example.com:2222/org/repo.git",
    "git://github.com/org/repo.git",
  ])("does not flag a valid remote URL form: %s", (url) => {
    expect(looksLikeLocalPath(url)).toBe(false);
  });

  it.each([
    "/home/juergen/repos/mdv-backend",
    "C:\\Users\\juergen\\repos\\mdv-backend",
    "./mdv-backend",
    "../repos/mdv-backend",
    "mdv-backend",
  ])("flags a local-looking path: %s", (path) => {
    expect(looksLikeLocalPath(path)).toBe(true);
  });
});

describe("SOURCE_REF_TYPE_OPTIONS", () => {
  it("covers exactly the four SourceRefType values, each with an i18n key", () => {
    const ids = SOURCE_REF_TYPE_OPTIONS.map((o) => o.id).sort();
    expect(ids).toEqual(["branch", "commit", "release_branch", "tag"].sort());
    for (const option of SOURCE_REF_TYPE_OPTIONS) {
      expect(option.nameKey).toMatch(/^sourceBinding\.refType\./);
    }
  });
});
