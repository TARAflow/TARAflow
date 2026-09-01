// src/tests/unit/app/services/prepare-for-disk.test.ts
//
// What a .tara.json may contain. The rule exists because it was broken: the
// stripping logic was private to project-repository, so the five other writers
// (useProjectPersistence's three modes, useProjectFileDownload,
// projectService.exportProject, storageService.exportProjectAsJSON) serialised
// the raw Project and shipped `filePath` — the author's absolute path — into
// every file they produced, including committed test fixtures.
//
// The churn fix (2026-07-31) widened the contract so the on-disk form is
// idempotent — "same state → same bytes → same commit". Beyond filePath /
// hasUnsavedChanges it now also strips:
//   - session + navigation state:  isOpen, lastOpened, currentPhase
//   - audit RESULTS:               audit.lastCommitState, audit.commitHistory,
//                                  audit.lastModified  (they live in git; only
//                                  audit.config is kept)
// and normalises the non-deterministic draw.io thumbnail id (a random
// `ge-svg-<rand>` regenerated every render) to a stable value.
// info.lastModified is deliberately KEPT (the recent-projects list shows it).
//
// These tests pin the contract itself. The companion guard is the grep in
// no-raw-project-serialisation.test.ts: this file says WHAT is correct, that
// one says every writer actually goes through it.

import { describe, it, expect } from "vitest";
import {
  prepareForDisk,
  serialiseProject,
} from "app/services/prepare-for-disk";
import type { Project } from "app/models/project-types";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj_1",
    schemaVersion: 3,
    info: {
      name: "Simple Test Project",
      description: "",
      version: "1.0",
      responsible: "JPM",
      created: "2026-05-22T11:53:20.822Z",
      lastModified: "2026-07-23T15:24:14.999Z",
      tags: {},
      team: [],
      isHighImpact: false,
    },
    lastOpened: "2026-07-23T11:42:34.690Z",
    currentPhase: 5,
    strideMethod: null,
    methodSelected: false,
    phaseStatus: {},
    settings: {},
    status: "draft",
    hazards: null,
    dfd: null,
    assets: null,
    threats: null,
    risks: null,
    attackTrees: null,
    documentation: null,
    audit: null,
    integration: null,
    isOpen: true,
    hasUnsavedChanges: true,
    filePath: "/home/someone/Projects/TARAflow/secret/path.tara.json",
    ...overrides,
  } as unknown as Project;
}

describe("prepareForDisk — runtime-only fields never reach disk", () => {
  it("drops filePath", () => {
    // THE leak: an absolute path on the author's machine, in every file
    // handed to a customer or committed as a fixture.
    expect(prepareForDisk(makeProject())).not.toHaveProperty("filePath");
  });

  it("drops hasUnsavedChanges", () => {
    expect(prepareForDisk(makeProject())).not.toHaveProperty(
      "hasUnsavedChanges",
    );
  });

  it("drops session + navigation state (isOpen, lastOpened, currentPhase)", () => {
    // Not project content: isOpen/lastOpened are session state (the registry
    // tracks last-opened), currentPhase is UI navigation (phaseStatus carries
    // the real progress). Persisting them churns the file on every open.
    const result = prepareForDisk(makeProject());
    expect(result).not.toHaveProperty("isOpen");
    expect(result).not.toHaveProperty("lastOpened");
    expect(result).not.toHaveProperty("currentPhase");
  });

  it("leaves the in-memory project untouched", () => {
    // filePath is still needed for the NEXT save; currentPhase/isOpen for the
    // running UI — stripping must not mutate the in-memory object.
    const project = makeProject();
    prepareForDisk(project);
    expect(project.filePath).toBe(
      "/home/someone/Projects/TARAflow/secret/path.tara.json",
    );
    expect(project.hasUnsavedChanges).toBe(true);
    expect(project.currentPhase).toBe(5);
    expect(project.isOpen).toBe(true);
  });

  it("keeps everything else", () => {
    const result = prepareForDisk(makeProject()) as Record<string, unknown>;
    for (const key of [
      "id",
      "schemaVersion",
      "info",
      "phaseStatus",
      "settings",
      "status",
      "attackTrees",
      "risks",
    ]) {
      expect(result, `${key} must survive`).toHaveProperty(key);
    }
  });
});

describe("prepareForDisk — derived DFD data", () => {
  it("clears the computed graph but keeps the rest of the dfd", () => {
    const project = makeProject({
      dfd: {
        xml: "<mxfile/>",
        elements: [{ id: "P-1" }],
        graph: { huge: "recomputed on load" },
      },
    } as unknown as Partial<Project>);

    const result = prepareForDisk(project) as unknown as {
      dfd: Record<string, unknown>;
    };
    expect(result.dfd.graph).toBeUndefined();
    expect(result.dfd.xml).toBe("<mxfile/>");
    expect(result.dfd.elements).toEqual([{ id: "P-1" }]);
  });

  it("empties dfd.assets on disk — the feature store is the single asset store", () => {
    const project = makeProject({
      dfd: {
        xml: "<mxfile/>",
        elements: [{ id: "P-1" }],
        assets: [
          { id: "uuid-1", displayId: "DA-001", name: "X", assetGroup: "data" },
        ],
      },
    } as unknown as Partial<Project>);

    const result = prepareForDisk(project) as unknown as {
      dfd: Record<string, unknown>;
    };
    // dfd.assets carries no records on disk (runtime projection, re-derived on
    // load); the rest of the dfd is untouched.
    expect(result.dfd.assets).toEqual([]);
    expect(result.dfd.elements).toEqual([{ id: "P-1" }]);
  });

  it("normalises a missing dfd to null", () => {
    const result = prepareForDisk(makeProject({ dfd: undefined } as never));
    expect(result.dfd).toBeNull();
  });

  it("pins the random draw.io thumbnail id so an unchanged diagram is stable", () => {
    // draw.io embeds a fresh random `ge-svg-<rand>` id on every render (root
    // <svg id> + a matching <style> selector). Without normalisation the same
    // diagram serialises to different bytes each save → a guaranteed churn diff.
    const withRandomId = (rand: string) => {
      const svg =
        `<svg id="ge-svg-${rand}" xmlns="http://www.w3.org/2000/svg">` +
        `<style>#ge-svg-${rand}{--bg:red}</style><rect/></svg>`;
      const b64 =
        typeof btoa === "function"
          ? btoa(svg)
          : Buffer.from(svg, "binary").toString("base64");
      return makeProject({
        dfd: {
          xml: "<mxfile/>",
          elements: [],
          thumbnail: `data:image/svg+xml;base64,${b64}`,
        },
      } as unknown as Partial<Project>);
    };

    const a = (prepareForDisk(withRandomId("QhXAMGxWnFZs")) as any).dfd
      .thumbnail as string;
    const b = (prepareForDisk(withRandomId("lvbgYMC9ShjZ")) as any).dfd
      .thumbnail as string;

    // Same diagram, different render id → identical bytes after normalisation.
    expect(a).toBe(b);
    // And the random id is gone, replaced by the stable one.
    const decoded =
      typeof atob === "function"
        ? atob(a.slice("data:image/svg+xml;base64,".length))
        : Buffer.from(
            a.slice("data:image/svg+xml;base64,".length),
            "base64",
          ).toString("binary");
    expect(decoded).toContain("ge-svg-thumb");
    expect(decoded).not.toContain("ge-svg-QhXAMGxWnFZs");
  });

  it("leaves a non-data-url thumbnail untouched", () => {
    const project = makeProject({
      dfd: {
        xml: "<mxfile/>",
        elements: [],
        thumbnail: "https://example/x.png",
      },
    } as unknown as Partial<Project>);
    expect((prepareForDisk(project) as any).dfd.thumbnail).toBe(
      "https://example/x.png",
    );
  });
});

describe("prepareForDisk — audit block is reduced to config", () => {
  it("keeps audit.config but drops audit results (lastCommitState/commitHistory/lastModified)", () => {
    // Audit RESULTS live in git — persisting them (esp. the commit hash) makes
    // the file dirty the instant a commit finishes (a commit can't contain its
    // own hash). Only audit.config belongs on disk.
    const project = makeProject({
      audit: {
        config: { defaultBranch: "main", lastRoundNumber: 2 },
        lastCommitState: {
          commitHash: "abc",
          commitDate: "2026-07-31T00:00:00.000Z",
        },
        commitHistory: [{ hash: "abc" }],
        lastModified: "2026-07-31T00:00:00.000Z",
      },
    } as unknown as Partial<Project>);

    const audit = (prepareForDisk(project) as any).audit;
    expect(audit.config).toEqual({ defaultBranch: "main", lastRoundNumber: 2 });
    expect(audit).not.toHaveProperty("lastCommitState");
    expect(audit).not.toHaveProperty("commitHistory");
    expect(audit).not.toHaveProperty("lastModified");
  });

  it("normalises a missing audit to null", () => {
    expect(
      prepareForDisk(makeProject({ audit: null } as never)).audit,
    ).toBeNull();
  });
});

describe("serialiseProject", () => {
  it("produces JSON that carries no runtime-only field", () => {
    const parsed = JSON.parse(serialiseProject(makeProject()));
    expect(parsed).not.toHaveProperty("filePath");
    expect(parsed).not.toHaveProperty("hasUnsavedChanges");
    expect(parsed).not.toHaveProperty("isOpen");
    expect(parsed).not.toHaveProperty("lastOpened");
    expect(parsed).not.toHaveProperty("currentPhase");
  });

  it("contains no absolute home path anywhere in the output", () => {
    // Broader than the key check: catches a path that reappears under some
    // other key later (the pre-commit hook scans the whole file, not one key).
    const json = serialiseProject(makeProject());
    expect(json).not.toMatch(/\/home\/[^"]+/);
  });

  it("stays human-readable (2-space indent) for reviewable diffs", () => {
    expect(serialiseProject(makeProject())).toContain('\n  "id": "proj_1"');
  });
});

describe("prepareForDisk — audit.config credential/path stripping", () => {
  // Arbitrary, fixed leak values (see NOTE above) — any consistent string works.
  const LEAK_SSH_PATH = "/keys/id_ed25519";
  const LEAK_SIGNING_PATH = "/keys/taraflow_signing.pub";
  const LEAK_PAT_ACCOUNT = "leak-pat-account";
  const LEAK_KEY_ID = "LEAKKEYID";

  // Only the audit config matters for this reduction; the rest of the project is
  // irrelevant here and cast away.
  const projectWith = (config: unknown) =>
    ({ dfd: null, audit: { config } }) as any;

  it("strips per-user / credential / path fields, keeps project-level policy", () => {
    const out = prepareForDisk(
      projectWith({
        provider: "github",
        remoteUrl: "git@github.com:x/y.git",
        author: { name: "J", email: "j@x" },
        auth: {
          method: "ssh",
          patAccount: LEAK_PAT_ACCOUNT,
          sshKeyPath: LEAK_SSH_PATH,
        },
        gpg: { enabled: false, keyId: LEAK_KEY_ID, hasStoredKey: true },
        signing: {
          enabled: true,
          format: "ssh",
          sshSigningKeyPath: LEAK_SIGNING_PATH,
          keyId: LEAK_KEY_ID,
          hasStoredKey: true,
        },
        lastRoundNumber: 3,
      }),
    );
    const cfg = (out.audit as any).config;

    // Reduced to project-level policy only.
    expect(cfg.signing).toEqual({ enabled: true, format: "ssh" });
    expect(cfg.gpg).toEqual({ enabled: false });
    expect(cfg.auth).toEqual({ method: "ssh" });

    // No per-user / credential / path value survives anywhere in the output.
    const json = JSON.stringify(out);
    expect(json).not.toContain(LEAK_SSH_PATH);
    expect(json).not.toContain(LEAK_SIGNING_PATH);
    expect(json).not.toContain(LEAK_PAT_ACCOUNT);
    expect(json).not.toContain(LEAK_KEY_ID);
    // ...and none of the stripped KEYS remain either.
    expect(json).not.toMatch(
      /hasStoredKey|sshSigningKeyPath|sshKeyPath|patAccount|keyId/,
    );

    // Project-level policy is preserved.
    expect(cfg.provider).toBe("github");
    expect(cfg.remoteUrl).toBe("git@github.com:x/y.git");
    expect(cfg.author).toEqual({ name: "J", email: "j@x" });
    expect(cfg.lastRoundNumber).toBe(3);
  });

  it("does not throw on a partial config missing auth/gpg/signing", () => {
    expect(() =>
      prepareForDisk(projectWith({ provider: "github", lastRoundNumber: 0 })),
    ).not.toThrow();
  });

  it("leaves signing absent when the config has no signing block", () => {
    const out = prepareForDisk(
      projectWith({
        provider: "github",
        auth: { method: "pat" },
        gpg: { enabled: false },
      }),
    );
    const cfg = (out.audit as any).config;
    expect(cfg.signing).toBeUndefined();
    expect(cfg.auth).toEqual({ method: "pat" });
  });
});

 