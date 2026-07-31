// ==================== AUDIT GIT ADAPTERS — TESTS ====================
// If you use Jest with globals, delete the next import line.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIpcGitRunner } from "features/audit/services/audit-git-adapters";
import { createIpcFileIO } from "features/audit/services/audit-git-adapters";
import { locateAuditRepo } from "features/audit/services/audit-repo-locator";

type RawInDir = (
  dir: string,
  args: string[],
) => Promise<{ success: boolean; data?: any; error?: string }>;

function setWindowGit(rawInDir: RawInDir | null) {
  (window as any).git = rawInDir ? { rawInDir } : undefined;
}

// Fake main: repo at /r (and its subtree); everything else is not a repo.
const fakeRawInDir: RawInDir = async (dir, args) => {
  if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
    if (dir === "/r" || dir.startsWith("/r/")) {
      return { success: true, data: { stdout: "/r\n", stderr: "", code: 0 } };
    }
    return {
      success: true,
      data: { stdout: "", stderr: "fatal: not a git repository", code: 128 },
    };
  }
  if (args[0] === "check-attr") {
    const p = args[args.length - 1];
    return {
      success: true,
      data: { stdout: `${p}: text: set\n${p}: eol: lf`, stderr: "", code: 0 },
    };
  }
  return { success: true, data: { stdout: "", stderr: "", code: 0 } };
};

afterEach(() => setWindowGit(null));

describe("createIpcGitRunner", () => {
  it("drives repo discovery through window.git.rawInDir", async () => {
    setWindowGit(fakeRawInDir);
    const run = createIpcGitRunner();
    const loc = await locateAuditRepo(run, "/r/sub/deep");
    expect(loc.isRepo).toBe(true);
    expect(loc.repoRoot).toBe("/r");
    expect(loc.nextAction).toBe("inspect-attributes");
  });

  it("maps a non-repo dir to offer-init", async () => {
    setWindowGit(fakeRawInDir);
    const loc = await locateAuditRepo(createIpcGitRunner(), "/nr/x");
    expect(loc.isRepo).toBe(false);
    expect(loc.nextAction).toBe("offer-init");
  });

  it("serves the .gitattributes check through the SAME adapter", async () => {
    setWindowGit(fakeRawInDir);
    const run = createIpcGitRunner();
    const res = await run(
      ["check-attr", "text", "eol", "--", "__probe__.tara.json"],
      "/r",
    );
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("text: set");
    expect(res.stdout).toContain("eol: lf");
  });

  it("returns code 127 (not a throw) when the git API is absent", async () => {
    setWindowGit(null);
    const res = await createIpcGitRunner()(["rev-parse"], "/r");
    expect(res.code).toBe(127);
  });

  it("surfaces an ipc failure envelope as code 1 + error text", async () => {
    setWindowGit(async () => ({ success: false, error: "boom" }));
    const res = await createIpcGitRunner()(["rev-parse"], "/r");
    expect(res.code).toBe(1);
    expect(res.stderr).toBe("boom");
  });
});

// ── createIpcFileIO ──────────────────────────────────────────────────────────

type FileApi = {
  readText: (p: string) => Promise<{ success: boolean; data?: string | null; error?: string }>;
  writeText: (p: string, c: string) => Promise<{ success: boolean; error?: string }>;
};

function setWindowFile(api: FileApi | null) {
  (window as any).electron = api ? { file: api } : undefined;
}

afterEach(() => setWindowFile(null));

describe("createIpcFileIO", () => {
  it("returns null for a missing file (ENOENT → data:null)", async () => {
    setWindowFile({
      readText: async () => ({ success: true, data: null }),
      writeText: async () => ({ success: true }),
    });
    expect(await createIpcFileIO().read("/x/.gitattributes")).toBeNull();
  });

  it("returns the file contents when present", async () => {
    setWindowFile({
      readText: async () => ({ success: true, data: "*.png binary\n" }),
      writeText: async () => ({ success: true }),
    });
    expect(await createIpcFileIO().read("/x/.gitattributes")).toBe(
      "*.png binary\n",
    );
  });

  it("throws on a real read failure (not ENOENT)", async () => {
    setWindowFile({
      readText: async () => ({ success: false, error: "EACCES" }),
      writeText: async () => ({ success: true }),
    });
    await expect(createIpcFileIO().read("/x")).rejects.toThrow(/EACCES/);
  });

  it("throws on a write failure", async () => {
    setWindowFile({
      readText: async () => ({ success: true, data: null }),
      writeText: async () => ({ success: false, error: "EROFS" }),
    });
    await expect(createIpcFileIO().write("/x", "y")).rejects.toThrow(/EROFS/);
  });

  it("throws when the file API is absent", async () => {
    setWindowFile(null);
    await expect(createIpcFileIO().read("/x")).rejects.toThrow(
      /not available/,
    );
  });
});
