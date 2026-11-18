// ==================== AUDIT PREV-STATE — TESTS ====================
// If you use Jest with globals, delete the next import line.
import { describe, it, expect, vi } from "vitest";
import {
  repoRelativePath,
  loadPreviousProjectFromGit,
  fileDiffersFromHead,
  type RawGit,
} from "features/audit/services/audit-prev-state";
import { DiffService } from "features/audit/services/diff-service";
import { generateCommitMessage } from "features/audit/models/audit-types";
import { validateAuditMessage } from "features/audit/services/verify/message";

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

// Manual test 2026-11-17: the file can differ from HEAD in derived values the
// diff does not list; the Audit tab asks git and offers one committable change.
describe("fileDiffersFromHead / derived values only", () => {
  const status = (data: string, success = true): RawGit => vi.fn(async () => ({ success, data }));

  it("modified or untracked in the working tree → true; clean, failed or no path → false", async () => {
    expect(await fileDiffersFromHead(status(" M sub/m.tara.json\n"), "/r", "/r/sub/m.tara.json")).toBe(true);
    expect(await fileDiffersFromHead(status("?? m.tara.json\n"), "/r", "/r/m.tara.json")).toBe(true);
    expect(await fileDiffersFromHead(status(""), "/r", "/r/m.tara.json")).toBe(false);
    expect(await fileDiffersFromHead(status("x", false), "/r", "/r/m.tara.json")).toBe(false);
    expect(await fileDiffersFromHead(vi.fn(async () => { throw new Error("git"); }), "/r", "/r/m.tara.json")).toBe(false);
    expect(await fileDiffersFromHead(status(" M x"), "/r", "/r")).toBe(false);
  });

  it("asks for the file's repo-relative path only", async () => {
    const raw = status("");
    await fileDiffersFromHead(raw, "/r", "/r/sub/m.tara.json");
    expect(raw).toHaveBeenCalledWith(["status", "--porcelain", "--", "sub/m.tara.json"]);
  });

  it("the derived-only change gives a commit message the hook accepts", () => {
    const changes = new DiffService().derivedOnlyChanges();
    expect(changes).toHaveLength(1);
    const data = new DiffService().generateCommitMessageData(changes, "Detail Review", "Ann", { projectFile: "m.tara.json" });
    const message = generateCommitMessage({ ...data, date: "2026-11-17T00:00:00.000Z" } as never);
    expect(validateAuditMessage(message)).toEqual([]);
    expect(message).toContain("Derived values");
  });
});
