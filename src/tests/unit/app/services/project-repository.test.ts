import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { projectRepository } from "app/services/project-repository";
import { projectRegistry } from "app/services/project-registry";
import type { Project } from "app/models/project-types";

// Access the internal prepareForDisk indirectly via save(), since it's not
// exported. If you export it for testability, import it directly instead.

function makeElectronMock() {
  const writeProject = vi.fn().mockResolvedValue({ success: true });
  const readProject = vi.fn();
  (globalThis as any).window = {
    electron: { file: { writeProject, readProject } },
  };
  return { writeProject, readProject };
}

afterEach(() => {
  delete (globalThis as any).window;
  vi.restoreAllMocks();
});

describe("ProjectRepository.createEmpty", () => {
  it("creates a project with no filePath and no unsaved-changes flag set to true", () => {
    const project = projectRepository.createEmpty("Test", "desc");
    expect(project.filePath).toBeUndefined();
    expect(project.hasUnsavedChanges).toBe(false);
    expect(project.isOpen).toBe(true);
  });
});

describe("ProjectRepository.save — runtime fields must never reach disk", () => {
  let writeProject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ writeProject } = makeElectronMock());
    vi.spyOn(projectRegistry, "upsert").mockResolvedValue(undefined);
  });

  it("strips filePath from the written payload", async () => {
    const project: Project = {
      ...projectRepository.createEmpty("Test", "desc"),
      filePath: "/tmp/leak.tara.json",
    };

    await projectRepository.save(project);

    expect(writeProject).toHaveBeenCalledTimes(1);
    const [, payloadStr] = writeProject.mock.calls[0];
    const written = JSON.parse(payloadStr);

    expect(written).not.toHaveProperty("filePath");
  });

  it("strips hasUnsavedChanges from the written payload", async () => {
    const project: Project = {
      ...projectRepository.createEmpty("Test", "desc"),
      filePath: "/tmp/leak.tara.json",
      hasUnsavedChanges: true,
    };

    await projectRepository.save(project);

    const [, payloadStr] = writeProject.mock.calls[0];
    const written = JSON.parse(payloadStr);

    expect(written).not.toHaveProperty("hasUnsavedChanges");
  });

  it("strips the DFD graph (derived, rebuilt on load)", async () => {
    const project: Project = {
      ...projectRepository.createEmpty("Test", "desc"),
      filePath: "/tmp/leak.tara.json",
      dfd: { graph: { nodes: [1, 2, 3] } } as any,
    };

    await projectRepository.save(project);

    const [, payloadStr] = writeProject.mock.calls[0];
    const written = JSON.parse(payloadStr);

    expect(written.dfd.graph).toBeUndefined();
  });

  it("does not write when project has no filePath (unsaved, in-memory only)", async () => {
    const project = projectRepository.createEmpty("Test", "desc");
    const result = await projectRepository.save(project);

    expect(writeProject).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});

describe("ProjectRepository.saveToPath", () => {
  it("attaches filePath in memory but still strips it before writing", async () => {
    const { writeProject } = makeElectronMock();
    vi.spyOn(projectRegistry, "upsert").mockResolvedValue(undefined);

    const project = projectRepository.createEmpty("Test", "desc");
    const result = await projectRepository.saveToPath(
      project,
      "/tmp/newfile.tara.json",
    );

    // In-memory object correctly carries filePath for future saves
    expect(result.data?.filePath).toBe("/tmp/newfile.tara.json");

    // But disk payload does not
    const [, payloadStr] = writeProject.mock.calls[0];
    const written = JSON.parse(payloadStr);
    expect(written).not.toHaveProperty("filePath");
  });
});

describe("ProjectRepository.loadFromPath", () => {
  it("attaches filePath to the in-memory project after load", async () => {
    const { readProject } = makeElectronMock();
    const rawProject = projectRepository.createEmpty("Loaded", "desc");
    readProject.mockResolvedValue({
      success: true,
      data: JSON.stringify(rawProject),
    });

    const result = await projectRepository.loadFromPath(
      "/tmp/existing.tara.json",
    );

    expect(result.success).toBe(true);
    expect(result.data?.filePath).toBe("/tmp/existing.tara.json");
  });

  it("returns an error when the file is corrupted beyond repair", async () => {
    const { readProject } = makeElectronMock();
    readProject.mockResolvedValue({ success: true, data: "not valid json {{{" });

    const result = await projectRepository.loadFromPath("/broken.tara.json");
    expect(result.success).toBe(false);
  });
});