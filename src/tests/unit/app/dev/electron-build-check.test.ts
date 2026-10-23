// Dev check: the running Electron part (main, preload, draw.io scripts) is
// rebuilt only by `npm run dev:electron`; when its sources changed since,
// the app says so (hash of the build vs. hash of the sources now).
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isElectronBuildOutdated } from "app/dev/electron-build-check";
import { hashInputs, inputsOfMetafile, readBuildInfo } from "../../../../../scripts/electron-build-hash.mjs";

describe("isElectronBuildOutdated", () => {
  it("outdated when the hashes differ, or the running part predates the check", () => {
    expect(isElectronBuildOutdated("aaa", "bbb")).toBe(true);
    expect(isElectronBuildOutdated(null, "bbb")).toBe(true);
  });

  it("not outdated when equal, not asked yet, or without a source hash (production)", () => {
    expect(isElectronBuildOutdated("aaa", "aaa")).toBe(false);
    expect(isElectronBuildOutdated(undefined, "aaa")).toBe(false);
    expect(isElectronBuildOutdated("aaa", null)).toBe(false);
  });
});

describe("electron-build-hash", () => {
  const root = mkdtempSync(join(tmpdir(), "ebh-"));
  mkdirSync(join(root, "electron"));
  writeFileSync(join(root, "electron/a.ts"), "a");
  writeFileSync(join(root, "electron/b.js"), "b");

  it("inputs: project-relative, plugin namespace stripped, no node_modules", () => {
    const metafile = {
      inputs: {
        "electron/a.ts": {},
        [`raw-text:${join(root, "electron/b.js")}`]: {},
        "node_modules/x/index.js": {},
      },
    };
    expect(inputsOfMetafile(metafile, root)).toEqual(["electron/a.ts", "electron/b.js"]);
  });

  it("the hash follows the content, not the order", () => {
    const before = hashInputs(["electron/b.js", "electron/a.ts"], root);
    expect(hashInputs(["electron/a.ts", "electron/b.js"], root)).toBe(before);
    writeFileSync(join(root, "electron/b.js"), "b2");
    expect(hashInputs(["electron/a.ts", "electron/b.js"], root)).not.toBe(before);
  });

  it("no build info without an Electron build", () => {
    expect(readBuildInfo(root)).toBeNull();
  });
});
