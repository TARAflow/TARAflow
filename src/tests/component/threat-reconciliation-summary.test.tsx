// src/tests/component/threat-reconciliation-summary.test.tsx
//
// Leveled DFD Phase 6e (§10): the "Regenerate" dialog shows the four
// categories before the regeneration is applied; a threat whose references
// changed carries a "Review" badge until the analyst saves it.
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreatReconciliationSummary } from "features/threats/components/shared/threat-reconciliation-summary";
import { ReviewBadge } from "features/threats/components/shared/threat-table-utils";
import type { Threat } from "features/threats/models/threat-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const threat = (id: string, name: string) =>
  ({ id, displayId: id, linkedElement: { elementName: name } }) as unknown as Threat;

describe("ThreatReconciliationSummary", () => {
  it("shows the four counts and lists the changed threats with their reasons", () => {
    render(
      <ThreatReconciliationSummary
        reconciliation={{
          added: [{ threat: threat("P2-S-1", "Sample Smoke Sensor") }],
          unchanged: [{ threat: threat("DF7-T-1", "stream") }, { threat: threat("DF7-I-1", "stream") }],
          changed: [{ threat: threat("DF7-D-1", "stream"), reasons: ["endpoint", "template"] }],
          obsolete: [{ threat: threat("MP1-S-1", "Sensor Module") }],
        }}
      />,
    );
    expect(screen.getByTestId("reconciliation-new").textContent).toContain("1");
    expect(screen.getByTestId("reconciliation-unchanged").textContent).toContain("2");
    expect(screen.getByTestId("reconciliation-changed").textContent).toContain("1");
    expect(screen.getByTestId("reconciliation-obsolete").textContent).toContain("1");
    const changed = screen.getByTestId("reconciliation-changed-list");
    expect(changed.textContent).toContain("DF7-D-1 stream");
    expect(within(changed).getByText("flow endpoint")).toBeTruthy();
    expect(within(changed).getByText("template")).toBeTruthy();
    expect(screen.getByTestId("reconciliation-new-list").textContent).toContain("P2-S-1 Sample Smoke Sensor");
  });
});

describe("ReviewBadge", () => {
  it("is shown only for a flagged threat", () => {
    const { rerender } = render(<ReviewBadge review={{ reasons: ["endpoint"], since: "2026-10-20T10:00:00Z" }} />);
    expect(screen.getByTestId("threat-review-badge").textContent).toBe("Review");
    rerender(<ReviewBadge review={undefined} />);
    expect(screen.queryByTestId("threat-review-badge")).toBeNull();
  });
});
