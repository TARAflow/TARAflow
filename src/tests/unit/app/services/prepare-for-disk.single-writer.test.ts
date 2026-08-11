// ==================== SINGLE-WRITER GUARD ====================
// Enforces the invariant from taraflow's architecture decisions:
//   "Only ONE serialisation path for project files: prepare-for-disk.ts."
//
// The historical leak was every writer calling JSON.stringify(project) — or
// JSON.stringify(prepareForDisk(project), null, 2) — directly, shipping
// runtime-only fields and non-canonical bytes to disk. This test walks the
// source tree and fails if a second writer is reintroduced.
//
// NOTE (2026-08-11): the canonical TCS serializer was extracted into its own
// project-types-free module (tcs-serialize.ts) so the Electron main process and
// the CLI can import it without dragging the Project type graph. prepare-for-disk
// re-exports it, so every existing caller is unchanged. The guard therefore maps
// each writer symbol to its OWNING module: still exactly one declaration each,
// just canonicalStringify now lives in tcs-serialize.ts.
//
// If you use Jest with globals, delete the next import line.
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Locate the src/ root (portable across vitest ESM / jest CJS) ─────────────
function findSrcRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "src");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate src/ from " + process.cwd());
}

const SRC = findSrcRoot();

// The module that documents the old leak pattern in a comment and owns the
// project reduction — skipped by the bypass scans below.
const WRITER_FILE = "prepare-for-disk.ts";

// Canonical writer symbols → the module each must be declared in, exactly once.
// prepareForDisk / serialiseProject / serializeTCS own the project reduction;
// canonicalStringify is the pure serializer, extracted to tcs-serialize.ts.
const WRITER_DECLS: Record<string, string> = {
  prepareForDisk: "prepare-for-disk.ts",
  serialiseProject: "prepare-for-disk.ts",
  serializeTCS: "prepare-for-disk.ts",
  canonicalStringify: "tcs-serialize.ts",
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === "build" ||
      entry.name.startsWith(".")
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const ALL_TS = walk(SRC);
const isTest = (f: string) => /\.(test|spec)\.tsx?$/.test(f);
const isWriter = (f: string) => path.basename(f) === WRITER_FILE;

describe("single project-to-disk writer", () => {
  it("declares each canonical writer symbol exactly once, in its owning module", () => {
    for (const [sym, ownerFile] of Object.entries(WRITER_DECLS)) {
      const decl = new RegExp(`\\bfunction\\s+${sym}\\b`);
      const declaringFiles = ALL_TS.filter((f) =>
        decl.test(fs.readFileSync(f, "utf8")),
      );
      expect(
        declaringFiles.map((f) => path.relative(SRC, f)),
        `${sym} must be declared exactly once`,
      ).toHaveLength(1);
      expect(
        path.basename(declaringFiles[0]),
        `${sym} must be declared in ${ownerFile}`,
      ).toBe(ownerFile);
    }
  });

  it("has no file bypassing the writer via JSON.stringify(prepareForDisk(...))", () => {
    const offenders: string[] = [];
    for (const f of ALL_TS) {
      if (isWriter(f) || isTest(f)) continue;
      const src = fs.readFileSync(f, "utf8");
      if (/JSON\.stringify\s*\(\s*prepareForDisk/.test(src)) {
        offenders.push(path.relative(SRC, f));
      }
    }
    expect(offenders, "these files re-serialize a project directly").toEqual(
      [],
    );
  });

  it("keeps the raw legacy pattern out of the tree entirely", () => {
    const offenders: string[] = [];
    for (const f of ALL_TS) {
      // The writer file documents the old pattern in a comment; tests may too.
      if (isWriter(f) || isTest(f)) continue;
      const src = fs.readFileSync(f, "utf8");
      // The exact shape of the old leak: prepareForDisk(...) piped to a 2-space stringify.
      if (/prepareForDisk\([^)]*\)\s*,\s*null\s*,\s*2/.test(src)) {
        offenders.push(path.relative(SRC, f));
      }
    }
    expect(offenders).toEqual([]);
  });
});