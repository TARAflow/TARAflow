// @vitest-environment jsdom
//
// src/tests/integration/components/component-tara-flow.int.test.ts
//
// Multi-project TARA, end-to-end (PLAN-0.19 / design §14): the whole flow of
// a component TARA through a machine with REAL git repositories and the real
// file path — no UI, every step the app takes through its services:
//
//   component committed + tagged → read as the import reads it (pinned)
//   → imported into a machine, its risks synced → saved and opened again
//   → decided in the machine (assumption not fulfilled, measure not effective)
//   → the Overview's view and the deviation list
//   → drift: up to date; the component changes (description) → newer state
//   → update preview: trivial; applied — decisions kept, pinned to the new commit
//   → a non-trivial change (an assumption dropped) is not trivial
//   → the report (CLI path: load → doc data → Markdown), English and German
//   → AVE: the committed machine passes; a snapshot changed in place is found
//   → the last instance deleted: no component left in the Overview or report
//
// Runs in the integration suite (`npm run test:integration`, needs git), in
// jsdom: the import edits the draw.io XML through the browser DOM, as in the app.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Project } from "app/models/project-types";
import type { ComponentSnapshot } from "app/models/component-snapshot-types";
import { readComponentSource, type ComponentGitRunner, type ComponentSourceOk } from "app/services/component-import/component-source";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { checkComponentDrift, readNewerComponentState, updateTargetOf } from "app/services/component-import/component-drift";
import { updateInputOf, updateOutcomeOf, updatePreview } from "app/services/component-import/update-preview";
import { applyComponentUpdate } from "app/services/component-import/component-update";
import { withAssumptionStatus } from "app/services/component-import/assumption-status";
import { withMeasureOverride } from "app/services/component-import/measure-overrides";
import { componentOverviewItems } from "app/services/component-import/component-overview";
import { pruneDeletedInstances } from "app/services/component-import/instance-lifecycle";
import { snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { componentThreatReferences } from "app/utils/component-threats";
import { syncRisksFromThreats } from "features/risks/services/risk-sync-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { isTrivialUpdate } from "features/components/components/component-update-dialog";
import { checkComponentImport } from "features/audit/services/verify/checks/component-import";
import { createGitReaderExec } from "features/audit/services/verify/git-reader-exec";
import type { VerifyContext } from "features/audit/services/verify/verify-context";
import { canonicalStringify } from "shared/utils/tcs-canonical";
import { EMPTY_PROJECT_TAGS } from "shared";
import { createCliGenerator } from "features/documentation/utils/generators/cli-generators";
import { DEFAULT_DOC_CONFIGURATION, type DocConfiguration } from "features/documentation/models/doc-types";
import { loadProject } from "../../../../taraflow-reporter/cli/load-project";
import { toDocProjectData } from "../../../../taraflow-reporter/cli/to-doc-project-data";
import { i18n, initI18nNode } from "../../../../taraflow-reporter/cli/i18n-node";
import { component } from "../../fixtures/component-treatment-machine";
import { flow, mxfile, node, page } from "../../fixtures/leveled-dfd-xml";

// ── git and files ───────────────────────────────────────────────────────────
const run: ComponentGitRunner = (args, cwd) =>
  new Promise((resolve) => {
    execFile("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ stdout, stderr, code: err ? ((err as { code?: number }).code ?? 1) || 1 : 0 }),
    );
  });
async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await run(args, cwd);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
async function initRepo(dir: string) {
  await git(dir, "init", "-q", "-b", "main");
  await git(dir, "config", "user.name", "Tester");
  await git(dir, "config", "user.email", "tester@example.com");
  await git(dir, "config", "commit.gpgsign", "false");
  await git(dir, "config", "tag.gpgsign", "false");
}
async function commit(dir: string, file: string, text: string, message: string): Promise<string> {
  await writeFile(join(dir, file), text);
  await git(dir, "add", file);
  await git(dir, "commit", "-q", "-m", message);
  return git(dir, "rev-parse", "HEAD");
}
const readText = async (path: string) => {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
};

// ── the machine around the component ────────────────────────────────────────
const MACHINE_CONTEXT = {
  xml: mxfile(page("top", "Panel", node("m_plc", "externalentity", "PLC", "EE-1", 10) + node("m_p1", "process", "Logic", "P-1", 300) + flow("m_df1", "x", "DF-1", "m_plc", "m_p1"))),
  pages: [],
  pageId: "top",
  assets: [],
  elements: [
    { id: "m_plc", displayId: "EE-1", name: "PLC", type: "ExternalEntity", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
    { id: "m_p1", displayId: "P-1", name: "Logic", type: "Process", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
  ],
  connections: [{ id: "m_df1", displayId: "DF-1", name: "x", from: "m_plc", to: "m_p1", properties: {} }],
} as never;

const now = "2026-11-12T10:00:00.000Z";

/** The import as the app does it: the DFD and the components block, then the risks of the instance's threats. */
function importInto(read: ComponentSourceOk): Project {
  const applied = applyComponentImport({
    context: MACHINE_CONTEXT,
    machine: {},
    result: read,
    choice: { prefix: "SD1", name: "Smoke Detector", eeMapping: { "EE-1": "m_plc" } },
    ids: { importId: "imp", instanceId: "i1" },
    importedAt: now,
  });
  const base = {
    id: "machine",
    info: { name: "Fire Panel", description: "Machine importing a component", version: "1.0", responsible: "Tester", created: now, lastModified: now, tags: { ...EMPTY_PROJECT_TAGS }, team: [], isHighImpact: false },
    components: applied.components,
    dfd: { xml: applied.outcome.xml, pages: applied.outcome.pages, elements: applied.outcome.elements, connections: applied.outcome.connections },
    assets: null,
  } as unknown as Project;
  const refs = componentThreatReferences({ ...base, risks: null } as never, "per-element");
  const risks = syncRisksFromThreats({ configuration: DEFAULT_CONFIGURATION, risks: [], lastModified: now } as never, refs).riskData;
  return { ...base, risks } as Project;
}

const overviewOf = (p: Project) =>
  componentOverviewItems({
    components: p.components,
    risks: p.risks ?? null,
    dfd: p.dfd ?? null,
    threats: p.threats ?? null,
    assets: p.assets ?? null,
    attackTrees: p.attackTrees ?? null,
  });

async function report(file: string, language: "en" | "de"): Promise<string> {
  await initI18nNode(language);
  const { project } = await loadProject(file);
  const config: DocConfiguration = { ...DEFAULT_DOC_CONFIGURATION, format: "markdown", language };
  // the CLI's translate function (taraflow-report.ts)
  const t = (key: string, defaultValue?: string): string => i18n.getFixedT(language)(key, { defaultValue });
  return createCliGenerator(toDocProjectData(project, language), config, t).generate().content;
}

const assumptionId = component.project.itemDefinition!.assumptions[0].id;

describe("component TARA → machine → update → report → AVE (end-to-end, real git)", () => {
  let componentRepo: string;
  let machineRepo: string;
  let componentFile: string;
  let machineFile: string;
  let v1: string;
  let v2: string;
  let machine: Project;

  beforeAll(async () => {
    componentRepo = await mkdtemp(join(tmpdir(), "taraflow-component-"));
    machineRepo = await mkdtemp(join(tmpdir(), "taraflow-machine-"));
    await initRepo(componentRepo);
    await initRepo(machineRepo);
    componentFile = join(componentRepo, "smoke.tara.json");
    machineFile = join(machineRepo, "panel.tara.json");
    v1 = await commit(componentRepo, "smoke.tara.json", JSON.stringify(component.project, null, 2), "component v1");
    await git(componentRepo, "tag", "sd/v1");
  });

  afterAll(async () => {
    await rm(componentRepo, { recursive: true, force: true });
    await rm(machineRepo, { recursive: true, force: true });
  });

  it("1. the committed component is read pinned to its commit and tag", async () => {
    const read = await readComponentSource(componentFile, readText, run);
    if (!read.ok) throw new Error(read.error);
    expect(read.source).toMatchObject({ commitSha: v1, tag: "sd/v1", path: "smoke.tara.json" });
    expect(read.contentHash).toBe(snapshotContentHash(read.snapshot));
    machine = importInto(read);
    expect(machine.components!.instances.map((i) => i.prefix)).toEqual(["SD1"]);
    expect(machine.risks!.risks.length).toBeGreaterThan(0);
    expect(machine.risks!.risks.every((r) => r.threatDisplayId.startsWith("SD1:"))).toBe(true);
  });

  it("2. saved and opened again: the snapshot still hashes to its record", async () => {
    await commit(machineRepo, "panel.tara.json", JSON.stringify(machine, null, 2), "machine: import Smoke Detector");
    const { project } = await loadProject(machineFile);
    const imported = project.components!.imports[0];
    expect(snapshotContentHash(imported.snapshot as ComponentSnapshot)).toBe(imported.contentHash);
    machine = project;
  });

  it("3. decided in the machine; the Overview shows the deviations for the platform team", () => {
    let components = withAssumptionStatus(machine.components!, "i1", assumptionId, { status: "not_fulfilled", rationale: "The PLC does not check frames" });
    components = withMeasureOverride(components, "i1", "M-S-001", "The sensor bus is not reachable from outside here", "2026-11-12");
    machine = { ...machine, components };
    const [item] = overviewOf(machine);
    expect(item).toMatchObject({ name: "Smoke Detector", origin: { commit: v1, tag: "sd/v1" } });
    expect(item.instances[0]).toMatchObject({ prefix: "SD1", assumptionsNotFulfilled: 1 });
    expect(item.deviations.map((d) => d.kind).sort()).toEqual(["assumption_not_fulfilled", "measure_not_effective"]);
  });

  it("4. drift: up to date; after a new commit of the component a newer state", async () => {
    const imported = machine.components!.imports[0];
    expect(await checkComponentDrift(imported, componentFile, readText, run)).toMatchObject({ kind: "up_to_date" });
    const changed = { ...component.project, info: { ...component.project.info, description: "Optical smoke detector, revision B" } };
    v2 = await commit(componentRepo, "smoke.tara.json", JSON.stringify(changed, null, 2), "component v2: description");
    const status = await checkComponentDrift(imported, componentFile, readText, run);
    expect(status).toMatchObject({ kind: "newer_available", commitSha: v2 });
    expect(updateTargetOf(imported, status)).toMatchObject({ refresh: false });
  });

  it("5. a description change is a trivial update; applied, the decisions stay and the import is pinned to v2", async () => {
    const imported = machine.components!.imports[0];
    const status = await checkComponentDrift(imported, componentFile, readText, run);
    const target = updateTargetOf(imported, status)!;
    const next = await readNewerComponentState(imported, componentFile, target.status, readText, run);
    if (!next.ok) throw new Error(next.error);
    const preview = updatePreview(machine, "imp", next);
    expect(preview.aboutChanged).toBe(true);
    const choice = { pairs: [], ees: {} };
    const outcome = updateOutcomeOf(applyComponentUpdate(updateInputOf(machine, "imp", next, choice, "preview")));
    expect(isTrivialUpdate(preview, outcome)).toBe(true);

    const result = applyComponentUpdate(updateInputOf(machine, "imp", next, choice, now));
    machine = result.project as Project;
    const updated = machine.components!.imports[0];
    expect(updated.source.commitSha).toBe(v2);
    expect(updated.contentHash).toBe(next.contentHash);
    expect(snapshotContentHash(updated.snapshot as ComponentSnapshot)).toBe(updated.contentHash);
    expect(overviewOf(machine)[0].deviations.map((d) => d.kind).sort()).toEqual(["assumption_not_fulfilled", "measure_not_effective"]);
    expect(await checkComponentDrift(updated, componentFile, readText, run)).toMatchObject({ kind: "up_to_date" });
  });

  it("6. an update that drops a decided assumption is not trivial (and is not applied here)", async () => {
    const without = { ...component.project, itemDefinition: { ...component.project.itemDefinition!, assumptions: [] } };
    await commit(componentRepo, "smoke.tara.json", JSON.stringify(without, null, 2), "component v3: assumption dropped");
    const imported = machine.components!.imports[0];
    const status = await checkComponentDrift(imported, componentFile, readText, run);
    const next = await readNewerComponentState(imported, componentFile, updateTargetOf(imported, status)!.status, readText, run);
    if (!next.ok) throw new Error(next.error);
    const outcome = updateOutcomeOf(applyComponentUpdate(updateInputOf(machine, "imp", next, { pairs: [], ees: {} }, "preview")));
    expect(outcome.dropped.length + outcome.review).toBeGreaterThan(0);
    expect(isTrivialUpdate(updatePreview(machine, "imp", next), outcome)).toBe(false);
  });

  it("7. the report (CLI path) has the imported component with its decisions, in English and German", async () => {
    await commit(machineRepo, "panel.tara.json", JSON.stringify(machine, null, 2), "machine: decisions, update to v2");
    const en = await report(machineFile, "en");
    expect(en).toContain("Imported Components");
    expect(en).toContain("Smoke Detector");
    expect(en).toContain("SD1");
    expect(en).toContain("The PLC does not check frames");
    expect(en).toContain(v2.slice(0, 8));
    const de = await report(machineFile, "de");
    expect(de).toContain("Importierte Komponenten");
    expect(de).toContain("Importiert am");
    expect(de).toContain("Smoke Detector");
    expect(de).toContain("The PLC does not check frames"); // the machine's own text, as written
    expect(de).not.toEqual(en);
    await initI18nNode("en");
  });

  it("8. AVE: the committed machine passes; a snapshot changed in place under its hash is found", async () => {
    const tampered = structuredClone(machine) as unknown as { components: { imports: { snapshot: { about?: { description?: string } } }[] } };
    tampered.components.imports[0].snapshot.about = { ...tampered.components.imports[0].snapshot.about, description: "edited in the file" };
    const before = await git(machineRepo, "rev-parse", "HEAD");
    const bad = await commit(machineRepo, "panel.tara.json", JSON.stringify(tampered, null, 2), "machine: snapshot edited");
    const reader = createGitReaderExec(machineRepo);
    const first = await git(machineRepo, "rev-list", "--max-parents=0", "HEAD");
    const check = async (from: string, to: string) =>
      checkComponentImport({ reader, history: await reader.history(from, to), canonicalize: canonicalStringify } as unknown as VerifyContext);
    expect(await check(first, before)).toEqual([]);
    const findings = await check(before, bad);
    expect(findings.map((f) => f.id)).toEqual(["CMP_SNAPSHOT_HASH_MISMATCH"]);
  });

  it("9. the last instance deleted: no component in the Overview, none in the report", async () => {
    const pruned = pruneDeletedInstances(machine, (machine.dfd?.elements ?? []).filter((e) => e.id !== machine.components!.instances[0].multiprocessTfId));
    expect(pruned.components?.imports).toEqual([]);
    const without = { ...machine, components: pruned.components } as Project;
    expect(overviewOf(without)).toEqual([]);
    await commit(machineRepo, "panel.tara.json", JSON.stringify(without, null, 2), "machine: component removed");
    const en = await report(machineFile, "en");
    expect(en).not.toContain("Imported Components");
    expect(en).not.toContain("The PLC does not check frames");
  });
});

// Review 2026-11-13: "try, then commit" must lead to a pinned import. An
// unpinned import whose file is committed later WITHOUT a content change has
// no newer state — the check names the commit and "refresh the stored state"
// binds the import to it.
describe("an unpinned import committed later without a change is pinned by a refresh", () => {
  let repo: string;
  let file: string;
  beforeAll(async () => {
    repo = await mkdtemp(join(tmpdir(), "taraflow-unpinned-"));
    await initRepo(repo);
    await commit(repo, "README.md", "component repo\n", "init");
    file = join(repo, "smoke.tara.json");
    await writeFile(file, JSON.stringify(component.project, null, 2));
  });
  afterAll(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it("untracked: unpinned, nothing to update; committed unchanged: refresh pins it to the commit", async () => {
    const read = await readComponentSource(file, readText, run);
    if (!read.ok) throw new Error(read.error);
    expect(read.source.unpinned).toBe("untracked");
    let project = importInto(read);
    const unpinned = project.components!.imports[0];
    // not committed yet: up to date, nothing offered
    const before = await checkComponentDrift(unpinned, file, readText, run);
    expect(before).toEqual({ kind: "up_to_date" });
    expect(updateTargetOf(unpinned, before)).toBeUndefined();

    // committed without a change
    const sha = await commit(repo, "smoke.tara.json", JSON.stringify(component.project, null, 2), "component: commit the tried state");
    const status = await checkComponentDrift(unpinned, file, readText, run);
    expect(status).toEqual({ kind: "up_to_date", committedAs: { commitSha: sha } });
    const target = updateTargetOf(unpinned, status);
    expect(target).toMatchObject({ refresh: true, status: { commitSha: sha } });

    // the refresh: the same content, now bound to the commit
    const next = await readNewerComponentState(unpinned, file, target!.status, readText, run);
    if (!next.ok) throw new Error(next.error);
    expect(next.contentHash).toBe(unpinned.contentHash);
    const choice = { pairs: [], ees: {} };
    const outcome = updateOutcomeOf(applyComponentUpdate(updateInputOf(project, "imp", next, choice, "preview")));
    expect(isTrivialUpdate(updatePreview(project, "imp", next), outcome)).toBe(true);
    project = applyComponentUpdate(updateInputOf(project, "imp", next, choice, now)).project as Project;
    const pinned = project.components!.imports[0];
    expect(pinned.source.commitSha).toBe(sha);
    expect(pinned.source.unpinned).toBeUndefined();
    expect(pinned.source.path).toBe("smoke.tara.json");
    // from now on a pinned import, up to date
    expect(await checkComponentDrift(pinned, file, readText, run)).toEqual({ kind: "up_to_date" });
  });

  it("a local change after the commit is not offered as pinning (the content differs: a newer state)", async () => {
    const read = await readComponentSource(file, readText, run);
    if (!read.ok) throw new Error(read.error);
    // an import that was taken unpinned from the committed content
    const unpinned = { ...importInto(read).components!.imports[0], source: { ...read.source, commitSha: undefined, unpinned: "dirty" as const } };
    await writeFile(file, JSON.stringify({ ...component.project, info: { ...component.project.info, description: "changed locally" } }, null, 2));
    const status = await checkComponentDrift(unpinned as never, file, readText, run);
    expect(status.kind).toBe("newer_available");
    expect((status as { committedAs?: unknown }).committedAs).toBeUndefined();
    await git(repo, "checkout", "--", "smoke.tara.json");
  });
});
