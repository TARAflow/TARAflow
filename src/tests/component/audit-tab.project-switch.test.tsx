// @vitest-environment jsdom
//
// Regression: switching projects while the Audit tab is open must never write
// one project's audit data (config, author, signing) into another.
//
// The workspace rendered one AuditTab instance for every project (a prop-only
// swap on a switch). The tab's re-sync from the project skipped a project
// without audit data (project.audit === null), so the outgoing project's audit
// config stayed in the tab, and the next save handed it to an update handler
// that resolved its target as "whatever is active now".
//
// AuditTab now keys its view by project id, the workspace pins the handlers to
// that id, and the view flushes a pending edit on unmount. The tests render the
// tab WITHOUT a key on purpose, with one handler per project.

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AuditConfig,
  AuditData,
  AuditProjectData,
  AuditUpdateResult,
} from "features/audit/models/audit-types";
import { createDefaultAuditData } from "features/audit/models/audit-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

// ── Leaf UI and git plumbing mocked: the test is about the working copy. ──
vi.mock("features/audit/components/audit-toolbar", () => ({ AuditToolbar: () => null }));
vi.mock("features/audit/components/audit-summary", () => ({ AuditSummary: () => null }));
vi.mock("features/audit/components/phase-diff-viewer", () => ({ PhaseDiffViewer: () => null }));
vi.mock("features/audit/components/commit-dialog", () => ({ CommitDialog: () => null }));
vi.mock("features/audit/components/verification-panel", () => ({ VerificationPanel: () => null }));
vi.mock("features/audit/components/audit-verify-panel", () => ({ AuditVerifyPanel: () => null }));
vi.mock("features/audit/components/audit-config-dialog", () => ({
  AuditConfigDialog: ({
    config,
    onSave,
  }: {
    config: AuditConfig;
    onSave: (c: AuditConfig) => Promise<void>;
  }) => (
    <div>
      <span data-testid="author">{config.author.name || "(none)"}</span>
      <button
        onClick={() => void onSave({ ...config, author: { ...config.author, name: "Edited" } })}
      >
        save-config
      </button>
    </div>
  ),
}));
vi.mock("features/audit/hooks/useAuditRepo", () => ({
  useAuditRepo: () => ({ outcome: undefined }),
}));
vi.mock("features/audit/hooks/useAuditProtection", () => ({
  useAuditProtection: () => ({ anchor: null, refresh: vi.fn(async () => {}) }),
}));
vi.mock("features/audit/services/git-service-renderer", () => ({
  createGitService: () =>
    new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === "isRepository"
            ? async () => true
            : async () => ({ success: false, error: "mocked" }),
      },
    ),
}));
vi.mock("features/audit/services/credential-service-renderer", () => ({
  credentialService: new Proxy({}, { get: () => async () => undefined }),
}));
vi.mock("features/audit/services/diff-service", () => ({
  diffService: {
    detectChanges: () => [],
    generateCommitMessageData: () => null,
  },
}));

import { AuditTab } from "features/audit/components/audit-tab";

const auditWithAuthor = (name: string): AuditData => {
  const base = createDefaultAuditData();
  return {
    ...base,
    config: { ...base.config, author: { name, email: `${name.toLowerCase()}@example.com` } },
    lastModified: "2026-01-01T00:00:00.000Z",
  };
};

const project = (id: string, audit: AuditData | null): AuditProjectData =>
  ({
    id,
    name: id,
    audit,
    phaseStatus: {},
    info: { name: id },
    hazards: null,
    dfd: null,
    assets: null,
    threats: null,
    risks: null,
    attackTrees: null,
    lastModified: "",
  }) as unknown as AuditProjectData;

describe("AuditTab — project switch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not carry A's audit config into a project without audit data", async () => {
    const onUpdateA = vi.fn<(u: AuditUpdateResult) => void>();
    const onUpdateB = vi.fn<(u: AuditUpdateResult) => void>();

    const { rerender } = render(
      <AuditTab project={project("A", auditWithAuthor("Alice"))} onUpdate={onUpdateA} />,
    );
    expect(screen.getByTestId("author").textContent).toBe("Alice");

    // Prop-only swap to B, which has no audit data yet.
    rerender(<AuditTab project={project("B", null)} onUpdate={onUpdateB} />);
    expect(screen.getByTestId("author").textContent).not.toBe("Alice");

    // An edit in B saves B's own (default) config, never A's.
    await act(async () => {
      fireEvent.click(screen.getByText("save-config"));
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(onUpdateA).not.toHaveBeenCalled();
    expect(onUpdateB).toHaveBeenCalled();
    const saved = onUpdateB.mock.calls.at(-1)![0];
    expect(saved.audit.config.author.name).toBe("Edited");
    expect(saved.audit.config.author.email).not.toBe("alice@example.com");
  });

  it("flushes a pending edit to its own project on switch", async () => {
    const onUpdateA = vi.fn<(u: AuditUpdateResult) => void>();
    const onUpdateB = vi.fn<(u: AuditUpdateResult) => void>();

    const { rerender } = render(
      <AuditTab project={project("A", auditWithAuthor("Alice"))} onUpdate={onUpdateA} />,
    );

    // Edit in A, then switch before the 1 s debounce fires.
    await act(async () => {
      fireEvent.click(screen.getByText("save-config"));
    });
    rerender(<AuditTab project={project("B", auditWithAuthor("Bob"))} onUpdate={onUpdateB} />);
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(onUpdateA).toHaveBeenCalledTimes(1);
    expect(onUpdateA.mock.calls[0][0].audit.config.author.name).toBe("Edited");
    expect(onUpdateA.mock.calls[0][0].audit.config.author.email).toBe("alice@example.com");
    expect(onUpdateB).not.toHaveBeenCalled();
    expect(screen.getByTestId("author").textContent).toBe("Bob");
  });
});
