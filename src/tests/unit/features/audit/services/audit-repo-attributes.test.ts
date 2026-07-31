// ==================== AUDIT REPO ATTRIBUTES — TESTS ====================
// If you use Jest with globals, delete the next import line.
import { describe, it, expect } from "vitest";
import {
  parseCheckAttr,
  evaluateAttrs,
  taraAttributesBlock,
  hasManagedBlock,
  withTaraAttributesAppended,
  isGitRepo,
  inspectAuditRepoAttributes,
  applyTaraAttributes,
  MANAGED_BLOCK_MARKER,
  type GitRunner,
  type FileIO,
} from "features/audit/services/audit-repo-attributes";

// ── Test doubles ─────────────────────────────────────────────────────────────

/** A fake git that answers check-attr from a supplied resolved-attrs map. */
function fakeGit(resolved: Record<string, string>): GitRunner {
  return async (args) => {
    if (args[0] === "rev-parse") {
      return { stdout: "true\n", stderr: "", code: 0 };
    }
    if (args[0] === "check-attr") {
      const attrs = args.slice(1, args.indexOf("--"));
      const path = args[args.length - 1];
      const stdout =
        attrs
          .map((a) => `${path}: ${a}: ${resolved[a] ?? "unspecified"}`)
          .join("\n") + "\n";
      return { stdout, stderr: "", code: 0 };
    }
    return { stdout: "", stderr: "", code: 0 };
  };
}

/** In-memory .gitattributes. */
function memIO(initial: string | null): FileIO & { current(): string | null } {
  let content = initial;
  return {
    async read() {
      return content;
    },
    async write(_path, c) {
      content = c;
    },
    current() {
      return content;
    },
  };
}

const REPO = "/repo";
const GA = "/repo/.gitattributes";

// ── parseCheckAttr ───────────────────────────────────────────────────────────

describe("parseCheckAttr", () => {
  it("parses unspecified", () => {
    const out = parseCheckAttr(
      "x.tara.json: text: unspecified\nx.tara.json: eol: unspecified",
      ["text", "eol"],
    );
    expect(out).toEqual({ text: "unspecified", eol: "unspecified" });
  });

  it("parses set/lf", () => {
    const out = parseCheckAttr(
      "x.tara.json: text: set\nx.tara.json: eol: lf",
      ["text", "eol"],
    );
    expect(out).toEqual({ text: "set", eol: "lf" });
  });
});

// ── evaluateAttrs ────────────────────────────────────────────────────────────

describe("evaluateAttrs", () => {
  it("ok when text=set and eol=lf", () => {
    expect(evaluateAttrs({ text: "set", eol: "lf" }).ok).toBe(true);
  });

  it("flags both when unspecified", () => {
    const r = evaluateAttrs({});
    expect(r.ok).toBe(false);
    expect(r.missing.map((m) => m.attr).sort()).toEqual(["eol", "text"]);
  });

  it("flags eol when crlf, reporting the actual value", () => {
    const r = evaluateAttrs({ text: "set", eol: "crlf" });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([
      { attr: "eol", expected: "lf", actual: "crlf" },
    ]);
  });
});

// ── block append helpers ─────────────────────────────────────────────────────

describe("withTaraAttributesAppended", () => {
  it("creates content from nothing", () => {
    const out = withTaraAttributesAppended(null);
    expect(out).toContain(MANAGED_BLOCK_MARKER);
    expect(out).toContain("*.tara.json text eol=lf");
  });

  it("preserves existing content and separates cleanly", () => {
    const out = withTaraAttributesAppended("*.png binary");
    expect(out.startsWith("*.png binary\n")).toBe(true);
    expect(out).toContain(MANAGED_BLOCK_MARKER);
    expect(out).not.toContain("*.png binary\n\n\n");
  });

  it("is idempotent", () => {
    const once = withTaraAttributesAppended("*.png binary");
    expect(withTaraAttributesAppended(once)).toBe(once);
  });

  it("taraAttributesBlock carries the managed marker", () => {
    expect(hasManagedBlock(taraAttributesBlock())).toBe(true);
  });
});

// ── orchestration ────────────────────────────────────────────────────────────

describe("inspect + apply", () => {
  it("isGitRepo true when inside work tree", async () => {
    expect(await isGitRepo(fakeGit({}), REPO)).toBe(true);
  });

  it("reports not-ok for a repo without the rule", async () => {
    const status = await inspectAuditRepoAttributes(
      fakeGit({}),
      memIO(null),
      REPO,
      GA,
    );
    expect(status.ok).toBe(false);
    expect(status.managedBlockPresent).toBe(false);
    expect(status.missing).toHaveLength(2);
  });

  it("applying the block makes a fresh repo satisfied", async () => {
    // git resolves to set/lf ONLY after the block is written — model that by
    // switching the runner once the file contains the marker.
    const io = memIO(null);
    const dynamicGit: GitRunner = async (args, cwd) => {
      const resolved: Record<string, string> = hasManagedBlock(io.current())
        ? { text: "set", eol: "lf" }
        : {};
      return fakeGit(resolved)(args, cwd);
    };

    const before = await inspectAuditRepoAttributes(dynamicGit, io, REPO, GA);
    expect(before.ok).toBe(false);

    const after = await applyTaraAttributes(dynamicGit, io, REPO, GA);
    expect(after.ok).toBe(true);
    expect(after.managedBlockPresent).toBe(true);
    expect(io.current()).toContain("*.tara.json text eol=lf");
  });

  it("apply is a no-op write when the managed block is already present", async () => {
    const io = memIO(taraAttributesBlock());
    let writes = 0;
    const countingIO: FileIO = {
      read: io.read,
      write: async (p, c) => {
        writes++;
        await io.write(p, c);
      },
    };
    await applyTaraAttributes(
      fakeGit({ text: "set", eol: "lf" }),
      countingIO,
      REPO,
      GA,
    );
    expect(writes).toBe(0);
  });
});