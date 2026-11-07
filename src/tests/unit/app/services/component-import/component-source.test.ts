// src/tests/unit/app/services/component-import/component-source.test.ts
//
// Multi-project TARA, phase 1 (design §4.1, §17 I1): reading a component
// TARA for the import — JSON, git (tracked, clean, source record), schema
// too new, migration determinism — and the cycle check.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import {
  componentIdsOf,
  isComponentCycle,
  readComponentSource,
  type ComponentGitRunner,
} from "app/services/component-import/component-source";
import { buildComponentSnapshot } from "app/services/component-import/snapshot-builder";

const PATH = "/repos/camera/camera.tara.json";

/** A current-schema component file: the Headlamp fixture, migrated and written back. */
const currentFile = () => JSON.stringify(parseAndRepair(loadProjectFixture("headlamp-iso21434.tara.json")));
/** An old file (schema 2) whose migration assigns fresh ids. */
const oldFile = () => JSON.stringify(loadProjectFixture("cnc-ref.tara.json"));

type Reply = { stdout?: string; stderr?: string; code?: number };
function fakeGit(overrides: Record<string, Reply> = {}): ComponentGitRunner & { calls: string[][] } {
  const defaults: Record<string, Reply> = {
    "rev-parse --show-toplevel": { stdout: "/repos/camera\n" },
    "ls-files --error-unmatch -- camera.tara.json": { stdout: "camera.tara.json\n" },
    "status --porcelain -- camera.tara.json": { stdout: "" },
    "rev-parse HEAD": { stdout: "0123456789abcdef0123456789abcdef01234567\n" },
    "rev-parse --abbrev-ref HEAD": { stdout: "main\n" },
    "remote get-url origin": { stdout: "https://git.example.com/camera.git\n" },
    "tag --points-at HEAD": { stdout: "camera-tara/v2\ncamera-tara/v1\n" },
  };
  const calls: string[][] = [];
  const run = (async (args: string[], cwd: string) => {
    calls.push([cwd, ...args]);
    const r = overrides[args.join(" ")] ?? defaults[args.join(" ")] ?? { code: 1, stderr: "unknown" };
    return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.code ?? 0 };
  }) as ComponentGitRunner & { calls: string[][] };
  run.calls = calls;
  return run;
}
const reader = (text: string | null) => async () => text;

describe("readComponentSource — accepted", () => {
  it("a committed current-schema file: snapshot, hash, fingerprint, source record without the local path", async () => {
    const git = fakeGit();
    const r = await readComponentSource(PATH, reader(currentFile()), git);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contentHash).toMatch(/^[0-9a-f]{12}$/);
    expect(r.snapshot.component.name).toBe(r.project.info.name);
    expect(r.methodology?.likelihoodMethod).toBe("iso-21434");
    expect(r.source).toEqual({
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      schemaVersion: 14,
      repoUrl: "https://git.example.com/camera.git",
      branch: "main",
      tag: "camera-tara/v1",
    });
    expect(JSON.stringify(r.source)).not.toContain("/repos/camera");
    expect(git.calls.every((c) => c[0] === "/repos/camera")).toBe(true);
  });

  it("detached HEAD, no remote, no tag: only the commit is recorded", async () => {
    const git = fakeGit({
      "rev-parse --abbrev-ref HEAD": { stdout: "HEAD\n" },
      "remote get-url origin": { code: 2, stderr: "No such remote" },
      "tag --points-at HEAD": { stdout: "" },
    });
    const r = await readComponentSource(PATH, reader(currentFile()), git);
    expect(r.ok && r.source).toEqual({ commitSha: "0123456789abcdef0123456789abcdef01234567", schemaVersion: 14 });
  });

  it("the same file read twice gives the same hash", async () => {
    const a = await readComponentSource(PATH, reader(currentFile()), fakeGit());
    const b = await readComponentSource(PATH, reader(currentFile()), fakeGit());
    expect(a.ok && b.ok && a.contentHash === b.contentHash).toBe(true);
  });
});

describe("readComponentSource — refused", () => {
  const refused = async (text: string | null, git = fakeGit()) => {
    const r = await readComponentSource(PATH, reader(text), git);
    return r.ok ? "ok" : r.error;
  };

  it("missing file, invalid JSON, not a TARAflow project", async () => {
    expect(await refused(null)).toBe("not_found");
    expect(await refused("{ nope")).toBe("invalid");
    expect(await refused(JSON.stringify({ hello: "world" }))).toBe("invalid");
  });

  it("not in a git working copy", async () => {
    expect(await refused(currentFile(), fakeGit({ "rev-parse --show-toplevel": { code: 128, stderr: "not a git repository" } }))).toBe("not_in_repo");
  });

  it("not tracked", async () => {
    expect(await refused(currentFile(), fakeGit({ "ls-files --error-unmatch -- camera.tara.json": { code: 1 } }))).toBe("untracked");
  });

  it("uncommitted changes (D6: no draft imports)", async () => {
    expect(await refused(currentFile(), fakeGit({ "status --porcelain -- camera.tara.json": { stdout: " M camera.tara.json\n" } }))).toBe("dirty");
  });

  it("written by a newer TARAflow", async () => {
    const newer = JSON.stringify({ ...JSON.parse(currentFile()), schemaVersion: 99 });
    expect(await refused(newer)).toBe("schema_too_new");
  });

  it("I1: an old file whose migration is not deterministic", async () => {
    expect(await refused(oldFile())).toBe("not_deterministic");
  });
});

describe("cycle check (design §4.1, §6.5)", () => {
  const snap = (id: string, nested: { componentId: string; snapshot: unknown }[] = []) => {
    const p = parseAndRepair(loadProjectFixture("headlamp-iso21434.tara.json")) as Project;
    const s = buildComponentSnapshot({ ...p, id });
    return { ...s, ...(nested.length ? { components: { imports: nested as never, instances: [] } } : {}) };
  };

  it("collects the component and its nested components", () => {
    const sensor = snap("sensor");
    const camera = snap("camera", [{ componentId: "sensor", snapshot: sensor }]);
    expect([...componentIdsOf(camera)].sort()).toEqual(["camera", "sensor"]);
  });

  it("the machine itself, or a component that contains it, is a cycle", () => {
    const machineInside = snap("camera", [{ componentId: "machine", snapshot: snap("machine") }]);
    expect(isComponentCycle("machine", snap("machine"))).toBe(true);
    expect(isComponentCycle("machine", machineInside)).toBe(true);
    expect(isComponentCycle("machine", snap("camera"))).toBe(false);
  });
});
