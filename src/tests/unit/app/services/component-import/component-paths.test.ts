// src/tests/unit/app/services/component-import/component-paths.test.ts
// Multi-project TARA (design §6.1, §8.2): where the component TARA lies —
// from the machine's repository (sameRepo) or the path remembered in
// localStorage at import; never in the project file.
import { beforeEach, describe, expect, it } from "vitest";
import {
  componentSourceLabel,
  rememberComponentPath,
  rememberedComponentPath,
  resolveComponentPath,
} from "app/services/component-import/component-paths";
import type { ComponentGitRunner } from "app/services/component-import/component-source";

const git = (root: string | null): ComponentGitRunner => async () =>
  root ? { stdout: `${root}\n`, stderr: "", code: 0 } : { stdout: "", stderr: "not a repo", code: 128 };

beforeEach(() => localStorage.clear());

describe("component paths", () => {
  it("remembers a path per component (localStorage)", () => {
    rememberComponentPath("cam", "/home/a/camera.tara.json");
    expect(rememberedComponentPath("cam")).toBe("/home/a/camera.tara.json");
    expect(rememberedComponentPath("other")).toBeUndefined();
  });

  it("same repository: repository root + path in the repository", async () => {
    const p = await resolveComponentPath("cam", { schemaVersion: 14, sameRepo: true, path: "components/camera.tara.json", commitSha: "a" }, "/repos/line/machine/panel.tara.json", git("/repos/line"));
    expect(p).toBe("/repos/line/components/camera.tara.json");
  });

  it("another repository: the remembered path", async () => {
    rememberComponentPath("cam", "/home/a/camera.tara.json");
    const p = await resolveComponentPath("cam", { schemaVersion: 14, path: "camera.tara.json", commitSha: "a" }, "/repos/line/panel.tara.json", git("/repos/line"));
    expect(p).toBe("/home/a/camera.tara.json");
  });

  it("same repository but the machine file is not in it any more: the remembered path", async () => {
    rememberComponentPath("cam", "/elsewhere/camera.tara.json");
    const p = await resolveComponentPath("cam", { schemaVersion: 14, sameRepo: true, path: "c.tara.json", commitSha: "a" }, "/tmp/panel.tara.json", git(null));
    expect(p).toBe("/elsewhere/camera.tara.json");
  });

  it("unknown: undefined", async () => {
    expect(await resolveComponentPath("cam", { schemaVersion: 14, commitSha: "a" }, undefined, git(null))).toBeUndefined();
  });

  it("source label", () => {
    expect(componentSourceLabel({ schemaVersion: 14, tag: "cam/v2", commitSha: "0123456789" })).toBe("tag cam/v2 · commit 01234567");
    expect(componentSourceLabel({ schemaVersion: 14, unpinned: "dirty" })).toBe("unpinned (dirty)");
  });
});
