// src/tests/unit/app/services/component-import/component-source-electron.pick.test.ts
//
// Manual test 2026-11-19 (TEST-Komponentenimport 16.8): "Import component
// TARA…" opened the file dialog in Downloads. It starts in the machine's
// folder — components mostly lie next to it, in its repository.

import { afterEach, describe, expect, it, vi } from "vitest";
import { folderOf, pickComponentFile } from "app/services/component-import/component-source-electron";

afterEach(() => {
  delete (window as { electron?: unknown }).electron;
});

describe("pickComponentFile", () => {
  it("starts in the machine's folder", async () => {
    const pickFile = vi.fn(async () => ({ success: true, data: "/repo/import-example/case.tara.json" }));
    (window as { electron?: unknown }).electron = { file: { pickFile } };
    expect(await pickComponentFile("Choose", "/repo/import-example/machine.tara.json")).toBe("/repo/import-example/case.tara.json");
    expect(pickFile).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: "/repo/import-example" }));
  });

  it("a machine not saved yet: the dialog's own start", async () => {
    const pickFile = vi.fn(async () => ({ success: false }));
    (window as { electron?: unknown }).electron = { file: { pickFile } };
    expect(await pickComponentFile("Choose")).toBeUndefined();
    expect(pickFile.mock.calls[0]).toEqual([expect.not.objectContaining({ defaultPath: expect.anything() })]);
  });

  it("folderOf: either separator", () => {
    expect(folderOf("C:\\Projects\\m.tara.json")).toBe("C:\\Projects");
    expect(folderOf("/a/b.tara.json")).toBe("/a");
    expect(folderOf("b.tara.json")).toBeUndefined();
    expect(folderOf(undefined)).toBeUndefined();
  });
});
