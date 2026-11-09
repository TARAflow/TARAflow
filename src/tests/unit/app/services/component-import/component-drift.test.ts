// Multi-project TARA phase 5a (design §9.1): is a newer state of an imported
// component available? Against REAL git repositories in a temp dir (review
// 2026-11-09: the uncertain part is the I/O — branch tip, tag pattern,
// unreachable source). Content decides, not the commit; the working copy is
// never a newer state; fetch only on request.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ComponentImport } from "shared";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import { readComponentSource, type ComponentGitRunner } from "app/services/component-import/component-source";
import { checkComponentDrift, componentDriftFindings, readNewerComponentState } from "app/services/component-import/component-drift";

const git: ComponentGitRunner = async (args, cwd) => {
  try {
    const stdout = execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { stdout, stderr: "", code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: String(e.stderr ?? ""), code: e.status ?? 1 };
  }
};
const read = async (p: string) => {
  try {
    return readFileSync(p, "utf-8");
  } catch {
    return null;
  }
};
const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });

const base = () => parseAndRepair(loadProjectFixture("headlamp-iso21434.tara.json")) as Project;
let root: string;
let file: string;
let imported: ComponentImport;
const commit = (content: string, message: string) => {
  writeFileSync(file, content);
  sh(root, "add", "-A");
  sh(root, "commit", "-q", "-m", message);
};

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "taraflow-drift-"));
  mkdirSync(join(root, "components"));
  file = join(root, "components", "camera.tara.json");
  sh(root, "init", "-q", "-b", "main");
  sh(root, "config", "user.email", "t@example.com");
  sh(root, "config", "user.name", "Test");
  sh(root, "config", "commit.gpgsign", "false");
  commit(JSON.stringify(base()), "v1");
  sh(root, "tag", "camera-tara/v1");
  const r = await readComponentSource(file, read, git);
  if (!r.ok) throw new Error(r.error);
  imported = { id: "imp", componentId: r.snapshot.component.projectId, name: "Camera", source: r.source, importedAt: "t", contentHash: r.contentHash, snapshot: r.snapshot } as ComponentImport;
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("drift check against a real repository (phase 5a)", () => {
  it("the imported commit → up to date; a layout-only commit too (content decides)", async () => {
    expect(imported.source).toMatchObject({ branch: "main", path: "components/camera.tara.json", tag: "camera-tara/v1" });
    expect(await checkComponentDrift(imported, file, read, git)).toEqual({ kind: "up_to_date" });
    commit(JSON.stringify(JSON.parse(readFileSync(file, "utf-8")), null, 2), "reformat");
    expect(await checkComponentDrift(imported, file, read, git)).toEqual({ kind: "up_to_date" });
  });

  it("an uncommitted edit in the working copy is not a newer state; committed it is", async () => {
    const changed = base();
    changed.info.name = "Camera v2";
    writeFileSync(file, JSON.stringify(changed));
    expect(await checkComponentDrift(imported, file, read, git)).toEqual({ kind: "up_to_date" });
    commit(JSON.stringify(changed), "v2");
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf-8" }).trim();
    expect(await checkComponentDrift(imported, file, read, git)).toMatchObject({ kind: "newer_available", commitSha: head });
  });

  it("tag pattern: only tagged states (releases) count", async () => {
    const tagged = { ...imported, source: { ...imported.source, tagPattern: "camera-tara/v*" } };
    // the newest tag is still v1 = the imported state, although the branch moved on
    expect(await checkComponentDrift(tagged, file, read, git)).toEqual({ kind: "up_to_date" });
    sh(root, "tag", "camera-tara/v2");
    expect(await checkComponentDrift(tagged, file, read, git)).toMatchObject({ kind: "newer_available", tag: "camera-tara/v2" });
  });

  it("unreachable with its reason: path unknown, no repository, branch missing, file not in that state", async () => {
    expect(await checkComponentDrift(imported, undefined, read, git)).toEqual({ kind: "unreachable", reason: "path_unknown" });
    const outside = mkdtempSync(join(tmpdir(), "taraflow-norepo-"));
    try {
      expect((await checkComponentDrift(imported, join(outside, "x.tara.json"), read, git)).kind).toBe("unreachable");
      expect(await checkComponentDrift(imported, join(outside, "x.tara.json"), read, git)).toMatchObject({ reason: "no_repo" });
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
    const gone = { ...imported, source: { ...imported.source, branch: "release/missing" } };
    expect(await checkComponentDrift(gone, file, read, git)).toMatchObject({ kind: "unreachable", reason: "ref_missing" });
    const moved = { ...imported, source: { ...imported.source, path: "components/other.tara.json" } };
    expect(await checkComponentDrift(moved, file, read, git)).toMatchObject({ kind: "unreachable", reason: "file_missing" });
  });

  it("unpinned import: the file at its local path, by content", async () => {
    const unpinned = { ...imported, source: { schemaVersion: 14, unpinned: "dirty" as const } };
    expect((await checkComponentDrift(unpinned, file, read, git)).kind).toBe("newer_available"); // v2 is on disk
    expect(await checkComponentDrift({ ...unpinned, contentHash: (await readComponentSource(file, read, git) as { contentHash: string }).contentHash }, file, read, git)).toEqual({ kind: "up_to_date" });
    expect(await checkComponentDrift(unpinned, join(root, "missing.tara.json"), read, git)).toMatchObject({ kind: "unreachable", reason: "file_missing" });
  });

  it("fetch only on request: a checkout behind its remote sees the newer state only after fetching", async () => {
    const clone = mkdtempSync(join(tmpdir(), "taraflow-clone-"));
    try {
      execFileSync("git", ["clone", "-q", root, clone], { stdio: "ignore" });
      const cloneFile = join(clone, "components", "camera.tara.json");
      const current = await readComponentSource(cloneFile, read, git);
      if (!current.ok) throw new Error(current.error);
      const here = { ...imported, contentHash: current.contentHash, source: { ...imported.source, commitSha: current.source.commitSha } };
      // the component team commits a further state to the origin
      const v3 = base();
      v3.info.name = "Camera v3";
      commit(JSON.stringify(v3), "v3");
      expect(await checkComponentDrift(here, cloneFile, read, git)).toEqual({ kind: "up_to_date" });
      expect(await checkComponentDrift(here, cloneFile, read, git, { fetch: true })).toMatchObject({ kind: "newer_available" });
    } finally {
      rmSync(clone, { recursive: true, force: true });
    }
  });

  it("a newer TARAflow reading the imported commit differently is not a newer state of the component (builder changed)", async () => {
    // the stored hash as an older snapshot builder computed it
    const old = { ...imported, contentHash: "0000older000" };
    const atImport = { ...old, source: { ...old.source, branch: undefined, tagPattern: "camera-tara/v1" } };
    expect(await checkComponentDrift(atImport, file, read, git)).toEqual({ kind: "up_to_date", builderChanged: true });
    // the branch moved on with real changes: newer, and the builder note with it
    expect(await checkComponentDrift(old, file, read, git)).toMatchObject({ kind: "newer_available", builderChanged: true });
    // unpinned: no imported commit to rebuild — the stored hash is all there is
    const unpinned = { ...old, source: { schemaVersion: 14, unpinned: "dirty" as const } };
    expect((await checkComponentDrift(unpinned, file, read, git)).kind).toBe("newer_available");
  });

  it("tag pattern: the newest by VERSION — v1.10 after v1.9, also when v1.9 was tagged later on a newer commit", async () => {
    const log = execFileSync("git", ["log", "--format=%H", "-n", "2"], { cwd: root, encoding: "utf-8" }).trim().split("\n");
    sh(root, "tag", "rel/v1.10", log[1]); // the older commit
    sh(root, "tag", "rel/v1.9", log[0]); // tagged later, on the newer commit (e.g. a hotfix line)
    const tagged = { ...imported, source: { ...imported.source, tagPattern: "rel/v*" } };
    expect(await checkComponentDrift(tagged, file, read, git)).toMatchObject({ kind: "newer_available", tag: "rel/v1.10", commitSha: log[1] });
  });

  it("findings: info only — newer state with where, unreachable with why; up to date nothing", () => {
    const project = { components: { imports: [imported], instances: [{ importId: "imp", multiprocessTfId: "mp1" }] }, dfd: { elements: [{ id: "mp1", displayId: "MP-3" }] } };
    expect(componentDriftFindings(project, new Map([["imp", { kind: "up_to_date" } as const]]))).toEqual([]);
    expect(componentDriftFindings(project, new Map([["imp", { kind: "newer_available", contentHash: "x", tag: "camera-tara/v2" } as const]]))).toEqual([
      { key: "components.findings.CMP_NEWER_STATE_AVAILABLE", elementId: "mp1", displayId: "MP-3", params: { component: "Camera", where: "camera-tara/v2" } },
    ]);
    expect(componentDriftFindings(project, new Map([["imp", { kind: "up_to_date", builderChanged: true } as const]])).map((f) => f.key)).toEqual([
      "components.findings.CMP_SNAPSHOT_BUILDER_CHANGED",
    ]);
    expect(componentDriftFindings(project, new Map([["imp", { kind: "unreachable", reason: "no_repo" } as const]]))[0]).toMatchObject({
      key: "components.findings.CMP_SOURCE_UNREACHABLE",
      params: { reason: "no_repo" },
    });
  });
});

describe("drift check — ancestry: an older state is never offered as newer (review of patch 54)", () => {
  let repo: string;
  let path: string;
  const commitHere = (name: string) => {
    const p = base();
    p.info.name = name;
    writeFileSync(path, JSON.stringify(p));
    sh(repo, "add", "-A");
    sh(repo, "commit", "-q", "-m", name);
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf-8" }).trim();
  };
  const importAt = async (): Promise<ComponentImport> => {
    const r = await readComponentSource(path, read, git);
    if (!r.ok) throw new Error(r.error);
    return { id: "imp", componentId: r.snapshot.component.projectId, name: "Camera", source: r.source, importedAt: "t", contentHash: r.contentHash, snapshot: r.snapshot } as ComponentImport;
  };
  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "taraflow-drift-anc-"));
    mkdirSync(join(repo, "components"));
    path = join(repo, "components", "camera.tara.json");
    sh(repo, "init", "-q", "-b", "main");
    sh(repo, "config", "user.email", "t@example.com");
    sh(repo, "config", "user.name", "Test");
    sh(repo, "config", "commit.gpgsign", "false");
  });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it("a second computer whose clone is behind the import: 'clone behind, fetch first' — not 'newer: C1'; after the fetch up to date", async () => {
    commitHere("C1");
    const machineB = mkdtempSync(join(tmpdir(), "taraflow-clone-b-"));
    try {
      execFileSync("git", ["clone", "-q", repo, machineB], { stdio: "ignore" }); // B stays on C1
      commitHere("C2");
      const imported = await importAt(); // computer A imports C2
      const onB = join(machineB, "components", "camera.tara.json");
      expect(await checkComponentDrift(imported, onB, read, git)).toEqual({ kind: "unreachable", reason: "clone_behind" });
      expect(await checkComponentDrift(imported, onB, read, git, { fetch: true })).toEqual({ kind: "up_to_date" });
    } finally {
      rmSync(machineB, { recursive: true, force: true });
    }
  });

  it("a tag pattern set later, its newest tag on an ancestor of the imported commit: not newer", async () => {
    const c3 = commitHere("C3");
    commitHere("C4");
    const imported = await importAt(); // imported from the branch tip C4
    sh(repo, "tag", "cam/v1.2", c3);
    const tagged = { ...imported, source: { ...imported.source, tagPattern: "cam/v*" } };
    expect(await checkComponentDrift(tagged, path, read, git)).toEqual({ kind: "up_to_date" });
  });

  it("separate branches (e.g. after a rebase): a hint, not 'newer'", async () => {
    const imported = await importAt(); // C4 on main
    sh(repo, "checkout", "-q", "-b", "rewritten", "HEAD~1");
    const side = commitHere("C4'");
    sh(repo, "checkout", "-q", "main");
    const onSide = { ...imported, source: { ...imported.source, branch: "rewritten" } };
    expect(await checkComponentDrift(onSide, path, read, git)).toMatchObject({ kind: "diverged", commitSha: side });
    expect(componentDriftFindings(
      { components: { imports: [imported], instances: [] }, dfd: null },
      new Map([["imp", { kind: "diverged", contentHash: "x", commitSha: side } as const]]),
    )[0].key).toBe("components.findings.CMP_SOURCE_DIVERGED");
  });

  it("history rewritten (force push): the imported commit is gone even after fetching — not 'fetch first' again", async () => {
    const origin = mkdtempSync(join(tmpdir(), "taraflow-origin-"));
    const machine = mkdtempSync(join(tmpdir(), "taraflow-clone-rw-"));
    try {
      execFileSync("git", ["clone", "-q", "--bare", repo, origin], { stdio: "ignore" });
      execFileSync("git", ["clone", "-q", origin, machine], { stdio: "ignore" });
      const imported = await importAt(); // imported on another computer, from a commit the origin has
      // the component team rewrites history: the origin's main is replaced, the imported commit is gone
      const rewritten = mkdtempSync(join(tmpdir(), "taraflow-rw-"));
      try {
        sh(rewritten, "init", "-q", "-b", "main");
        sh(rewritten, "config", "user.email", "t@example.com");
        sh(rewritten, "config", "user.name", "Test");
        sh(rewritten, "config", "commit.gpgsign", "false");
        mkdirSync(join(rewritten, "components"));
        writeFileSync(join(rewritten, "components", "camera.tara.json"), JSON.stringify(base()));
        sh(rewritten, "add", "-A");
        sh(rewritten, "commit", "-q", "-m", "rewritten");
        sh(rewritten, "push", "-q", "--force", origin, "main");
      } finally {
        rmSync(rewritten, { recursive: true, force: true });
      }
      // the machine's clone: a fresh clone of the rewritten origin — the imported commit was never
      // there (--no-local: transfer like over the network, only reachable objects)
      rmSync(machine, { recursive: true, force: true });
      execFileSync("git", ["clone", "-q", "--no-local", origin, machine], { stdio: "ignore" });
      const onMachine = join(machine, "components", "camera.tara.json");
      expect(await checkComponentDrift(imported, onMachine, read, git)).toEqual({ kind: "unreachable", reason: "clone_behind" });
      expect(await checkComponentDrift(imported, onMachine, read, git, { fetch: true })).toEqual({ kind: "unreachable", reason: "imported_state_gone" });
    } finally {
      rmSync(origin, { recursive: true, force: true });
      rmSync(machine, { recursive: true, force: true });
    }
  });

  it("a failed fetch is 'remote not reachable', not 'branch missing'", async () => {
    const imported = await importAt();
    sh(repo, "remote", "add", "origin", join(tmpdir(), "taraflow-no-such-remote"));
    try {
      expect(await checkComponentDrift(imported, path, read, git, { fetch: true })).toMatchObject({ kind: "unreachable", reason: "fetch_failed" });
    } finally {
      sh(repo, "remote", "remove", "origin");
    }
  });
});

describe("the newer state read for the update, and up to date right after it (phase 5c)", () => {
  it("found by the drift check, read at exactly that commit; after the update the check says up to date", async () => {
    const repo = mkdtempSync(join(tmpdir(), "taraflow-drift-upd-"));
    try {
      mkdirSync(join(repo, "components"));
      const path = join(repo, "components", "camera.tara.json");
      sh(repo, "init", "-q", "-b", "main");
      sh(repo, "config", "user.email", "t@example.com");
      sh(repo, "config", "user.name", "Test");
      sh(repo, "config", "commit.gpgsign", "false");
      writeFileSync(path, JSON.stringify(base()));
      sh(repo, "add", "-A");
      sh(repo, "commit", "-q", "-m", "v1");
      const r1 = await readComponentSource(path, read, git);
      if (!r1.ok) throw new Error(r1.error);
      const imported = { id: "imp", componentId: r1.snapshot.component.projectId, name: "Camera", source: r1.source, importedAt: "t", contentHash: r1.contentHash, snapshot: r1.snapshot } as ComponentImport;
      const v2 = base();
      v2.info.name = "Camera v2";
      writeFileSync(path, JSON.stringify(v2));
      sh(repo, "add", "-A");
      sh(repo, "commit", "-q", "-m", "v2");
      // an uncommitted edit afterwards must not be what the update reads
      const v3 = base();
      v3.info.name = "Camera v3 (uncommitted)";
      writeFileSync(path, JSON.stringify(v3));
      const status = await checkComponentDrift(imported, path, read, git);
      expect(status.kind).toBe("newer_available");
      const newer = await readNewerComponentState(imported, path, status as Extract<typeof status, { kind: "newer_available" }>, read, git);
      expect(newer.ok && newer.snapshot.component.name).toBe("Camera v2");
      if (!newer.ok) return;
      expect(newer.source.commitSha).toBe((status as { commitSha: string }).commitSha);
      // the import as the update leaves it: new snapshot, hash, source
      const updated = { ...imported, snapshot: newer.snapshot, contentHash: newer.contentHash, source: newer.source };
      expect(await checkComponentDrift(updated, path, read, git)).toEqual({ kind: "up_to_date" });
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

