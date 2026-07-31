// ==================== AUDIT PREV-STATE — TESTS ====================
// If you use Jest with globals, delete the next import line.
import { describe, it, expect, vi } from "vitest";
import {
  repoRelativePath,
  loadPreviousProjectFromGit,
  type RawGit,
} from "features/audit/services/audit-prev-state";

describe("repoRelativePath", () => {
  it("resolves a file in a subfolder (posix)", () => {
    expect(repoRelativePath("/r", "/r/tara/foo.tara.json")).toBe(
      "tara/foo.tara.json",
    );
  });
  it("resolves a file at the repo root", () => {
    expect(repoRelativePath("/r", "/r/foo.tara.json")).toBe("foo.tara.json");
  });
  it("normalizes windows separators to posix", () => {
    expect(repoRelativePath("C:\\r", "C:\\r\\sub\\foo.tara.json")).toBe(
      "sub/foo.tara.json",
    );
  });
  it("tolerates a trailing separator on the root", () => {
    expect(repoRelativePath("/r/", "/r/foo.tara.json")).toBe("foo.tara.json");
  });
  it("falls back to the basename when the file isn't under the root", () => {
    expect(repoRelativePath("/other", "/r/foo.tara.json")).toBe(
      "foo.tara.json",
    );
  });
});

describe("loadPreviousProjectFromGit", () => {
  const okRaw = (data: string): RawGit => async () => ({ success: true, data });

  it("parses the committed project at HEAD", async () => {
    const raw = okRaw(JSON.stringify({ id: "p", assets: [{ id: "A1" }] }));
    const prev = await loadPreviousProjectFromGit(raw, "/r", "/r/foo.tara.json");
    expect(prev?.id).toBe("p");
  });

  it("asks git for HEAD:<relpath>", async () => {
    const raw = vi.fn(async () => ({ success: true, data: "{}" }));
    await loadPreviousProjectFromGit(raw, "/r", "/r/sub/foo.tara.json");
    expect(raw).toHaveBeenCalledWith(["show", "HEAD:sub/foo.tara.json"]);
  });

  it("returns null on an unborn HEAD / file not in HEAD (first commit)", async () => {
    const fail: RawGit = async () => ({ success: false, error: "not in HEAD" });
    expect(
      await loadPreviousProjectFromGit(fail, "/r", "/r/foo.tara.json"),
    ).toBeNull();
  });

  it("returns null when git throws (does not crash the diff)", async () => {
    const throws: RawGit = async () => {
      throw new Error("unborn");
    };
    expect(
      await loadPreviousProjectFromGit(throws, "/r", "/r/foo.tara.json"),
    ).toBeNull();
  });

  it("returns null on unparseable content", async () => {
    expect(
      await loadPreviousProjectFromGit(okRaw("{not json"), "/r", "/r/foo.tara.json"),
    ).toBeNull();
  });

  it("returns null on empty output", async () => {
    expect(
      await loadPreviousProjectFromGit(okRaw(""), "/r", "/r/foo.tara.json"),
    ).toBeNull();
  });
});
