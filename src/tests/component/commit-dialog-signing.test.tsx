// src/tests/component/commit-dialog-signing.test.tsx
//
// Review 2026-10-31 (TARAflow_Examples trail: SIG_UNSIGNED ×3, "Author:
// Unknown"): in a repository with a signer manifest (anchor) every commit is
// verified, so the commit dialog signs — box on and locked, whatever the
// project's signing setting; and the Author trailer is the author configured
// now, not the one at the time the tab opened.

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommitDialog } from "features/audit/components/commit-dialog";
import { DEFAULT_AUDIT_CONFIG, type AuditConfig, type CommitMessageData } from "features/audit/models/audit-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

const config = (signing: boolean): AuditConfig => ({
  ...DEFAULT_AUDIT_CONFIG,
  author: { name: "Ann Example", email: "ann@example.com" },
  signing: { enabled: signing, format: "ssh" },
});

const message: CommitMessageData = {
  round: "Detail Review",
  batchSize: 1,
  affectedPhases: ["Risk"],
  changes: [],
  author: "Unknown",
};

const open = (cfg: AuditConfig, anchor: string | null) => {
  const onCommit = vi.fn().mockResolvedValue(undefined);
  render(
    <CommitDialog
      open
      config={cfg}
      branches={[]}
      currentBranch="main"
      commitMessageData={message}
      onCommit={onCommit}
      onClose={() => {}}
      protection={{ anchor } as never}
    />,
  );
  return onCommit;
};

afterEach(cleanup);

describe("commit dialog — signing and author", () => {
  it("with a signer manifest: signing is on and locked, even with signing off in the project", async () => {
    const onCommit = open(config(false), "abc123");
    const box = screen.getByTestId("commit-sign-checkbox").querySelector("input")!;
    expect(box.checked).toBe(true);
    expect(box.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /^commit$/i }));
    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    expect(onCommit.mock.calls[0][0].signCommit).toBe(true);
  });

  it("without a manifest: the project's setting, the box can be unchecked", () => {
    open(config(true), null);
    const box = screen.getByTestId("commit-sign-checkbox").querySelector("input")!;
    expect(box.disabled).toBe(false);
    fireEvent.click(box);
    expect(box.checked).toBe(false);
  });

  it("the Author trailer is the configured author, not 'Unknown' from the tab's start", async () => {
    const onCommit = open(config(true), null);
    fireEvent.click(screen.getByRole("button", { name: /^commit$/i }));
    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const text = onCommit.mock.calls[0][0].message as string;
    expect(text).toContain("Author: Ann Example");
    expect(text).not.toContain("Unknown");
  });
});
