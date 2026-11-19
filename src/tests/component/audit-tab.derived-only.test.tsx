// @vitest-environment jsdom
//
// Manual test 2026-11-17: after a renumbering the risk sync rewrote the
// threat ids it copies into the risks. The Audit tab listed no change ("No
// changes detected") and locked Commit, while the file differed from HEAD —
// the repository stayed dirty for good. When the diff lists nothing but git
// reports the file modified, the tab offers one "Derived values only" change.

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditProjectData } from "features/audit/models/audit-types";
import { createDefaultAuditData } from "features/audit/models/audit-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

const toolbar = vi.fn();
vi.mock("features/audit/components/audit-toolbar", () => ({
  AuditToolbar: (props: { hasChanges: boolean; changeCount: number }) => {
    toolbar(props);
    return null;
  },
}));
const summary = vi.fn();
vi.mock("features/audit/components/audit-summary", () => ({
  AuditSummary: (props: { changes: { phaseLabel: string; changes: { id: string }[] }[] }) => {
    summary(props);
    return null;
  },
}));
vi.mock("features/audit/components/phase-diff-viewer", () => ({ PhaseDiffViewer: () => null }));
vi.mock("features/audit/components/commit-dialog", () => ({ CommitDialog: () => null }));
vi.mock("features/audit/components/verification-panel", () => ({ VerificationPanel: () => null }));
vi.mock("features/audit/components/audit-verify-panel", () => ({ AuditVerifyPanel: () => null }));
vi.mock("features/audit/components/audit-config-dialog", () => ({ AuditConfigDialog: () => null }));
const repo = { outcome: { kind: "repo-ok", repoRoot: "/r", hooks: { ok: true }, attributes: { ok: true } } };
vi.mock("features/audit/hooks/useAuditRepo", () => ({ useAuditRepo: () => repo }));
vi.mock("features/audit/hooks/useAuditProtection", () => ({
  useAuditProtection: () => ({ anchor: null, refresh: vi.fn(async () => {}) }),
}));

let status = "";
let head = "";
vi.mock("features/audit/services/git-service-renderer", () => ({
  createGitService: () =>
    new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (prop === "isRepository") return async () => true;
          if (prop === "raw")
            return async (args: string[]) => {
              if (args[0] === "show") return { success: true, data: head };
              if (args[0] === "status") return { success: true, data: status };
              return { success: true, data: "" };
            };
          return async () => ({ success: false, error: "mocked" });
        },
      },
    ),
}));
vi.mock("features/audit/services/credential-service-renderer", () => ({
  credentialService: new Proxy({}, { get: () => async () => undefined }),
}));

import { AuditTab } from "features/audit/components/audit-tab";

const project = {
  id: "machine",
  name: "Machine",
  filePath: "/r/m.tara.json",
  audit: createDefaultAuditData(),
  phaseStatus: {},
  info: { name: "Machine" },
  hazards: null,
  dfd: null,
  assets: null,
  threats: null,
  risks: { risks: [{ id: "r1", threatId: "t1", threatDisplayId: "DF-9-T-1", selectedMitigations: [], factorRatings: [], mitigatedFactorRatings: [] }] },
  attackTrees: null,
  lastModified: "",
} as unknown as AuditProjectData;

const lastToolbar = () => toolbar.mock.calls.at(-1)?.[0] as { hasChanges: boolean; changeCount: number } | undefined;

const lastChanges = () => summary.mock.calls.at(-1)?.[0]?.changes as { phaseLabel: string; changes: { id: string }[] }[] | undefined;

describe("AuditTab — derived values only", () => {
  beforeEach(() => {
    toolbar.mockClear();
    summary.mockClear();
    head = JSON.stringify(project);
  });
  afterEach(() => {
    delete (window as { electron?: unknown }).electron;
  });
  const onDisk = (text: string | null) => {
    (window as { electron?: unknown }).electron = { file: { readProject: async () => (text === null ? { success: false } : { success: true, data: text }) } };
  };

  it("only the threat ids copied into the risks changed: \"Derived values\", with the places", async () => {
    status = " M m.tara.json\n";
    const changed = JSON.parse(head);
    changed.risks.risks[0].threatDisplayId = "DF-6-T-1";
    onDisk(JSON.stringify(changed));
    render(<AuditTab project={project} onUpdate={vi.fn()} />);
    await waitFor(() => expect(lastToolbar()?.hasChanges).toBe(true));
    expect(lastChanges()![0].phaseLabel).toBe("Derived values");
    expect(lastChanges()![0].changes.map((c) => c.id)).toEqual(["/risks/risks/0/threatDisplayId"]);
  });

  // review 2026-11-20: a change the diff does not cover is no "derived value"
  it("another change the diff does not list: committable, named as such, with its place", async () => {
    status = " M m.tara.json\n";
    onDisk(JSON.stringify({ ...JSON.parse(head), notListed: { field: 1 } }));
    render(<AuditTab project={project} onUpdate={vi.fn()} />);
    await waitFor(() => expect(lastToolbar()?.hasChanges).toBe(true));
    expect(lastChanges()![0].phaseLabel).toBe("Changes the audit diff does not list");
    expect(lastChanges()![0].changes.map((c) => c.id)).toEqual(["/notListed"]);
  });

  it("the file is clean: no change", async () => {
    status = "";
    onDisk(head);
    render(<AuditTab project={project} onUpdate={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(lastToolbar()?.hasChanges).toBe(false);
  });
});
