// src/tests/component/verification-panel.test.tsx
//
// ISO/SAE 21434 conformance plan Phase 4, P4-3 (decision 25): the TARA
// verification in the Audit tab — record an entry with the current state hash
// and the open findings as checklist; state changed / committed; and the
// status in the Overview.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerificationPanel } from "features/audit/components/verification-panel";
import { GeneralTab, type GeneralTabData } from "features/overview";
import { EMPTY_PROJECT_TAGS, PHASES, type VerificationEntry } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

const entry = (over: Partial<VerificationEntry> = {}): VerificationEntry => ({
  id: "v1",
  date: "2026-10-20",
  reviewer: "A. Muster",
  scope: ["tara", "treatment", "goals-claims", "consistency"],
  result: "passed",
  stateHash: "h1",
  ...over,
});

afterEach(cleanup);

describe("verification panel", () => {
  it("records an entry with the current hash and the author as reviewer; the points start unchecked (user 2026-10-30)", () => {
    const onChange = vi.fn();
    render(
      <VerificationPanel
        entries={[]}
        currentStateHash="h1"
        checklist={[{ scope: "goals-claims", open: 2 }]}
        projectVersion="1.2"
        defaultReviewer="J. Messerer"
        commits={new Map()}
        gitAvailable={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Not verified yet.")).toBeTruthy();
    fireEvent.click(screen.getByTestId("verification-new"));
    expect(screen.getByTestId("verification-open-goals-claims").textContent).toContain("2 open finding(s)");
    expect(screen.getAllByRole("checkbox").every((c) => !(c as HTMLInputElement).checked)).toBe(true);
    expect((screen.getByTestId("verification-save") as HTMLButtonElement).disabled).toBe(true);
    for (const c of screen.getAllByRole("checkbox")) fireEvent.click(c);
    fireEvent.click(screen.getByTestId("verification-save"));
    expect(onChange.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        reviewer: "J. Messerer",
        scope: ["tara", "treatment", "goals-claims", "consistency"],
        result: "passed",
        stateHash: "h1",
        projectVersion: "1.2",
      }),
    ]);
  });

  it("changed since; not committed with Commit; committed with its hash", () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <VerificationPanel entries={[entry()]} currentStateHash="h2" checklist={[]} commits={new Map()} gitAvailable onChange={vi.fn()} onCommit={onCommit} />,
    );
    expect(screen.getByTestId("verification-state-changed")).toBeTruthy();
    expect(screen.getByTestId("verification-not-committed")).toBeTruthy();
    fireEvent.click(screen.getByTestId("verification-commit"));
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ id: "v1" }));
    rerender(
      <VerificationPanel entries={[entry()]} currentStateHash="h1" checklist={[]} commits={new Map([["v1", "abc1234"]])} gitAvailable onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("verification-committed").textContent).toBe("committed abc1234");
    expect(screen.queryByTestId("verification-remove")).toBeNull();
    expect(screen.queryByTestId("verification-edit")).toBeNull();
  });

  it("an entry not committed can be edited — it then vouches for the current state — and removed, also without git", () => {
    const onChange = vi.fn();
    render(
      <VerificationPanel
        entries={[entry({ result: "passed-with-conditions", reconfirm: "repair" })]}
        currentStateHash="h9"
        checklist={[]}
        projectVersion="1.3"
        commits={new Map()}
        gitAvailable={false}
        onChange={onChange}
      />,
    );
    expect(screen.queryByTestId("verification-not-committed")).toBeNull();
    fireEvent.click(screen.getByTestId("verification-edit"));
    expect(screen.getByText("Edit verification")).toBeTruthy();
    expect((screen.getByTestId("verification-reviewer") as HTMLInputElement).value).toBe("A. Muster");
    fireEvent.click(screen.getByTestId("verification-save"));
    const saved = onChange.mock.calls[0][0];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: "v1", result: "passed-with-conditions", stateHash: "h9", projectVersion: "1.3" });
    expect(saved[0].reconfirm).toBeUndefined();
    fireEvent.click(screen.getByTestId("verification-remove"));
    expect(onChange.mock.calls[1][0]).toEqual([]);
  });
});

describe("Overview: verification status (ISO)", () => {
  const data = {
    info: { name: "Smoke detector", description: "d", version: "1", responsible: "JM", created: "2026-10-01", lastModified: "2026-10-01", tags: { ...EMPTY_PROJECT_TAGS, custom: ["x"] }, team: [], isHighImpact: false },
    settings: {},
    phaseStatus: {},
  } as unknown as GeneralTabData;
  const view = (verification?: React.ComponentProps<typeof GeneralTab>["verification"], onOpenAuditTab = vi.fn()) =>
    render(
      <GeneralTab
        data={data}
        phases={PHASES}
        progressPhaseIds={[0]}
        getStatusIcon={() => ""}
        getStatusColor={() => ""}
        onUpdate={vi.fn()}
        projectId={`P${Math.random()}`}
        verification={verification}
        onOpenAuditTab={onOpenAuditTab}
      />,
    );

  it("verified: a green line, no badge", () => {
    view({ kind: "verified", latest: entry(), ageDays: 9, maxAgeDays: 90 });
    expect(screen.getByTestId("verification-status").textContent).toContain("Verified on 2026-10-20 by A. Muster");
    expect(screen.queryByTestId("overview-view-project-badge")).toBeNull();
  });

  it("changed: a warning, a badge and the way to the Audit tab", () => {
    const onOpenAuditTab = vi.fn();
    view({ kind: "changed", latest: entry(), ageDays: 9, maxAgeDays: 90 }, onOpenAuditTab);
    expect(screen.getByTestId("verification-status").getAttribute("data-kind")).toBe("changed");
    expect(screen.getByTestId("overview-view-project-badge").textContent).toBe("1");
    fireEvent.click(screen.getByTestId("verification-open-audit"));
    expect(onOpenAuditTab).toHaveBeenCalled();
  });

  it("outside ISO no status at all", () => {
    view(undefined);
    expect(screen.queryByTestId("verification-status")).toBeNull();
  });
});
