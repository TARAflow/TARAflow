// src/tests/component/commit-dialog-signing.test.tsx
//
// Reviews 2026-10-31 (TARAflow_Examples trail: SIG_UNSIGNED ×3): with a signer
// manifest committed at HEAD every commit is verified, so the commit dialog
// signs — box on and locked, whatever the project's signing switch; and a
// problem (no key, author not authorized) shows before the click, with the
// Commit button disabled — the same decision the commit handler makes.

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const MANIFEST = 'ann@example.com namespaces="git" ssh-ed25519 AAAA\n';

const config = (signing: boolean, key = "/k/id_ed25519", email = "ann@example.com"): AuditConfig => ({
  ...DEFAULT_AUDIT_CONFIG,
  author: { name: "Ann Example", email },
  signing: { enabled: signing, format: "ssh", ...(key ? { sshSigningKeyPath: key } : {}) },
});

const message: CommitMessageData = {
  round: "Detail Review",
  batchSize: 1,
  affectedPhases: ["Risk"],
  changes: [],
  author: "Ann Example",
};

const open = (cfg: AuditConfig, committedManifest: string | null, manifestAnchored = false) => {
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
      committedManifest={committedManifest}
      manifestAnchored={manifestAnchored}
    />,
  );
  return onCommit;
};
const commitButton = () => screen.getByRole("button", { name: /^commit$/i });

afterEach(cleanup);

describe("commit dialog — signing", () => {
  it("committed manifest: signing on and locked, even with signing off in the project", async () => {
    const onCommit = open(config(false), MANIFEST);
    const box = screen.getByTestId("commit-sign-checkbox").querySelector("input")!;
    expect(box.checked).toBe(true);
    expect(box.disabled).toBe(true);
    fireEvent.click(commitButton());
    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    expect(onCommit.mock.calls[0][0].signCommit).toBe(true);
  });

  it("no manifest at HEAD: the project's setting, the box can be unchecked", () => {
    open(config(true), null);
    const box = screen.getByTestId("commit-sign-checkbox").querySelector("input")!;
    expect(box.disabled).toBe(false);
    fireEvent.click(box);
    expect(box.checked).toBe(false);
  });

  it("no key: the problem shows before the click, Commit disabled", () => {
    open(config(true, ""), MANIFEST);
    expect(screen.getByTestId("commit-signing-problem").textContent).toContain("No signing key is set");
    expect((commitButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("author not in the committed manifest: shown before the click", () => {
    open(config(true, "/k/id", "bob@example.com"), MANIFEST);
    expect(screen.getByTestId("commit-signing-problem").textContent).toContain("bob@example.com");
    expect((commitButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("once the repository signs, it always signs: manifest removed since → locked, blocked", () => {
    open(config(false), null, true);
    const box = screen.getByTestId("commit-sign-checkbox").querySelector("input")!;
    expect(box.checked).toBe(true);
    expect(box.disabled).toBe(true);
    expect(screen.getByTestId("commit-signing-problem").textContent).toContain("signer manifest was removed");
    expect((commitButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("an existing other branch decides by ITS manifest (review 2026-10-31)", async () => {
    const load = vi.fn().mockResolvedValue({ manifest: MANIFEST, anchored: true });
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(
      <CommitDialog
        open
        config={config(false)}
        branches={[
          { name: "main", current: true, commit: "a", label: "main" },
          { name: "release", current: false, commit: "b", label: "release" },
        ]}
        currentBranch="main"
        commitMessageData={message}
        onCommit={onCommit}
        onClose={() => {}}
        committedManifest={null}
        loadBranchSigningState={load}
      />,
    );
    // Current branch without a manifest, signing off: no signing at all.
    expect(screen.queryByTestId("commit-sign-checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /existing branch/i }));
    fireEvent.mouseDown(within(screen.getByRole("radio", { name: /existing branch/i }).closest("label")!).getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "release" }));
    await waitFor(() => expect(load).toHaveBeenCalledWith("release"));
    await waitFor(() =>
      expect(screen.getByTestId("commit-sign-checkbox").querySelector("input")!.disabled).toBe(true),
    );
    fireEvent.click(commitButton());
    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    expect(onCommit.mock.calls[0][0]).toMatchObject({ branchName: "release", signCommit: true });
  });

  it("the label names the format", () => {
    open(config(true), null);
    expect(screen.getByText("Sign commit (SSH)")).toBeTruthy();
  });
});
