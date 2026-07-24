// @vitest-environment node
//
// taraflow-reporter/tests/unit/load-project.test.ts
//
// Unit tests for loadProject(). Covers the success path (no migration
// needed) and the three distinct failure modes it can throw for
// (unreadable file, invalid JSON, unrecoverable project — see the
// corresponding try/catch blocks and repairProject() check in
// load-project.ts / migration-service.ts).

import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { loadProject } from "../../cli/load-project";

const tempDirs: string[] = [];

async function makeTempFile(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "taraflow-test-"));
  tempDirs.push(dir);
  const file = path.join(dir, name);
  await writeFile(file, content, "utf-8");
  return file;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("loadProject", () => {
  it("loads a valid, already-current-schema project without migrating", async () => {
    const minimalProject = {
      schemaVersion: 4,
      id: "test-id",
      info: {
        name: "Test Project",
        lastModified: new Date().toISOString(),
        tags: { domain: [], platform: [], regulation: [], custom: [] },
        team: [],
      },
      phaseStatus: { 0: "not-started" },
    };
    const file = await makeTempFile(
      "test.tara.json",
      JSON.stringify(minimalProject),
    );

    const result = await loadProject(file);

    expect(result.project.id).toBe("test-id");
    expect(result.migrated).toBe(false);
    expect(result.fromVersion).toBe(4);
  });

  it("throws a clear error when the file cannot be read", async () => {
    await expect(
      loadProject("/nonexistent/path/does-not-exist.tara.json"),
    ).rejects.toThrow(/Could not read project file/);
  });

  it("throws a clear error for invalid JSON", async () => {
    const file = await makeTempFile("broken.tara.json", "{ not valid json");

    await expect(loadProject(file)).rejects.toThrow(/Could not parse/);
  });

  it("throws a clear error for unrecoverable projects (missing id/info.name)", async () => {
    const file = await makeTempFile(
      "garbage.tara.json",
      JSON.stringify({ foo: "bar" }),
    );

    await expect(loadProject(file)).rejects.toThrow(/missing required fields/);
  });
});
