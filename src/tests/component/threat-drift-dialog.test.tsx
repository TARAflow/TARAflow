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
  { threatId: "t-1", displayId: "DF3-I-1", strideCategory: "I", elementName: "sensor data", relevance: "relevant" },
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
