// src/tests/component/threat-drift-dialog.test.tsx
//
// Resolving generation drift must be explicit and must default to KEEP:
// nothing is dropped unless the analyst chooses Remove.
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThreatDriftDialog } from "features/threats/components/shared/threat-drift-dialog";
import { ThreatDriftBanner } from "features/threats/components/shared/threat-drift-banner";
import type { ObsoleteThreat } from "features/threats/services/threat-generation-drift";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: { defaultValue?: string } & Record<string, unknown>,
    ) => {
      const base = options?.defaultValue ?? key;
      return base.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
        options && name in options ? String(options[name]) : `{{${name}}}`,
      );
    },
  }),
}));

const obsolete: ObsoleteThreat[] = [
  {
    threatId: "t-1",
    displayId: "DF3-I-1",
    strideCategory: "I",
    elementName: "sensor data",
    relevance: "relevant",
    threatDescription: "Sensor values are read on the bus",
    attackDescription: "An attacker taps the cable and records the frames",
  },
  { threatId: "t-2", displayId: "P1-R-1", strideCategory: "R", elementName: "Controller", relevance: "not_relevant" },
] as ObsoleteThreat[];

const risks = { "t-1": { mitigationCount: 2 } };

describe("ThreatDriftDialog", () => {
  it("defaults to keeping every threat", () => {
    const onApply = vi.fn();
    render(
      <ThreatDriftDialog open obsolete={obsolete} riskAttachments={risks} onApply={onApply} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText("Apply"));
    const [keep, remove] = onApply.mock.calls[0];
    expect([...keep].sort()).toEqual(["t-1", "t-2"]);
    expect([...remove]).toEqual([]);
  });

  it("'Remove all without risk' keeps threats with a risk, removes the rest", () => {
    const onApply = vi.fn();
    render(
      <ThreatDriftDialog open obsolete={obsolete} riskAttachments={risks} onApply={onApply} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText("Remove all without risk"));
    fireEvent.click(screen.getByText("Apply"));
    const [keep, remove] = onApply.mock.calls[0];
    expect([...keep]).toEqual(["t-1"]);
    expect([...remove]).toEqual(["t-2"]);
  });

  it("shows the attached risk and its mitigation count", () => {
    render(
      <ThreatDriftDialog open obsolete={obsolete} riskAttachments={risks} onApply={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText("Risk · 2 mitigations")).toBeTruthy();
  });

  // 0.20 (user 2026-11-22): decide on the content, not the id — T-ID and the
  // threat text as columns, no STRIDE column (it is part of the T-ID).
  it("shows T-ID and the threat text, no STRIDE column", () => {
    render(
      <ThreatDriftDialog open obsolete={obsolete} riskAttachments={risks} onApply={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText("T-ID")).toBeTruthy();
    expect(screen.queryByText("STRIDE")).toBeNull();
    expect(screen.getByText("Sensor values are read on the bus")).toBeTruthy();
    // a threat without stored text says so instead of an empty cell
    expect(screen.getByText("No description")).toBeTruthy();
  });

  it("the tooltip of the threat text holds the full threat and attack text", async () => {
    render(
      <ThreatDriftDialog open obsolete={obsolete} riskAttachments={risks} onApply={() => {}} onClose={() => {}} />,
    );
    fireEvent.mouseOver(screen.getByText("Sensor values are read on the bus"));
    const tip = await screen.findByRole("tooltip");
    expect(tip.textContent).toContain("Sensor values are read on the bus");
    expect(tip.textContent).toContain("Attack");
    expect(tip.textContent).toContain("An attacker taps the cable and records the frames");
  });

  it("the table scrolls with a fixed header", () => {
    render(
      <ThreatDriftDialog open obsolete={obsolete} riskAttachments={risks} onApply={() => {}} onClose={() => {}} />,
    );
    const container = screen.getByTestId("threat-drift-table");
    expect(getComputedStyle(container).maxHeight).not.toBe("");
    expect(container.querySelector("table")?.className).toMatch(/stickyHeader/);
  });
});

describe("ThreatDriftBanner", () => {
  it("names obsolete threats, those with risk, and offers Review", () => {
    const onReview = vi.fn();
    render(
      <ThreatDriftBanner
        drift={{ obsolete, addedCount: 1 }}
        riskAttachments={risks}
        onReview={onReview}
        onRegenerate={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/2 stored threats would no longer be generated/)).toBeTruthy();
    expect(screen.getByText(/1 of them with a risk assessment/)).toBeTruthy();
    fireEvent.click(screen.getByText("Review"));
    expect(onReview).toHaveBeenCalled();
  });

  it("only additions → offers Regenerate instead of Review", () => {
    const onRegenerate = vi.fn();
    render(
      <ThreatDriftBanner
        drift={{ obsolete: [], addedCount: 3 }}
        onReview={() => {}}
        onRegenerate={onRegenerate}
        onDismiss={() => {}}
      />,
    );
    expect(screen.queryByText("Review")).toBeNull();
    fireEvent.click(screen.getByText("Regenerate"));
    expect(onRegenerate).toHaveBeenCalled();
  });
});

import { SourceBadge } from "features/threats/components/shared/threat-table-utils";

describe("SourceBadge for retained threats", () => {
  it("shows R (retained) instead of M (manual)", () => {
    render(<SourceBadge source="manual" retainedAt="2026-09-26T10:00:00.000Z" />);
    expect(screen.getByText("R")).toBeTruthy();
    expect(screen.queryByText("M")).toBeNull();
  });
  it("plain manual threats keep M", () => {
    render(<SourceBadge source="manual" />);
    expect(screen.getByText("M")).toBeTruthy();
  });
});
