// src/tests/regression/no-raw-project-serialisation.test.ts
//
// Every path that writes or exports a Project must go through
// serialiseProject / prepareForDisk. This is a source-level guard because the
// bug it prevents is one of omission: nothing fails, no test goes red, the file
// is simply written with `filePath` — the author's absolute path — inside it.
//
// That is exactly what happened. The stripping lived privately in
// project-repository.ts, so its two write paths were clean while five others
// (useProjectPersistence in all three modes, useProjectFileDownload,
// projectService.exportProject, storageService.exportProjectAsJSON) called
// JSON.stringify(project) directly. It surfaced only when a committed fixture
// tripped the pre-commit secret scan.
//
// A unit test cannot catch this: the next writer someone adds simply won't be
// covered by one. So we check the source instead.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "../../");

/** The one module allowed to serialise a Project. */
const ALLOWED = ["app/services/prepare-for-disk.ts"];

/**
 * Serialising a variable named `project`/`projectToWrite`/etc. — the shape the
 * bug took at every one of the six sites. Deliberately narrow: it targets the
 * Project object specifically, not JSON.stringify in general.
 */
const RAW_SERIALISATION = /JSON\.stringify\(\s*project[A-Za-z]*\s*[,)]/;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "tests") continue;
      collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("no raw Project serialisation outside prepare-for-disk", () => {
  const files = collectSourceFiles(SRC_ROOT);

  it("finds source files to scan (guard against a broken glob)", () => {
    // Without this, a wrong SRC_ROOT would make the suite below vacuously pass.
    expect(files.length).toBeGreaterThan(50);
  });

  it("no source file stringifies a Project directly", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = path.relative(SRC_ROOT, file).replace(/\\/g, "/");
      if (ALLOWED.includes(rel)) continue;

      const content = fs.readFileSync(file, "utf8");
      content.split("\n").forEach((line, i) => {
        if (RAW_SERIALISATION.test(line)) {
          offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }

    expect(
      offenders,
      "Use serialiseProject(project) from app/services/prepare-for-disk " +
        "instead — a raw stringify writes filePath and hasUnsavedChanges to disk:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
